// Places where people live and work, set close to the spawn point on flat dry land (or at the shore).
// Buildings use CC0 photo textures (Poly Haven) at real-world scale; architecture follows the climate
// (flat concrete roofs with water tanks where it is hot, pitched tiled roofs elsewhere). Every solid
// structure is a collider. Each site holds NPCs with a story and a beacon so the player can find them.
import * as THREE from 'three';
import { createNPC } from '../people/index.js';

// ---------- textured materials, UVs in metres ----------
const TL = new THREE.TextureLoader(), TEX = new Map();
function tex(name, kind) {
  const k = name + kind;
  if (!TEX.has(k)) {
    const t = TL.load(new URL(`../../assets/tex/${name}_${kind}.jpg`, import.meta.url).href); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace; TEX.set(k, t);
  }
  return TEX.get(k);
}
// repeat: metres covered by one copy of the texture
function surface(name, repeat, color = 0xffffff, o = {}) {
  const map = tex(name, 'diff').clone(), normalMap = tex(name, 'nor_gl').clone();
  for (const t of [map, normalMap]) { t.repeat.set(1 / repeat, 1 / repeat); t.needsUpdate = true; }
  return new THREE.MeshStandardMaterial({ map, normalMap, color, roughness: 0.92, ...o });
}
let MAT = null;
const mats = () => MAT || (MAT = {
  plaster: [0xf3ead8, 0xe8c99a, 0xd9a58a, 0xc8d6e0, 0xe7e1c8].map(c => surface('clay_plaster', 3, c)),
  brick: surface('brick_wall_02', 2.4), block: surface('concrete_block_wall', 2.4, 0xd8d4cc), concrete: surface('concrete_block_wall', 4, 0xb8b4ac),
  tiles: surface('clay_roof_tiles', 2.2), iron: surface('corrugated_iron', 2, 0xc9ccd0, { metalness: 0.6, roughness: 0.5 }), ironRed: surface('corrugated_iron', 2, 0xa0463a, { metalness: 0.5, roughness: 0.55 }),
  planks: surface('brown_planks_05', 2.5), planksPale: surface('brown_planks_05', 2.5, 0xd8cdb8),
  glass: new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.08, metalness: 0.4, emissive: 0xffc070, emissiveIntensity: 0 }),
  door: surface('brown_planks_05', 1.2, 0x8a6a4a), dark: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6, metalness: 0.4 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.35, metalness: 0.8 }), canvas: [0xc23b22, 0x2a6f97, 0xe0a526, 0x4f7942].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide })),
  hay: new THREE.MeshStandardMaterial({ color: 0xc8a94e, roughness: 1 }), crop: new THREE.MeshStandardMaterial({ color: 0x5f8f2f, roughness: 0.9 }), soil: surface('brown_mud_02', 3, 0x9a8a78),
  cow: [0x3b2a20, 0xe8e2d6, 0x8a5a35].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })), white: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 }),
});

// Box with UVs in metres on every face, so textures keep their real scale whatever the size.
function tbox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const n = f * 4 + i; uv.setXY(n, uv.getX(n) * dims[f][0], uv.getY(n) * dims[f][1]); }
  return g;
}
function mesh(g, m, x, y, z, ry = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; return o; }

// ---------- builder: places parts on the real ground and registers colliders ----------
class Site {
  constructor(set, x, z, ry) { this.set = set; this.g = new THREE.Group(); this.x = x; this.z = z; this.ry = ry; this.c = Math.cos(ry); this.s = Math.sin(ry); }
  world(lx, lz) { return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c]; }
  ground(lx, lz, w = 0, d = 0) { // lowest and highest ground under a footprint
    const t = this.set.terrain; let lo = Infinity, hi = -Infinity;
    for (const [a, b] of [[0, 0], [-w, -d], [w, -d], [-w, d], [w, d]]) { const [x, z] = this.world(lx + a / 2, lz + b / 2), h = t.heightAt(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return [lo, hi];
  }
  // a solid block standing on a plinth that reaches down to the lowest ground under it
  block(lx, lz, w, h, d, m, ry = 0, material = 'stone') {
    const [lo, hi] = this.ground(lx, lz, w, d), base = hi;
    const o = new THREE.Group(); o.position.set(lx, base, lz); o.rotation.y = ry; this.g.add(o);
    o.add(mesh(tbox(w, h, d), m, 0, h / 2, 0));
    if (hi - lo > 0.05) o.add(mesh(tbox(w + 0.2, hi - lo + 0.6, d + 0.2), mats().concrete, 0, -(hi - lo + 0.6) / 2 + 0.1, 0));
    this.set.addBox(...this.world(lx, lz), w / 2, d / 2, this.ry + ry, material, base + h);
    return o;
  }
  cyl(lx, lz, r, h, m, material = 'metal', seg = 20) {
    const [, base] = this.ground(lx, lz, r * 2, r * 2), o = mesh(new THREE.CylinderGeometry(r, r, h, seg), m, lx, base + h / 2, lz);
    const uv = o.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * h);
    this.g.add(o); this.set.addCircle(...this.world(lx, lz), r, material); return o;
  }
  deco(o, lx, lz, lift = 0) { const [, base] = this.ground(lx, lz); o.position.set(lx, base + lift, lz); o.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; }); this.g.add(o); return o; }
}

// Pitched roof as an extruded triangle, tiled at real scale.
function gable(w, d, rise, m) {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.4, 0), new THREE.Vector2(w / 2 + 0.4, 0), new THREE.Vector2(0, rise)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false }); g.translate(0, 0, -(d + 0.8) / 2);
  return mesh(g, m, 0, 0, 0);
}
function windows(o, w, d, floors, m, door = true) { // panes and a door set into the walls
  const M = mats();
  for (let f = 0; f < floors; f++) for (const side of [-1, 1]) {
    for (let i = 0; i < Math.max(1, Math.floor(w / 3)); i++) {
      const x = -w / 2 + (i + 0.5) * w / Math.max(1, Math.floor(w / 3));
      if (door && f === 0 && side === 1 && i === 0) { o.add(mesh(tbox(1.1, 2.1, 0.12), M.door, x, 1.05, side * (d / 2 + 0.02))); continue; }
      o.add(mesh(tbox(1.1, 1.2, 0.1), M.glass, x, 1.6 + f * 3, side * (d / 2 + 0.02)));
      o.add(mesh(tbox(1.3, 0.12, 0.25), m, x, 0.95 + f * 3, side * (d / 2 + 0.08)));
    }
    if (d > 5) o.add(mesh(tbox(0.1, 1.2, 1.1), M.glass, side * (w / 2 + 0.02), 1.6 + f * 3, 0));
  }
}

function house(site, lx, lz, k, hot) {
  const M = mats(), w = 7 + (k % 3) * 1.5, d = 6 + (k % 2) * 1.5, floors = 1 + (k % 4 === 0 ? 1 : 0), h = floors * 3;
  const wall = k % 5 === 4 ? M.brick : M.plaster[k % M.plaster.length], ry = ((k * 37) % 4) * Math.PI / 2 + ((k * 13) % 7 - 3) * 0.04;
  const o = site.block(lx, lz, w, h, d, wall, ry);
  windows(o, w, d, floors, wall);
  if (hot) { // flat roof, parapet and a black water tank, as across South Asia, the Middle East and Africa
    o.add(mesh(tbox(w + 0.2, 0.5, d + 0.2), M.concrete, 0, h + 0.25, 0));
    const tank = mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 14), M.dark, w / 4, h + 1.2, -d / 4); o.add(tank);
  } else {
    const r = gable(w, d, 2.2 + (k % 2) * 0.6, M.tiles); r.position.y = h; r.rotation.y = 0; o.add(r);
    if (k % 3 === 0) o.add(mesh(tbox(0.7, 2.2, 0.7), M.brick, w / 4, h + 1.6, 0));
  }
}

// ---------- the four kinds of site ----------
const KINDS = {
  village: { roles: ['teacher', 'nurse', 'vendor'], label: 'Village', build(s, ctx) {
    const M = mats();
    for (let i = 0; i < 11; i++) { const a = i * 2.4, r = 22 + (i % 4) * 11; house(s, Math.cos(a) * r, Math.sin(a) * r, i + ctx.seed, ctx.hot); }
    // school: long single storey with a yard wall; clinic: white with a green cross sign
    const school = s.block(-6, -48, 22, 3.6, 9, ctx.hot ? M.plaster[1] : M.brick); windows(school, 22, 9, 1, M.plaster[0]);
    if (!ctx.hot) { const r = gable(22, 9, 2.6, M.ironRed); r.position.y = 3.6; school.add(r); } else school.add(mesh(tbox(22.2, 0.4, 9.2), M.concrete, 0, 3.8, 0));
    const clinic = s.block(30, 34, 10, 3.4, 8, M.white); windows(clinic, 10, 8, 1, M.white); clinic.add(mesh(tbox(10.2, 0.4, 8.2), M.concrete, 0, 3.6, 0));
    clinic.add(mesh(tbox(1.8, 0.5, 0.1), M.canvas[3], 0, 2.8, 4.1)); clinic.add(mesh(tbox(0.5, 1.8, 0.1), M.canvas[3], 0, 2.8, 4.12));
    // well and market stalls in the square
    s.cyl(0, 0, 1.1, 0.9, M.block, 'stone'); [-1, 1].forEach(x => s.deco(mesh(tbox(0.15, 2.4, 0.15), M.planks, 0, 1.2, 0), x * 1.1, 0));
    s.deco(mesh(tbox(2.8, 0.15, 1.2), M.planks, 0, 0, 0), 0, 0, 2.45);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(), x = -12 + i * 6.5, z = 12;
      g.add(mesh(tbox(4, 0.9, 1.6), M.planks, 0, 0.45, 0)); g.add(mesh(new THREE.PlaneGeometry(4.6, 2.4), M.canvas[i % 4], 0, 2.4, 0).rotateX(-Math.PI / 2 + 0.25));
      for (const [px, pz] of [[-2, -0.9], [2, -0.9], [-2, 0.9], [2, 0.9]]) g.add(mesh(tbox(0.08, 2.4 + pz * 0.3, 0.08), M.planks, px, 1.2 + pz * 0.15, pz));
      for (let j = 0; j < 6; j++) g.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: [0xd23b1f, 0xf0a020, 0x6aa832, 0xe8d24a][(i + j) % 4], roughness: 0.6 }), -1.5 + j * 0.6, 1.0, (j % 2) * 0.3));
      s.deco(g, x, z); s.set.addBox(...s.world(x, z), 2, 0.8, s.ry, 'wood', 1);
    }
    // street lamps
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3, g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 5, 8), M.steel, 0, 2.5, 0)); const l = mesh(tbox(0.5, 0.15, 0.3), M.glass, 0.25, 5, 0); s.set.lamps.push(l); g.add(l); s.deco(g, Math.cos(a) * 15, Math.sin(a) * 15); }
  } },
  farm: { roles: ['farmer', 'herder'], label: 'Farm', build(s, ctx) {
    const M = mats();
    house(s, -16, -12, 3 + ctx.seed, ctx.hot);
    const barn = s.block(14, -12, 14, 6, 10, M.planks, 0, 'wood'); const r = gable(14, 10, 3.5, M.ironRed); r.position.y = 6; barn.add(r);
    barn.add(mesh(tbox(4, 4.5, 0.15), M.planksPale, 0, 2.25, 5.05));
    for (const [x, z] of [[30, -18], [30, -10]]) { const silo = s.cyl(x, z, 2.6, 11, M.iron); silo.add(mesh(new THREE.ConeGeometry(2.7, 1.6, 20), M.steel, 0, 6.3, 0)); }
    // fields: rows of crop whose colour follows the measured soil wetness, on tilled soil
    const lush = Math.min(1, Math.max(0, (ctx.wet - 0.25) / 0.5)), crop = M.crop.clone(); crop.color.lerpColors(new THREE.Color(0xb59a52), new THREE.Color(0x4f8a2a), lush);
    for (let f = 0; f < 2; f++) {
      const fx = -30 + f * 34, fz = 30, [lo, hi] = s.ground(fx, fz, 28, 30), y = (lo + hi) / 2;
      const soil = mesh(tbox(28, 0.3, 30), M.soil, fx, y, fz); soil.castShadow = false; s.g.add(soil);
      const rows = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.9 + lush * 0.6, 5), crop, 14 * 38), m4 = new THREE.Matrix4();
      let n = 0; for (let i = 0; i < 14; i++) for (let j = 0; j < 38; j++) { const [wx, wz] = [fx - 13 + i * 2, fz - 14.5 + j * 0.8]; m4.makeTranslation(wx, y + 0.5, wz); rows.setMatrixAt(n++, m4); }
      rows.castShadow = true; s.g.add(rows);
      fence(s, fx, fz, 29, 31);
    }
    for (let i = 0; i < 5; i++) { const b = mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 16), M.hay, 0, 0, 0); b.rotation.z = Math.PI / 2; s.deco(b, 4 + i * 1.8, 4 + (i % 2) * 1.6, 0.75); }
    for (let i = 0; i < 4; i++) s.deco(cow(i), -10 + i * 4, 10 + (i % 2) * 3).rotation.y = i * 1.3;
    s.set.addCircle(...s.world(-4, 11), 6, 'wood');
  } },
  industry: { roles: ['factory', 'builder'], label: 'Works', build(s, ctx) {
    const M = mats();
    const hall = s.block(0, 0, 40, 10, 24, M.iron, 0, 'metal'); hall.add(mesh(tbox(40.4, 0.6, 24.4), M.dark, 0, 10.3, 0));
    for (let i = 0; i < 5; i++) hall.add(mesh(tbox(7.5, 1.6, 24), M.iron, -16 + i * 8, 11.2, 0).rotateZ(0.3)); // sawtooth roof lights
    hall.add(mesh(tbox(6, 5, 0.2), M.dark, 0, 2.5, 12.1));
    for (const x of [-12, 6]) { const c = s.cyl(x, -16, 1.4, 26, M.brick, 'stone', 16), [wx, wz] = s.world(x, -16); s.set.chimneys.push(new THREE.Vector3(wx, c.position.y + 13, wz)); }
    for (const [x, z] of [[-30, 14], [-30, 2]]) s.cyl(x, z, 4, 9, M.steel);
    const office = s.block(28, 16, 12, 6.4, 9, M.block); windows(office, 12, 9, 2, M.block); office.add(mesh(tbox(12.2, 0.4, 9.2), M.concrete, 0, 6.6, 0));
    for (let i = 0; i < 6; i++) s.block(-6 + (i % 3) * 7, 26 + Math.floor(i / 3) * 3, 6.1, 2.6, 2.44, [M.ironRed, M.iron, M.canvas[1]][i % 3], 0, 'metal'); // shipping containers
    for (let i = 0; i < 3; i++) pylon(s, 48 + i * 60, -20 + i * 8);
  } },
  harbour: { roles: ['fisher', 'vendor'], label: 'Harbour', build(s, ctx) {
    const M = mats(), t = s.set.terrain;
    // the jetty runs from the shore out over the water: find the direction of the sea
    let best = 0, ang = 0; for (let a = 0; a < 16; a++) { const [x, z] = s.world(Math.cos(a / 16 * 6.28) * 40, Math.sin(a / 16 * 6.28) * 40), h = t.heightAt(x, z); if (-h > best) { best = -h; ang = a / 16 * 6.28; } }
    const jx = Math.cos(ang), jz = Math.sin(ang), ry = Math.atan2(jx, jz);
    const jet = new THREE.Group(); jet.position.set(jx * 6, 0, jz * 6); jet.rotation.y = ry; s.g.add(jet);
    jet.position.y = 1.2; // deck height above the sea
    jet.add(mesh(tbox(3.2, 0.25, 46), M.planks, 0, 0, 23));
    for (let i = 0; i < 12; i++) for (const x of [-1.5, 1.5]) jet.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 6, 8), M.planks, x, -2.8, 2 + i * 4));
    for (let i = 0; i < 3; i++) { const b = boat(i); b.position.set(i % 2 ? 4.5 : -4.5, -1.15, 12 + i * 11); b.rotation.y = 0.1 * i; jet.add(b); }
    s.set.walkways.push({ x: s.x + jx * 6, z: s.z + jz * 6, dx: jx, dz: jz, len: 46, half: 1.6, y: jet.position.y + 0.13 });
    // boathouses, crates and drying racks on shore
    const back = (d, side) => [-jx * d - jz * side, -jz * d + jx * side];
    for (const [i, side] of [[0, -14], [1, 12]]) { const [x, z] = back(14, side), o = s.block(x, z, 9, 4, 7, M.planksPale, ry, 'wood'); const r = gable(9, 7, 2, M.iron); r.position.y = 4; o.add(r); windows(o, 9, 7, 1, M.planksPale); }
    for (let i = 0; i < 6; i++) { const [x, z] = back(4 + (i % 2), -6 + i * 1.3); s.block(x, z, 1, 0.8, 1, M.planks, i, 'wood'); }
    for (let i = 0; i < 2; i++) { const [x, z] = back(8, 3 + i * 4), g = new THREE.Group(); [-1.5, 1.5].forEach(px => g.add(mesh(tbox(0.12, 2, 0.12), M.planks, px, 1, 0))); g.add(mesh(new THREE.PlaneGeometry(3, 1.4, 6, 3), new THREE.MeshStandardMaterial({ color: 0x3f5a4a, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, 1.2, 0)); s.deco(g, x, z).rotation.y = ry; }
  } },
};

function fence(s, cx, cz, w, d) {
  const M = mats(), post = new THREE.CylinderGeometry(0.06, 0.07, 1.3, 6);
  for (const [ax, az, len, horiz] of [[cx, cz - d / 2, w, true], [cx, cz + d / 2, w, true], [cx - w / 2, cz, d, false], [cx + w / 2, cz, d, false]]) {
    for (let i = 0; i <= len / 3; i++) { const t = -len / 2 + i * 3; s.deco(mesh(post, M.planks, 0, 0.65, 0), horiz ? ax + t : ax, horiz ? az : az + t); }
    const [, y] = s.ground(ax, az); const rail = mesh(tbox(horiz ? len : 0.05, 0.08, horiz ? 0.05 : len), M.planks, ax, y + 1.0, az); s.g.add(rail);
    const rail2 = rail.clone(); rail2.position.y -= 0.45; s.g.add(rail2);
  }
}
function cow(i) {
  const M = mats(), g = new THREE.Group(), c = M.cow[i % 3];
  g.add(mesh(new THREE.CapsuleGeometry(0.42, 1.2, 4, 10).rotateZ(Math.PI / 2), c, 0, 1.05, 0));
  g.add(mesh(tbox(0.36, 0.42, 0.6), c, 0.95, 1.25, 0).rotateY(Math.PI / 2)); g.add(mesh(tbox(0.2, 0.18, 0.24), M.white, 1.2, 1.12, 0));
  for (const [x, z] of [[-0.55, -0.22], [-0.55, 0.22], [0.5, -0.22], [0.5, 0.22]]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.8, 6), c, x, 0.4, z));
  return g;
}
function boat(i) {
  const M = mats(), g = new THREE.Group(), pts = [new THREE.Vector2(0, -0.6), new THREE.Vector2(0.9, -0.3), new THREE.Vector2(1.1, 0.5)];
  const hull = mesh(new THREE.LatheGeometry(pts, 14, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), M.canvas[i % 4], 0, 0.7, 0); hull.scale.set(1, 1, 3.4); g.add(hull);
  g.add(mesh(tbox(1.8, 0.08, 5), M.planks, 0, 1.1, 0)); return g;
}
function pylon(s, lx, lz) {
  const M = mats(), g = new THREE.Group();
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const leg = mesh(new THREE.CylinderGeometry(0.08, 0.12, 22, 5), M.steel, x * 0.6, 11, z * 0.6); leg.rotation.set(-z * 0.05, 0, x * 0.05); g.add(leg); }
  g.add(mesh(tbox(9, 0.3, 0.3), M.steel, 0, 20, 0)); g.add(mesh(tbox(6, 0.3, 0.3), M.steel, 0, 16, 0));
  s.deco(g, lx, lz); s.set.addCircle(...s.world(lx, lz), 1.6, 'metal');
}

// ---------- chimney smoke: rises and thickens with the aerosol record ----------
function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Settlements {
  constructor(scene) { this.scene = scene; this.sites = []; this.npcs = []; this.group = new THREE.Group(); scene.add(this.group); this.t = 0; this.boxes = []; this.circles = []; this.lamps = []; this.chimneys = []; this.walkways = []; this.smoke = []; }

  addBox(x, z, hw, hd, ry, material, top) { this.boxes.push({ x, z, hw, hd, c: Math.cos(ry), s: Math.sin(ry), material, top }); }
  addCircle(x, z, r, material) { this.circles.push({ x, z, r, material }); }

  // Solid structures: returns how to push a circle of radius r at (x, z) out of the nearest one.
  collide(x, z, r, y = -Infinity) {
    for (const b of this.boxes) {
      if (y > b.top) continue; // above the roof (aircraft, jumps)
      const dx = x - b.x, dz = z - b.z, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const cx = Math.max(-b.hw, Math.min(b.hw, lx)), cz = Math.max(-b.hd, Math.min(b.hd, lz)), ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
      if (d >= r) continue;
      let nx, nz, depth;
      if (d > 1e-6) { nx = ox / d; nz = oz / d; depth = r - d; }
      else { const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; depth = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; depth = pz + r; } }
      return { nx: nx * b.c + nz * b.s, nz: -nx * b.s + nz * b.c, depth, material: b.material };
    }
    for (const o of this.circles) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz); if (d < r + o.r && d > 1e-6) return { nx: dx / d, nz: dz / d, depth: r + o.r - d, material: o.material }; }
    return null;
  }
  // Inside a site's footprint: keeps trees and grass out of buildings.
  blocked(x, z) { for (const s of this.sites) if ((x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r) return true; return false; }
  // Standing on the jetty deck: height of the boards there, else null.
  deckAt(x, z) {
    for (const w of this.walkways) { const dx = x - w.x, dz = z - w.z, a = dx * w.dx + dz * w.dz, b = -dx * w.dz + dz * w.dx; if (a > -1 && a < w.len && Math.abs(b) < w.half) return w.y; }
    return null;
  }

  // Place up to four sites within about 0.6 to 2.6 km of (x, z). climate: { tMean, wet, aod }
  build(terrain, x, z, soilWetness, placeName, climate = {}) {
    this.terrain = terrain;
    const flat = (px, pz) => terrain.heightAt(px, pz) > 2 && terrain.slopeAt(px, pz) < 0.12 && terrain.slopeAt(px + 40, pz + 40) < 0.15;
    const shore = (px, pz) => terrain.heightAt(px, pz) > 1 && terrain.heightAt(px, pz) < 12 && terrain.findNear(px, pz, (a, b) => terrain.heightAt(a, b) < -1, 30, 120);
    const plan = [['village', 0.4], ['farm', 2.1], ['industry', 4.0], ['harbour', 5.2]];
    let seed = Math.abs(Math.round(x * 13 + z * 7 + placeName.length * 101));
    this.aod = climate.aod ?? 0.2;
    for (const [kind, angle] of plan) {
      const test = kind === 'harbour' ? shore : flat;
      let spot = null;
      for (let d = 600; d <= 2600 && !spot; d += 400) spot = terrain.findNear(x + Math.cos(angle) * d, z + Math.sin(angle) * d, test, 120, 900);
      if (!spot) continue;
      const s = new Site(this, spot.x, spot.z, (seed % 628) / 100);
      s.g.position.set(spot.x, 0, spot.z); s.g.rotation.y = s.ry;
      KINDS[kind].build(s, { hot: (climate.tMean ?? 15) > 19, wet: soilWetness, seed }); this.group.add(s.g);
      const site = { kind, label: KINDS[kind].label, x: spot.x, z: spot.z, r: kind === 'harbour' ? 30 : 62, npcs: [] };
      KINDS[kind].roles.forEach((role, i) => {
        const p = createNPC(role, ++seed, terrain.toLatLon(spot.x, spot.z)), a = i * 2.1 + angle;
        let nx = spot.x + Math.cos(a) * (8 + i * 4), nz = spot.z + Math.sin(a) * (8 + i * 4);
        const free = terrain.findNear(nx, nz, (px, pz) => !this.collide(px, pz, 1.5) && terrain.heightAt(px, pz) > 0.5, 3, 60); if (free) ({ x: nx, z: nz } = free);
        p.object.position.set(nx, terrain.heightAt(nx, nz), nz); p.object.rotation.y = seed % 6;
        this.group.add(p.object);
        const npc = { person: p, role, seed, site, heard: false, home: { x: nx, z: nz }, phase: seed % 7, clock: (seed % 20), beacon: this.beacon(nx, terrain.heightAt(nx, nz), nz) };
        site.npcs.push(npc); this.npcs.push(npc);
      });
      this.sites.push(site);
    }
    // smoke puffs for each chimney
    if (this.chimneys.length) {
      this.smokeMat = new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, color: 0x9a968e, opacity: Math.min(0.9, 0.35 + this.aod) });
      for (const c of this.chimneys) for (let i = 0; i < 18; i++) { const sp = new THREE.Sprite(this.smokeMat.clone()); sp.userData = { base: c, age: i / 18 * 9 }; this.group.add(sp); this.smoke.push(sp); }
    }
    return this.sites;
  }

  beacon(x, y, z) { // a tall light and a turning marker over each storyteller
    const g = new THREE.Group(); g.position.set(x, y, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.22, depthWrite: false }));
    beam.position.y = 37; const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xf2b84b }));
    gem.position.y = 2.5; g.add(beam, gem); g.userData.gem = gem; g.userData.beam = beam; this.group.add(g); return g;
  }

  markHeard(npc) { npc.heard = true; npc.beacon.userData.gem.material = new THREE.MeshBasicMaterial({ color: 0x4fd1a5 }); npc.beacon.userData.beam.material.opacity = 0.06; }

  nearest(pos, max = 6) {
    let best = null, bd = max;
    for (const n of this.npcs) { const d = n.person.object.position.distanceTo(pos); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  // night: 0 day .. 1 full night, lights the windows and lamps
  setNight(n) { mats().glass.emissiveIntensity = n * 1.6; }

  update(dt, playerPos) {
    this.t += dt;
    for (const n of this.npcs) {
      const o = n.person.object, near = playerPos && o.position.distanceTo(playerPos) < 12;
      n.clock += dt; const working = n.clock % 34 < 20; // work at their spot, then stroll a loop
      if (near || n.talking) {
        n.person.setWorking?.(false); n.person.update(dt, 0); o.rotation.y = Math.atan2(-(playerPos.x - o.position.x), -(playerPos.z - o.position.z));
      } else if (working) {
        n.person.setWorking?.(true); n.person.update(dt, 0);
      } else {
        n.person.setWorking?.(false);
        n.phase += dt * 0.12; let x = n.home.x + Math.cos(n.phase) * 6 - 6, z = n.home.z + Math.sin(n.phase) * 6;
        if (this.collide(x, z, 0.4)) { n.phase -= dt * 0.12; x = o.position.x; z = o.position.z; }
        o.rotation.y = Math.atan2(-(x - o.position.x), -(z - o.position.z));
        o.position.set(x, this.terrain.heightAt(x, z), z); n.person.update(dt, 0.72);
      }
      n.beacon.position.set(o.position.x, o.position.y, o.position.z);
      n.beacon.userData.gem.rotation.y += dt * 1.5; n.beacon.userData.gem.position.y = 2.5 + Math.sin(this.t * 2) * 0.15;
    }
    for (const sp of this.smoke) { // each puff rises, grows and fades, then starts again at the stack
      const u = sp.userData; u.age = (u.age + dt) % 9; const k = u.age / 9;
      sp.position.set(u.base.x + k * 14, u.base.y + k * 28, u.base.z + Math.sin(u.age + u.base.x) * 2); sp.scale.setScalar(2 + k * 12); sp.material.opacity = (1 - k) * Math.min(0.8, 0.3 + this.aod * 0.7);
    }
  }

  dispose() { this.npcs.forEach(n => n.person.dispose()); this.scene.remove(this.group); this.sites = []; this.npcs = []; this.boxes = []; this.circles = []; }
}
