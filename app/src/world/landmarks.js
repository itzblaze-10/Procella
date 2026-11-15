// Famous landmarks of the 30 world cities, modelled in code at their published real-world size.
// Contract: app/CITIES.md. Every entry's build() returns a THREE.Group in metres, base at y = 0, north = -z,
// ALREADY ROTATED to its real heading (do not rotate again). Colliders are in that same rotated frame.
// heading = compass degrees the model's front (local -z before rotation) faces.
// Coordinates checked against OpenStreetMap (Nominatim search + footprint centroids, Overpass) on 2026-11-15;
// footprint long-axis bearings from the OSM outlines set the headings.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const D = Math.PI / 180, PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- materials (lazy, shared) ----------
const TL = new THREE.TextureLoader(), TEX = new Map(), C = {};
const mat = (k, f) => C[k] || (C[k] = f());
function tex(name, kind) {
  const k = name + kind;
  if (!TEX.has(k)) {
    const t = TL.load(new URL(`../../assets/tex/${name}_${kind}.jpg`, import.meta.url).href);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace;
    TEX.set(k, t);
  }
  return TEX.get(k);
}
// Average linear colour of each diffuse texture (measured): dividing by it makes `color` the colour you see
const AVG = { clay_plaster: [0.17, 0.102, 0.045], concrete_block_wall: [0.06, 0.048, 0.033], brick_wall_02: [0.378, 0.292, 0.197], clay_roof_tiles: [0.106, 0.035, 0.012] };
// CC0 photo texture, UVs in metres: `repeat` metres per copy
function surface(name, repeat, color, o = {}) {
  const map = tex(name, 'diff').clone(), normalMap = tex(name, 'nor_gl').clone(), [r, g, b] = AVG[name];
  for (const t of [map, normalMap]) { t.repeat.set(1 / repeat, 1 / repeat); t.needsUpdate = true; }
  const c = new THREE.Color(color).multiplyScalar(0.75); c.r /= r; c.g /= g; c.b /= b; // 0.75: photo albedo, not paint
  return new THREE.MeshStandardMaterial({ map, normalMap, color: c, roughness: 0.9, ...o });
}
// Canvas facade: a grid of window panes, one cell = bay x floor metres
function facade(wall, glass, bay, floor, fx = 0.7, fy = 0.6, o = {}) {
  const n = 8, s = 32, c = document.createElement('canvas'); c.width = c.height = n * s;
  const g = c.getContext('2d'), base = new THREE.Color(glass);
  g.fillStyle = wall; g.fillRect(0, 0, n * s, n * s);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = '#' + base.clone().multiplyScalar(0.75 + rnd() * 0.5).getHexString();
    g.fillRect(i * s + s * (1 - fx) / 2, j * s + s * (1 - fy) / 2, s * fx, s * fy);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(1 / (n * bay), 1 / (n * floor));
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.35, ...o });
}
// Spiral-striped canvas for onion domes (lathe UVs: u around, v up)
function stripes(a, b, turns = 1, n = 8) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 256, 256); g.fillStyle = b;
  for (let i = -n; i < 2 * n; i++) { const x = i * 256 / n; g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 128 / n, 256); g.lineTo(x + 128 / n + 256 * turns, 0); g.lineTo(x + 256 * turns, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.2 });
}
const std = (color, roughness = 0.8, metalness = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...o });
const M = {
  iron: () => mat('iron', () => std(0x6b543f, 0.62, 0.55)),            // "Eiffel Tower brown" bronze paint
  steel: () => mat('steel', () => std(0xc9cdd2, 0.28, 0.9)),
  gold: () => mat('gold', () => std(0xd8a743, 0.3, 1)),
  copper: () => mat('copper', () => std(0x6fa08a, 0.6, 0.3)),          // verdigris
  lead: () => mat('lead', () => std(0x8a9096, 0.65, 0.25)),
  slate: () => mat('slate', () => std(0x3c434a, 0.6, 0.4)),
  dark: () => mat('dark', () => std(0x1c1f23, 0.5, 0.3)),
  white: () => mat('white', () => std(0xf2efe8, 0.55)),
  red: () => mat('red', () => std(0xa8322a, 0.7)),
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x8ea6b8, roughness: 0.06, metalness: 0.85 })),
  darkGlass: () => mat('darkGlass', () => new THREE.MeshPhysicalMaterial({ color: 0x20303c, roughness: 0.05, metalness: 0.6, side: THREE.DoubleSide })),
  tiles: () => mat('tiles', () => new THREE.MeshPhysicalMaterial({ color: 0xf1ede2, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide })),
  pink: () => mat('pink', () => new THREE.MeshPhysicalMaterial({ color: 0xc0306e, roughness: 0.18, metalness: 0.4, clearcoat: 1 })),
  soap: () => mat('soap', () => std(0xe6e3d9, 0.85)),                  // soapstone tiles, Christ the Redeemer
  stone: (k, color, rep = 3) => mat('stone' + k, () => surface('clay_plaster', rep, color)),
  blocks: (k, color, rep = 3) => mat('blocks' + k, () => surface('concrete_block_wall', rep, color)),
  brick: (k, color) => mat('brick' + k, () => surface('brick_wall_02', 2.4, color)),
  roof: (k, color, o) => mat('roof' + k, () => surface('clay_roof_tiles', 2, color, o)),
  face: (k, ...a) => mat('face' + k, () => facade(...a)),
};

// ---------- geometry helpers: all in metres, base at y = 0, UVs in metres ----------
function uvScale(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
function boxG(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const n = f * 4 + i; uv.setXY(n, f === 2 || f === 3 ? 0.01 : uv.getX(n) * dims[f][0], f === 2 || f === 3 ? 0.01 : uv.getY(n) * dims[f][1]); }
  return g.translate(0, h / 2, 0);
}
const cylG = (rt, rb, h, seg = 24) => uvScale(new THREE.CylinderGeometry(rt, rb, h, seg), 2 * PI * Math.max(rt, rb), h).translate(0, h / 2, 0);
const facet = g => { g = g.toNonIndexed(); g.computeVertexNormals(); return g; };
// Lathe through [[r, y], ...]; seg 4/8/12 + facet() gives square / octagonal plans
function latheG(prof, seg = 24, phi = 0, metres = true) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg, phi);
  let len = 0; for (let i = 1; i < prof.length; i++) len += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]);
  return metres ? uvScale(g, 2 * PI * Math.max(...prof.map(p => p[0])), len) : g;
}
const domeG = (r, hs = 1, seg = 24) => new THREE.SphereGeometry(r, seg, seg / 2, 0, 2 * PI, 0, PI / 2).scale(1, hs, 1);
// Russian onion dome, base radius 0.55 r, widest r, pointed tip at h
const onionG = (r, h, seg = 16) => latheG([[0.55, 0], [0.8, 0.1], [0.98, 0.25], [1, 0.33], [0.9, 0.48], [0.62, 0.63], [0.32, 0.78], [0.12, 0.9], [0.02, 1]].map(([a, b]) => [a * r, b * h]), seg, 0, false);
// Loft of axis-aligned rectangles [[w, d, y, cx, cz], ...]: towers, setbacks, pyramids, hip roofs (flat faces)
function loftG(L) {
  const P = [], U = [];
  const ring = ([w, d, y, cx = 0, cz = 0]) => [[cx - w / 2, y, cz + d / 2], [cx + w / 2, y, cz + d / 2], [cx + w / 2, y, cz - d / 2], [cx - w / 2, y, cz - d / 2]];
  const tri = (a, b, c, ua, ub, uc) => { P.push(...a, ...b, ...c); U.push(...ua, ...ub, ...uc); };
  for (let k = 0; k + 1 < L.length; k++) {
    const r0 = ring(L[k]), r1 = ring(L[k + 1]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, a = r0[i], b = r0[j], c = r1[j], e = r1[i];
      const uw = Math.hypot(b[0] - a[0], b[2] - a[2]), vh = Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2]);
      tri(a, b, c, [0, 0], [uw, 0], [uw, vh]); tri(a, c, e, [0, 0], [uw, vh], [0, vh]);
    }
  }
  const t = ring(L[L.length - 1]), b = ring(L[0]), uv = p => [p[0], p[2]];
  tri(t[0], t[1], t[2], uv(t[0]), uv(t[1]), uv(t[2])); tri(t[0], t[2], t[3], uv(t[0]), uv(t[2]), uv(t[3]));
  tri(b[0], b[2], b[1], uv(b[0]), uv(b[2]), uv(b[1])); tri(b[0], b[3], b[2], uv(b[0]), uv(b[3]), uv(b[2]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals(); return g;
}
// Plan shape (THREE.Shape in x, -z) extruded up by h
const prismG = (shape, h, seg = 10) => new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: seg }).rotateX(-PI / 2);
const poly = pts => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
// Vertical shape in x-y extruded along z, centred
const sideG = (pts, depth, seg = 8) => new THREE.ExtrudeGeometry(pts instanceof THREE.Shape ? pts : new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false, curveSegments: seg }).translate(0, 0, -depth / 2);
// Arcade wall: W x H panel, `depth` thick, round-headed openings [[cx, w, h], ...] cut up from its base
function archesG(W, H, depth, openings, seg = 8) {
  const s = new THREE.Shape(); s.moveTo(-W / 2, 0);
  for (const [cx, w, h] of [...openings].sort((a, b) => a[0] - b[0])) {
    s.lineTo(cx - w / 2, 0); s.lineTo(cx - w / 2, h - w / 2); s.absarc(cx, h - w / 2, w / 2, PI, 0, true); s.lineTo(cx + w / 2, 0);
  }
  s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H);
  return sideG(s, depth, seg);
}
// Convex polyhedron from faces (arrays of Vector3); each face is wound to point away from the centroid
function polyG(faces) {
  const P = [], U = [], c = new THREE.Vector3(); let n = 0;
  for (const f of faces) for (const p of f) { c.add(p); n++; }
  c.divideScalar(n);
  for (let f of faces) {
    const nrm = new THREE.Vector3().subVectors(f[1], f[0]).cross(new THREE.Vector3().subVectors(f[2], f[0]));
    const mid = f.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(f.length);
    if (nrm.dot(mid.sub(c)) < 0) { f = [...f].reverse(); nrm.negate(); }
    const e1 = new THREE.Vector3().subVectors(f[1], f[0]).normalize(), e2 = nrm.normalize().clone().cross(e1);
    const uv = p => { const d = p.clone().sub(f[0]); return [d.dot(e1), d.dot(e2)]; };
    for (let i = 1; i + 1 < f.length; i++) for (const p of [f[0], f[i], f[i + 1]]) { P.push(p.x, p.y, p.z); U.push(...uv(p)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals(); return g;
}
// Elliptical wall ring (x = a cos t, z = b sin t) from t0 to t1, thickness th inward, y0..y1
function ellipseWallG(a, b, th, y0, y1, t0 = 0, t1 = 2 * PI, seg = 96) {
  const at = (t, o, y) => V((a - o) * Math.cos(t), y, (b - o) * Math.sin(t));
  const P = [], U = [];
  const quad = (p, q, r, s, u0, u1, v) => { for (const [pt, uu, vv] of [[p, u0, 0], [q, u1, 0], [r, u1, v], [p, u0, 0], [r, u1, v], [s, u0, v]]) { P.push(pt.x, pt.y, pt.z); U.push(uu, vv); } };
  let u = 0;
  for (let i = 0; i < seg; i++) {
    const ta = t0 + (t1 - t0) * i / seg, tb = t0 + (t1 - t0) * (i + 1) / seg, du = at(ta, 0, 0).distanceTo(at(tb, 0, 0));
    quad(at(ta, 0, y0), at(tb, 0, y0), at(tb, 0, y1), at(ta, 0, y1), u, u + du, y1 - y0);   // outer
    quad(at(tb, th, y0), at(ta, th, y0), at(ta, th, y1), at(tb, th, y1), u + du, u, y1 - y0); // inner
    quad(at(ta, 0, y1), at(tb, 0, y1), at(tb, th, y1), at(ta, th, y1), u, u + du, th);      // top
    u += du;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals(); return g;
}
// Spherical triangle through A, B, C bulging away from `inside` (Sydney Opera House shells are spherical patches)
function sphTriG(A, B, C, inside, bulge = 1.6, n = 12) {
  let u = B.clone().sub(A), v = C.clone().sub(A);
  if (u.clone().cross(v).dot(A.clone().add(B).add(C).divideScalar(3).sub(inside)) < 0) { [B, C] = [C, B]; u = B.clone().sub(A); v = C.clone().sub(A); }
  const w = u.clone().cross(v), N = w.clone().normalize();
  const cc = A.clone().add(v.clone().cross(w).multiplyScalar(u.lengthSq()).add(w.clone().cross(u).multiplyScalar(v.lengthSq())).divideScalar(2 * w.lengthSq()));
  const rc = cc.distanceTo(A), R = rc * bulge, O = cc.clone().addScaledVector(N, -Math.sqrt(R * R - rc * rc));
  const P = [], I = [], idx = (i, j) => i * (i + 1) / 2 + j;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= i; j++) {
    const p = A.clone().multiplyScalar(1 - i / n).addScaledVector(B, (i - j) / n).addScaledVector(C, j / n);
    p.sub(O).setLength(R).add(O); P.push(p.x, p.y, p.z);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    I.push(idx(i, j), idx(i + 1, j), idx(i + 1, j + 1)); if (j < i) I.push(idx(i, j), idx(i + 1, j + 1), idx(i, j + 1));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}

// ---------- instancing ----------
let BOX1, CYL1;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), UP = V(0, 1, 0);
// Beams between point pairs [[a, b, thickness], ...] as one InstancedMesh (box or round section)
function beams(segs, m, round = false) {
  const geo = round ? (CYL1 ||= new THREE.CylinderGeometry(0.5, 0.5, 1, 12)) : (BOX1 ||= new THREE.BoxGeometry(1, 1, 1));
  const im = new THREE.InstancedMesh(geo, m, segs.length);
  segs.forEach(([a, b, t], i) => {
    _d.subVectors(b, a); const len = _d.length();
    _q.setFromUnitVectors(UP, _d.divideScalar(len)); _m.compose(_p.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(t, len, t)); im.setMatrixAt(i, _m);
  });
  im.computeBoundingSphere(); return im;
}
// Copies of one geometry: [[x, y, z, ry, sx = 1, sy = sx, sz = sx], ...]
function copies(geo, m, list) {
  const im = new THREE.InstancedMesh(geo, m, list.length), e = new THREE.Euler();
  list.forEach(([x, y, z, ry = 0, sx = 1, sy = sx, sz = sx], i) => { _m.compose(_p.set(x, y, z), _q.setFromEuler(e.set(0, ry, 0)), _s.set(sx, sy, sz)); im.setMatrixAt(i, _m); });
  im.computeBoundingSphere(); return im;
}
function put(g, geo, m, x = 0, y = 0, z = 0, ry = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; }
// Bake: merge plain meshes per material (few draw calls), keep instanced meshes, shadows on everything.
function finish(root) {
  root.updateMatrixWorld(true);
  const by = new Map(), inst = [], out = new THREE.Group();
  root.traverse(o => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) { inst.push(o); return; }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups(); g.applyMatrix4(o.matrixWorld);
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  for (const [m, gs] of by) out.add(new THREE.Mesh(mergeGeometries(gs), m));
  for (const o of inst) { o.matrixWorld.decompose(o.position, o.quaternion, o.scale); out.add(o); }
  out.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return out;
}

// ---------- shared landmark parts ----------
// Clock face (dial radius r) on the four sides of a square tower of half-width hw, centre height y
function clocks(g, hw, y, r, cx = 0, cz = 0) {
  const dial = mat('dial', () => std(0xf6efd8, 0.5, 0, { emissive: 0xfff0c8, emissiveIntensity: 0.12 }));
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2, x = Math.sin(a) * (hw + 0.12), z = Math.cos(a) * (hw + 0.12);
    put(g, new THREE.CircleGeometry(r, 32), dial, cx + x, y, cz + z, a);
    put(g, new THREE.RingGeometry(r, r * 1.12, 32), M.gold(), cx + x * 1.002, y, cz + z * 1.002, a);
  }
}
// Square lattice column: rings of 4 corners [[x, y, z] x 4], posts of thickness tp, X-bracing tb
function latticeCol(segs, rings, tp, tb) {
  for (let k = 0; k + 1 < rings.length; k++) for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, a = rings[k], b = rings[k + 1];
    segs.push([a[i], b[i], tp], [a[i], b[j], tb], [a[j], b[i], tb], [b[i], b[j], tb]);
  }
}
// Stack of plan boxes [[y0, y1, w, d], ...] in one material (setback towers)
function setbacks(g, tiers, m, x = 0, z = 0) { for (const [y0, y1, w, d] of tiers) put(g, boxG(w, y1 - y0, d), m, x, y0, z); }
const interp = (T, y) => { for (let i = 1; i < T.length; i++) if (y <= T[i][0]) { const [y0, a] = T[i - 1], [y1, b] = T[i]; return a + (b - a) * (y - y0) / (y1 - y0); } return T[T.length - 1][1]; };

// ================= the landmarks =================

// Eiffel Tower: 330 m to the antenna tip (2022), 300 m structure. Base square 125 m; platforms at
// 57.6 m (70.7 m square), 115.7 m (40.5 m square) and 276.1 m (16.5 m square). Puddled-iron lattice.
function eiffel() {
  const g = new THREE.Group(), iron = M.iron(), segs = [];
  const W = [[0, 62.5], [20, 52.5], [40, 43.5], [57.6, 35.3], [80, 28.6], [100, 23.6], [115.7, 20.2], [140, 16.4], [160, 13.9], [180, 11.9], [200, 10.3], [230, 8.3], [260, 6.5], [276.1, 5.6], [300, 3.2]];
  const w = y => interp(W, y);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {               // four legs, each 26 m square at the base
    const rings = [];
    for (let k = 0; k <= 12; k++) { const y = 115.7 * k / 12, o = w(y), i = o - (26 - 16 * y / 115.7); rings.push([V(sx * o, y, sz * o), V(sx * i, y, sz * o), V(sx * i, y, sz * i), V(sx * o, y, sz * i)]); }
    latticeCol(segs, rings, 2.2, 0.7);
  }
  const up = [];
  for (let k = 0; k <= 18; k++) { const y = 115.7 + (300 - 115.7) * k / 18, o = w(y); up.push([V(-o, y, -o), V(o, y, -o), V(o, y, o), V(-o, y, o)]); }
  latticeCol(segs, up, 1.4, 0.5);
  for (let f = 0; f < 4; f++) {                                       // decorative arches between the legs
    const rot = (x, y, z) => f === 0 ? V(x, y, z) : f === 1 ? V(z, y, -x) : f === 2 ? V(-x, y, -z) : V(-z, y, x);
    for (const inset of [0.6, 2.6]) {
      let prev = null;
      for (let k = 0; k <= 16; k++) { const t = PI * k / 16, y = 10 + 29 * Math.sin(t), p = rot(33 * Math.cos(t), y, w(y) - inset); if (prev) segs.push([prev, p, 1.2]); prev = p; }
    }
  }
  g.add(beams(segs, iron));
  for (const [z, hw] of [[-26.6, 35.4], [26.6, 35.4]]) put(g, boxG(hw * 2, 5, 17.6), iron, 0, 52.6, z);   // 1st floor ring
  for (const x of [-26.6, 26.6]) put(g, boxG(17.6, 5, 35.6), iron, x, 52.6, 0);
  put(g, boxG(70.7, 0.6, 70.7), M.stone('eifdeck', 0x8a7a68), 0, 57.6, 0);
  put(g, boxG(41, 4, 41), iron, 0, 111.7, 0);                                              // 2nd floor
  put(g, boxG(32, 5, 32), M.darkGlass(), 0, 115.7, 0);
  put(g, boxG(16.5, 6, 16.5), M.darkGlass(), 0, 273, 0);                                   // 3rd floor
  put(g, boxG(17.5, 1, 17.5), iron, 0, 279, 0);
  put(g, boxG(9, 10, 9), iron, 0, 280, 0);
  put(g, cylG(3, 3.5, 12, 12), iron, 0, 290, 0);
  put(g, cylG(0.3, 1.1, 28, 8), M.white(), 0, 302, 0);                                     // antennas to 330 m
  return g;
}

// Empire State Building: 443.2 m to the antenna tip, 381 m roof, 102 floors. Lot 129 m (along 34th St) x 57 m.
function empireState() {
  const g = new THREE.Group(), f = M.face('esb', '#c9bfa9', '#38414a', 1.55, 3.81, 0.5, 0.7);
  setbacks(g, [[0, 25, 57, 129], [25, 82, 54, 98], [82, 125, 48, 72], [125, 264, 42, 57], [264, 298, 34, 44], [298, 320, 26, 30]], f);
  put(g, facet(latheG([[8, 320], [8, 334], [6.5, 336], [6, 365], [4, 373], [2.6, 381]], 8, PI / 8)), mat('esbmast', () => std(0xd8d2c4, 0.5, 0.3)));
  put(g, cylG(0.35, 1.3, 62, 8), M.steel(), 0, 381, 0);
  return g;
}

// Chrysler Building: 318.9 m to the spire tip, 77 floors; terraced stainless-steel crown with sunburst arches.
function chrysler() {
  const g = new THREE.Group(), f = M.face('chr', '#d2cdc4', '#2f3940', 1.6, 3.7, 0.55, 0.65);
  setbacks(g, [[0, 60, 62, 62], [60, 85, 52, 52], [85, 236, 40, 40]], f);
  const prof = [[28, 236]]; let r = 28, y = 236;
  for (const step of [5.5, 4.2, 3.6, 3.2, 2.8, 2.4, 2.1]) { for (let k = 1; k <= 4; k++) prof.push([r - step + step * Math.cos(k * PI / 8), y + step * 1.5 * Math.sin(k * PI / 8)]); r -= step; y += step * 1.5; }
  put(g, facet(latheG(prof, 4, PI / 4)), M.steel());
  put(g, facet(latheG([[2.6, y], [0.15, 318.9]], 4, PI / 4)), M.steel());
  return g;
}

// Elizabeth Tower (Big Ben): 96 m, 12 m square shaft, 7 m clock dials centred near 55 m, cast-iron spire.
function elizabethTower() {
  const g = new THREE.Group(), lime = M.face('bigben', '#cdb88f', '#6d6656', 1.5, 4, 0.3, 0.8, { roughness: 0.85, metalness: 0 });
  put(g, boxG(12, 50, 12), lime);
  put(g, boxG(13, 12, 13), lime, 0, 50, 0);
  clocks(g, 6.5, 56, 3.5);
  for (const [x, z] of [[-6, -6], [6, -6], [6, 6], [-6, 6]]) put(g, loftG([[1.4, 1.4, 62], [1.4, 1.4, 66], [0.1, 0.1, 70]]), M.gold(), x, 0, z);
  put(g, boxG(11, 9, 11), M.face('belfry', '#cdb88f', '#2b2a27', 2.75, 9, 0.5, 0.75, { roughness: 0.85, metalness: 0 }), 0, 62, 0);
  put(g, loftG([[11.4, 11.4, 71], [9, 9, 73], [6, 6, 84], [3.2, 3.2, 88], [2, 2, 91], [0.2, 0.2, 96]]), M.slate());
  put(g, boxG(6.4, 1, 6.4), M.gold(), 0, 84, 0);
  return g;
}

// Palace of Westminster river front: 266 m x ~100 m (OSM footprint 273 x 102 m), Victoria Tower 98.5 m,
// Central Tower 91 m. Local -z = river (east) facade, +x = south.
function westminster() {
  const g = new THREE.Group(), lime = M.face('wpal', '#cbb68e', '#5d5a4e', 3, 4.6, 0.45, 0.7, { roughness: 0.85, metalness: 0 });
  put(g, boxG(273, 24, 22), lime, 0, 0, -40);                          // river range
  put(g, boxG(250, 22, 22), lime, -5, 0, 38);                          // west range
  for (const x of [-120, -60, 0, 60, 118]) put(g, boxG(20, 20, 60), lime, x, 0, 0); // cross ranges
  put(g, boxG(273, 12, 100), lime, 0, 0, 0);
  for (const z of [-40, 38]) put(g, loftG([[273, 22, 24], [270, 4, 30]]), M.slate(), 0, 0, z);
  const pins = []; for (let x = -133; x <= 133; x += 6.6) pins.push([x, 24, -51], [x, 24, -29]);
  g.add(copies(loftG([[1, 1, 0], [1, 1, 3], [0.1, 0.1, 6]]), lime, pins));
  for (let x = -130; x <= 130; x += 33) put(g, loftG([[4, 4, 0], [4, 4, 32], [0.3, 0.3, 40]]), lime, x, 0, -51);
  put(g, cylG(9, 9, 62, 8), lime, -5, 0, 0);                           // Central Tower, octagonal, 91 m
  put(g, facet(latheG([[9, 62], [7, 64], [0.3, 91]], 8)), lime, -5, 0, 0);
  put(g, boxG(23, 88, 23), lime, 120, 0, 42);                          // Victoria Tower, 98.5 m
  for (const [x, z] of [[-10.5, -10.5], [10.5, -10.5], [10.5, 10.5], [-10.5, 10.5]]) put(g, facet(latheG([[2.2, 0], [2.2, 92], [0.2, 98.5]], 8)), lime, 120 + x, 0, 42 + z);
  put(g, loftG([[21, 21, 88], [4, 4, 92]]), M.slate(), 120, 0, 42);
  return g;
}

// London Eye: 135 m tall, 120 m wheel, 32 capsules, cantilevered from an A-frame on the land side.
function londonEye() {
  const g = new THREE.Group(), st = M.steel(), hub = 70, R = 60, segs = [];
  for (const z of [-3, 3]) put(g, new THREE.TorusGeometry(R, 0.7, 8, 96).translate(0, hub, z), st);
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * 2 * PI, p = (r, z) => V(r * Math.cos(a), hub + r * Math.sin(a), z);
    segs.push([p(R, -3), p(R, 3), 0.5], [p(3, -9), p(R, -3), 0.18], [p(3, 9), p(R, 3), 0.18]);
  }
  for (const s of [-1, 1]) segs.push([V(s * 10, 0, 30), V(0, hub, 4), 2.4]);
  segs.push([V(0, hub, 9), V(0, 0, 80), 0.3]);
  g.add(beams(segs, st));
  put(g, new THREE.CylinderGeometry(3, 3, 20, 16).rotateX(PI / 2).translate(0, hub, 0), st);
  const caps = []; for (let i = 0; i < 32; i++) { const a = i / 32 * 2 * PI; caps.push([(R + 3.3) * Math.cos(a), hub + (R + 3.3) * Math.sin(a), 0]); }
  g.add(copies(new THREE.SphereGeometry(1, 16, 10).scale(2.2, 2.2, 4), M.glass(), caps));
  put(g, boxG(30, 1, 14), M.stone('eyedeck', 0x8d8a84), 0, 0, 0);
  return g;
}

// Shibuya Scramble Square: 229.7 m, 47 floors (2019), above Shibuya Station.
function scramble() {
  const g = new THREE.Group(), f = M.face('ss', '#e4e7ea', '#3c5468', 1.2, 4.2, 0.82, 0.8);
  put(g, boxG(70, 58, 56), M.face('ssp', '#d6d9dc', '#455a6b', 3, 5, 0.7, 0.55));
  put(g, boxG(58, 150, 46), f, 0, 58, 0);
  put(g, loftG([[58, 46, 208], [62, 50, 222], [62, 50, 226]]), f);
  put(g, boxG(54, 3.7, 42), M.darkGlass(), 0, 226, 0);
  return g;
}

// Burj Khalifa: 828 m. Y-shaped plan of three wings around a hexagonal core; 27 setbacks spiral upward,
// then the spire. Glass with stainless-steel fins.
function burj() {
  const g = new THREE.Group(), f = M.face('burj', '#c3cad0', '#55697c', 1.4, 3.9, 0.55, 0.9, { metalness: 0.7, roughness: 0.18 });
  const hw = 13;
  for (let k = 0; k < 3; k++) {
    let y0 = 0;
    for (let j = 0; j < 9; j++) {
      const L = 64 - j * 5.6, y1 = 40 + (j * 3 + k) * 20.5, s = new THREE.Shape();
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, L - hw); s.absarc(0, L - hw, hw, 0, PI, false); s.closePath();
      put(g, prismG(s, y1 - y0, 6), f, 0, y0, 0, k * 2 * PI / 3); y0 = y1;
    }
  }
  put(g, cylG(16, 18, 600, 6), f);
  put(g, cylG(9, 12, 60, 12), f, 0, 600, 0);
  put(g, cylG(5, 8, 80, 12), M.steel(), 0, 660, 0);
  put(g, cylG(0.4, 4.5, 88, 12), M.steel(), 0, 740, 0);
  return g;
}

// Marina Bay Sands: three 57-storey hotel towers (194 m), the east leg of each curving out; SkyPark 340 m long,
// 38 m wide, cantilevered 67 m past Tower 3. Local -z = north-north-east (Tower 3 and the cantilever).
function marinaBaySands() {
  const g = new THREE.Group(), f = M.face('mbs', '#d9dde0', '#4d6273', 3, 3.3, 0.95, 0.7), tw = 38;
  const curve = []; for (let k = 0; k <= 12; k++) { const y = 194 * k / 12; curve.push([3 + 34 * (1 - y / 194) ** 2.2, y]); }
  for (const z of [114, 0, -114]) {
    put(g, sideG([[-17, 0], [-3, 0], [-3, 192], [-17, 192]], tw), f, 0, 0, z);
    put(g, sideG([...curve.map(([x, y]) => [x + 13, y]), ...curve.slice().reverse().map(([x, y]) => [x, y])], tw), f, 0, 0, z);
  }
  const s = poly([[-19, 140], [19, 140], [19, -170], [0, -200], [-19, -170]]);
  put(g, prismG(s, 8), M.white(), 0, 192, 0);
  put(g, boxG(10, 0.5, 150), mat('pool', () => new THREE.MeshPhysicalMaterial({ color: 0x3aa6c8, roughness: 0.05, metalness: 0.1 })), -12, 200, -60);
  put(g, boxG(20, 2.5, 200), M.darkGlass(), 6, 200, 10);
  return g;
}

// Bank of China Tower: 367.4 m to the mast tips, 315 m roof. 52 m square split by its diagonals into four
// triangular glass shafts ending at different heights with sloped tops; white cross-bracing on the faces.
function bankOfChina() {
  const g = new THREE.Group(), f = M.face('boc', '#9fb2c0', '#2e4456', 2, 4, 0.9, 0.8, { metalness: 0.75, roughness: 0.15 }), segs = [], h = 26;
  const c = [[-26, -26], [26, -26], [26, 26], [-26, 26]];
  [180, 245, 120, 305].forEach((top, i) => {
    const [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4];
    const A0 = V(ax, 0, az), B0 = V(bx, 0, bz), C0 = V(0, 0, 0), A1 = V(ax, top - h, az), B1 = V(bx, top - h, bz), C1 = V(0, top, 0);
    put(g, polyG([[A0, B0, B1, A1], [B0, C0, C1, B1], [C0, A0, A1, C1], [A1, B1, C1], [A0, C0, B0]]), f);
    const n = Math.round((top - h) / 52), dy = (top - h) / n;
    for (let k = 0; k < n; k++) { const y0 = k * dy, y1 = y0 + dy; segs.push([V(ax, y0, az), V(bx, y1, bz), 1], [V(bx, y0, bz), V(ax, y1, az), 1], [V(ax, y1, az), V(bx, y1, bz), 1]); }
    segs.push([V(ax, 0, az), V(ax, top - h, az), 1.4], [A1, C1, 1], [B1, C1, 1]);
  });
  g.add(beams(segs, M.white()));
  for (const x of [-3, 3]) put(g, cylG(0.4, 0.9, 64, 8), M.steel(), x, 303, -2);
  put(g, boxG(64, 6, 64), M.blocks('bocpod', 0x8d877e), 0, 0, 0);
  return g;
}

// Sydney Opera House: 183 m x 120 m on a granite podium; tallest shell 67 m above sea level. Shells are
// spherical triangles (Utzon's "spherical solution"). Local -z = the harbour end (Bennelong Point).
function operaHouse() {
  const g = new THREE.Group(), tiles = M.tiles(), pod = M.blocks('opod', 0xc9b59c, 3), P = 6;
  put(g, boxG(118, P, 170), pod, 0, 0, -10);
  for (let k = 0; k < 8; k++) put(g, boxG(92, P - k * 0.75, 3.2), pod, -6, 0, 76 + k * 3.2);
  const shell = (x, z, w, h, d, back = false) => {
    const s = back ? -1 : 1, B = V(x, P, z + s * d / 2), T = V(x, P + h, z - s * d / 2), Fl = V(x - w / 2, P, z - s * d * 0.28), Fr = V(x + w / 2, P, z - s * d * 0.28);
    put(g, sphTriG(B, T, Fr, V(x - w, P - h * 0.4, z)), tiles);
    put(g, sphTriG(B, T, Fl, V(x + w, P - h * 0.4, z)), tiles);
    const m = B.clone().sub(T).setLength(1.5);
    put(g, polyG([[T.clone().add(m), Fl.clone().add(m), Fr.clone().add(m)]]), mat('operaGlass', () => new THREE.MeshPhysicalMaterial({ color: 0x6b5d50, roughness: 0.08, metalness: 0.55, side: THREE.DoubleSide })));
  };
  for (const [hx, k] of [[-27, 1], [25, 0.88]]) {
    shell(hx, -66 * k, 32 * k, 34 * k, 38 * k); shell(hx, -42 * k, 40 * k, 50 * k, 50 * k);
    shell(hx, -10 * k, 46 * k, 61 * k, 58 * k); shell(hx, 30 * k, 36 * k, 40 * k, 36 * k, true);
  }
  shell(-44, 62, 16, 18, 18); shell(-44, 74, 14, 15, 15, true);       // Bennelong restaurant
  return g;
}

// Colosseum: outer ellipse 189 x 156 m, 48 m high; 80 bays per storey (arcades 10.5 / 11.85 / 11.6 m, attic).
// The outer ring survives on the north side only; elsewhere the second ring shows. Major axis along local x.
function colosseum() {
  const g = new THREE.Group(), trav = M.blocks('trav', 0xd8c8a6, 3), a = 94.5, b = 78, N = 80;
  const ring = (ao, bo, tiers, keep) => {
    const out = new Map();
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N * 2 * PI; if (!keep(t)) continue;
      const t0 = i / N * 2 * PI, t1 = (i + 1) / N * 2 * PI, p0 = V(ao * Math.cos(t0), 0, bo * Math.sin(t0)), p1 = V(ao * Math.cos(t1), 0, bo * Math.sin(t1));
      const w = p0.distanceTo(p1), ry = -Math.atan2(p1.z - p0.z, p1.x - p0.x), m = p0.add(p1).multiplyScalar(0.5);
      tiers.forEach(([y, h], k) => { if (!out.has(k)) out.set(k, []); out.get(k).push([m.x, y, m.z, ry, w / 6.8, 1, 1]); });
    }
    tiers.forEach(([, h, ow, oh], k) => out.has(k) && g.add(copies(archesG(6.85, h, 2.4, [[0, ow, oh]], 6), trav, out.get(k))));
  };
  const north = t => Math.sin(t) < -0.12;
  ring(a - 1.2, b - 1.2, [[0, 10.5, 4.2, 7.2], [10.5, 11.85, 4.2, 6.6], [22.35, 11.6, 4.2, 6.4]], north);
  ring(a - 8, b - 8, [[0, 10.5, 4.2, 7.4], [10.5, 11.85, 4.2, 6.8]], () => true);
  const t0 = PI + Math.asin(0.12), t1 = 2 * PI - Math.asin(0.12);
  put(g, ellipseWallG(a, b, 2.4, 33.95, 48, t0, t1, 48), trav);                       // attic
  for (const y of [10.5, 22.35, 33.95]) put(g, ellipseWallG(a + 0.4, b + 0.4, 3.2, y - 0.9, y, t0, t1, 48), trav);
  put(g, ellipseWallG(a - 7, b - 7, 3, 22.35, 31, 0, 2 * PI, 80), trav);               // second ring top
  const cav = M.brick('cav', 0xb69a7c);                                                  // cavea, stripped to brick vaults
  for (let k = 0; k < 6; k++) put(g, ellipseWallG(a - 11 - k * 7.5, b - 11 - k * 7.5, 7.6, 0, 29 - k * 4.6, 0, 2 * PI, 64), cav);
  put(g, ellipseWallG(41.5, 24, 1, 0, 1.2, 0, 2 * PI, 48), cav);
  put(g, boxG(40, 1.2, 30), M.roof('arena', 0x9a7a55, { roughness: 1 }), 18, 0, 0);    // partial arena floor
  const buttress = M.brick('butt', 0xa56e50);
  for (const t of [t0, t1]) put(g, boxG(6, 44, 8), buttress, (a - 3) * Math.cos(t), 0, (b - 3) * Math.sin(t), -t);
  return g;
}

// U.S. Bank Tower, Los Angeles: 310.3 m, 73 floors; cylinder with stepped square setbacks and a glass crown.
function usBank() {
  const g = new THREE.Group(), f = M.face('usb', '#b9ab96', '#2d3640', 1.5, 3.9, 0.45, 0.65);
  put(g, cylG(24, 24, 262, 32), f);
  for (const [a, top] of [[0, 222], [PI / 2, 246], [PI, 222], [1.5 * PI, 246]]) put(g, boxG(20, top, 8), f, Math.sin(a) * 25, 0, Math.cos(a) * 25, a);
  put(g, cylG(20, 20, 18, 32), f, 0, 262, 0);
  put(g, cylG(16.5, 16.5, 26, 32), M.glass(), 0, 280, 0);
  put(g, cylG(15, 15, 4.3, 32), M.white(), 0, 306, 0);
  return g;
}

// Transamerica Pyramid: 260 m, 48 floors; 53 m base tapering, 64 m spire, elevator/stair wings on two faces.
function transamerica() {
  const g = new THREE.Group(), f = M.face('ta', '#efece5', '#3b4650', 1.7, 3.8, 0.45, 0.55);
  put(g, boxG(42, 12, 42), M.darkGlass());
  for (let k = -4; k <= 4; k++) for (const [x, z] of [[k * 5.8, -25.5], [k * 5.8, 25.5], [-25.5, k * 5.8], [25.5, k * 5.8]]) put(g, loftG([[2.2, 2.2, 0], [1.2, 1.2, 12]]), M.white(), x, 0, z);
  put(g, loftG([[53, 53, 12], [17, 17, 196]]), f);
  put(g, loftG([[17, 17, 196], [0.5, 0.5, 260]]), M.white());
  for (const s of [-1, 1]) put(g, boxG(7, 104, 11), M.white(), s * 15.5, 104, 0);
  return g;
}

// Sagrada Familia: Jesus Christ tower 172.5 m (completed 2026), Mary 138 m, four Evangelists 135 m,
// eight apostle spires 98-112 m on the Nativity (NE) and Passion (SW) facades. Nave 90 m long.
// Local -z = Glory facade (south-east), -x = Nativity.
function sagrada() {
  const g = new THREE.Group(), sand = M.stone('sagr', 0xc8b391), pale = M.stone('sagw', 0xdedad0);
  put(g, boxG(45, 30, 90), sand, 0, 0, 0);
  put(g, loftG([[17, 90, 30], [17, 90, 45], [2, 88, 60]]), sand);
  put(g, boxG(60, 30, 30), sand, 0, 0, 10);
  put(g, loftG([[60, 17, 30], [60, 17, 45], [58, 2, 60]]), sand, 0, 0, 10);
  put(g, cylG(22, 22, 42, 24), sand, 0, 0, 45);
  const spire = (x, z, h, r, m) => {
    put(g, latheG([[r, 0], [r * 0.98, h * 0.3], [r * 0.85, h * 0.55], [r * 0.6, h * 0.75], [r * 0.32, h * 0.88], [r * 0.12, h * 0.95], [0.1, h]], 12), m, x, 0, z);
  };
  spire(0, 10, 160, 14, pale);                                         // Jesus Christ, cross to 172.5 m
  put(g, boxG(2.4, 13.5, 2.4), M.white(), 0, 159, 10); put(g, boxG(13.5, 2.4, 2.4), M.white(), 0, 167, 10); put(g, boxG(2.4, 2.4, 13.5), M.white(), 0, 167, 10);
  for (const [x, z] of [[-16, -6], [16, -6], [-16, 26], [16, 26]]) { spire(x, z, 130, 7, pale); put(g, new THREE.SphereGeometry(2.2, 12, 8), M.gold(), x, 132, z); }
  spire(0, 44, 130, 9, pale); put(g, new THREE.IcosahedronGeometry(3.5, 0), M.white(), 0, 134, 44);
  for (const [x, hs] of [[-34, [98, 107, 107, 98]], [34, [98, 112, 112, 98]]]) hs.forEach((h, i) => {
    const z = 10 + (i - 1.5) * 11; spire(x, z, h - 12, 5, sand);
    put(g, latheG([[1.6, 0], [2.6, 3], [2.2, 8], [0.4, 12]], 8), mat('mosaic', () => std(0xc9a13a, 0.4, 0.5)), x, h - 12, z);
  });
  return g;
}

// Hagia Sophia: main dome 31.2 m across, crown 55.6 m above the floor; semi-domes east and west; four minarets
// (about 60 m). Local -z = west entrance, +z = apse.
function hagiaSophia() {
  const g = new THREE.Group(), o = M.stone('hagia', 0xd29d76), lead = M.lead();
  put(g, boxG(70, 22, 76), o); put(g, boxG(62, 15, 12), o, 0, 0, -44);
  put(g, boxG(36, 34, 36), o);
  for (const x of [-27, 27]) put(g, loftG([[10, 30, 0], [10, 30, 36], [6, 26, 40]]), o, x, 0, 0);
  put(g, cylG(16.6, 16.6, 6, 40), M.face('drum', '#d29d76', '#2a2622', 2.6, 6, 0.4, 0.6, { roughness: 0.9, metalness: 0 }), 0, 34, 0);
  put(g, domeG(16.6, 0.94, 32), lead, 0, 40, 0);
  for (const [z, ph] of [[18, 0], [-18, PI]]) put(g, new THREE.SphereGeometry(16, 24, 12, ph, PI, 0, PI / 2).scale(1, 0.8, 1), lead, 0, 30, z);
  for (const [z, ph] of [[34, 0], [-34, PI]]) put(g, new THREE.SphereGeometry(8, 16, 8, ph, PI, 0, PI / 2), lead, 0, 22, z);
  for (const [x, z, r] of [[-42, -42, 2], [42, -42, 2], [-42, 38, 2], [42, 38, 2.6]]) {
    put(g, cylG(r, r * 1.1, 52, 12), M.stone('minaret', 0xe4dccd), x, 0, z);
    for (const y of [30, 44]) put(g, cylG(r + 1, r + 1, 1.2, 12), M.white(), x, y, z);
    put(g, cylG(0.1, r + 0.2, 11, 12), lead, x, 52, z);
  }
  return g;
}

// Gateway of India: 26 m basalt triumphal arch (1924), front 44 m wide (OSM), facing the harbour.
function gatewayOfIndia() {
  const g = new THREE.Group(), b = M.blocks('gate', 0xcaa877, 2);
  put(g, archesG(21, 20, 15, [[0, 9, 16.5]]), b);
  for (const s of [-1, 1]) put(g, archesG(11.5, 14, 15, [[0, 4.5, 9.5]]), b, s * 16.25, 0, 0);
  put(g, boxG(22, 2.5, 16), b, 0, 20, 0);
  for (const [x, z] of [[-9.5, -6.5], [9.5, -6.5], [9.5, 6.5], [-9.5, 6.5]]) { put(g, cylG(1.4, 1.4, 2.4, 8), b, x, 22.5, z); put(g, domeG(1.5, 1.4, 12), b, x, 24.9, z); }
  for (const s of [-1, 1]) for (const z of [-6.5, 6.5]) { put(g, cylG(1, 1, 2, 8), b, s * 21, 14, z); put(g, domeG(1.1, 1.3, 10), b, s * 21, 16, z); }
  return g;
}

// India Gate: 42 m war memorial arch (1931), 9.1 m main opening, red Bharatpur stone base, buff sandstone.
function indiaGate() {
  const g = new THREE.Group(), buff = M.blocks('igate', 0xd0aa86, 2.4), red = M.blocks('igred', 0xa8634c, 2.4);
  put(g, loftG([[27, 17, 0], [27, 17, 0.8], [25, 14, 0.8], [25, 14, 1.6]]), red);
  put(g, archesG(22, 29, 10, [[0, 9.1, 21]]), buff, 0, 1.6, 0);
  put(g, boxG(23.4, 1.6, 11.4), buff, 0, 30.6, 0);
  put(g, boxG(20, 4, 9), buff, 0, 32.2, 0); put(g, boxG(17, 3, 7.5), buff, 0, 36.2, 0);
  put(g, latheG([[2.8, 0], [4.2, 1.8], [4.4, 2.6], [0.1, 2.8]], 24), buff, 0, 39.2, 0);
  return g;
}

// Oriental Pearl Tower: 468 m. Three 9 m columns, three inclined legs, lower sphere 50 m (centre ~93 m),
// upper sphere 45 m (centre ~263 m), space module at ~342 m, antenna mast.
function orientalPearl() {
  const g = new THREE.Group(), con = M.stone('pearl', 0xe4e2de), pink = M.pink(), segs = [], legs = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 2 * PI / 3, b = a + PI / 3;
    segs.push([V(7 * Math.cos(a), 0, 7 * Math.sin(a)), V(7 * Math.cos(a), 300, 7 * Math.sin(a)), 9]);
    legs.push([V(44 * Math.cos(b), 0, 44 * Math.sin(b)), V(12 * Math.cos(b), 74, 12 * Math.sin(b)), 7]);
    put(g, new THREE.SphereGeometry(6, 16, 12), pink, 11 * Math.cos(b), 150 + k * 40, 11 * Math.sin(b));
    put(g, new THREE.SphereGeometry(5, 16, 12), pink, 11 * Math.cos(a + PI), 170 + k * 40, 11 * Math.sin(a + PI));
  }
  g.add(beams([...segs, ...legs], con, true));
  put(g, new THREE.SphereGeometry(25, 32, 20), pink, 0, 93, 0);
  put(g, new THREE.SphereGeometry(22.5, 32, 20), pink, 0, 263, 0);
  put(g, cylG(4.5, 5, 50, 16), con, 0, 285, 0);
  put(g, new THREE.SphereGeometry(7, 20, 14), pink, 0, 342, 0);
  put(g, cylG(1.8, 3, 60, 12), M.steel(), 0, 348, 0);
  put(g, cylG(0.3, 1.8, 60, 8), M.steel(), 0, 408, 0);
  return g;
}

// Tiananmen (Gate of Heavenly Peace): 34.7 m to the ridge; 13 m red base with five arched tunnels (OSM
// footprint 118 x 39 m), nine-bay hall with a double-eaved yellow glazed roof. Faces south.
function tiananmen() {
  const g = new THREE.Group(), red = M.stone('tam', 0x9e2b22), gold = M.roof('tamr', 0xe1a92e, { roughness: 0.45, metalness: 0.15 });
  put(g, archesG(118, 13, 39, [[0, 5.3, 8.8], [-17, 4.4, 7.6], [17, 4.4, 7.6], [-33, 4, 6.6], [33, 4, 6.6]]), red);
  put(g, boxG(118.6, 0.4, 39.6), M.stone('tampave', 0xa49c90), 0, 12.8, 0);
  for (const z of [-19.6, 19.6]) put(g, boxG(118.6, 1.1, 0.4), M.white(), 0, 13.2, z);
  for (const x of [-59.1, 59.1]) put(g, boxG(0.4, 1.1, 39.6), M.white(), x, 13.2, 0);
  put(g, boxG(70, 1, 34), M.white(), 0, 13, 0);
  const cols = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) if (i === 0 || i === 9 || j === 0 || j === 4) cols.push([-29.25 + i * 6.5, 14, -12 + j * 6]);
  g.add(copies(cylG(0.6, 0.6, 9, 12), M.red(), cols));
  put(g, boxG(54, 9, 20), M.face('tamh', '#9e2b22', '#3e3a2a', 1.5, 3, 0.7, 0.75, { roughness: 0.8, metalness: 0 }), 0, 14, 0);
  put(g, loftG([[71, 35, 22.4], [64, 29, 23.6], [58, 23, 25]]), gold);                 // lower eave
  put(g, boxG(52, 3.6, 18), M.red(), 0, 25, 0);
  put(g, loftG([[63, 28, 28.4], [55, 21, 30], [44, 9, 33], [40, 1, 34.7]]), gold);     // upper roof
  for (const s of [-1, 1]) put(g, boxG(1.2, 1.6, 2), gold, s * 20.5, 33.1, 0);
  return g;
}

// St Basil's Cathedral: 47.5 m central tent tower, eight chapels with onion domes, bell tower. Brick red with white trim.
function stBasil() {
  const g = new THREE.Group(), brick = M.brick('basil', 0xb4523c), wht = M.white();
  put(g, boxG(46, 9, 42), brick); put(g, boxG(46.4, 0.5, 42.4), wht, 0, 8.5, 0); put(g, boxG(45.6, 0.3, 41.6), mat('basilroof', () => std(0x5d7a58, 0.6, 0.3)), 0, 9, 0);
  put(g, cylG(7.5, 7.5, 21, 8), brick, 0, 9, 0);
  put(g, cylG(6.6, 6.6, 4, 8), wht, 0, 30, 0);
  put(g, facet(latheG([[6, 34], [4.4, 38], [1.2, 44.4]], 8, 0, false)), mat('tent', () => stripes('#f3efe4', '#3f8a5c', 0, 16)), 0, 0, 0);
  put(g, onionG(1.5, 3.4), M.gold(), 0, 44, 0);
  const domes = [['#2e7d4f', '#e9c74a'], ['#c0392b', '#f1f1e6'], ['#1f5f9e', '#f1f1e6'], ['#d4a017', '#2e7d4f'], ['#c0392b', '#2e7d4f'], ['#3f8a5c', '#f1f1e6'], ['#e07b2a', '#2e7d4f'], ['#1f5f9e', '#e9c74a']];
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4, big = i % 2 === 0, d = big ? 15 : 14, x = Math.sin(a) * d, z = Math.cos(a) * d;
    const [r, top, dr, dh] = big ? [4.8, 26, 4.2, 9] : [3.2, 20, 2.8, 6];
    put(g, cylG(r, r, top - 9, 8), brick, x, 9, z);
    put(g, cylG(r * 0.72, r * 0.72, 3, 12), wht, x, top, z);
    put(g, onionG(dr, dh), mat('onion' + i, () => stripes(...domes[i], 1, 8)), x, top + 3, z);
    put(g, boxG(0.3, 2, 0.3), M.gold(), x, top + 3 + dh, z);
  }
  put(g, boxG(7, 18, 7), brick, 24, 0, 18); put(g, cylG(3.2, 3.2, 6, 8), wht, 24, 18, 18);
  put(g, facet(latheG([[3.2, 24], [0.6, 33]], 8, 0, false)), mat('tent', () => stripes('#f3efe4', '#3f8a5c', 0, 16)), 24, 0, 18);
  put(g, onionG(0.9, 2.6), M.gold(), 24, 33, 18);
  return g;
}

// Christ the Redeemer: 30 m statue (arm span 28 m) on an 8 m pedestal, on Corcovado (the terrain is the mountain).
function christ() {
  const g = new THREE.Group(), s = M.soap();
  put(g, boxG(16, 1, 16), M.stone('corc', 0xbab4a8));
  put(g, loftG([[9.5, 9.5, 1], [8.2, 8.2, 8]]), s);
  put(g, latheG([[2.6, 8], [3.1, 12], [2.9, 20], [3, 26], [3.4, 30], [3.5, 31.4], [2.4, 32.4], [1.05, 33], [1.05, 34]], 16).scale(1.15, 1, 0.75), s);
  put(g, new THREE.SphereGeometry(1.55, 16, 12).scale(1, 1.2, 1.05), s, 0, 35.6, 0);
  for (const sgn of [-1, 1]) {
    put(g, cylG(0.6, 0.95, 12.2, 10).rotateZ(-sgn * PI / 2), s, sgn * 1.8, 31.3, 0);
    put(g, sideG([[1.5, 31.8], [12.6, 31], [12.2, 29.8], [3, 26.2], [1.5, 25.6]].map(([x, y]) => [sgn * x, y]), 1.3), s);
    put(g, boxG(0.5, 2.1, 1), s, sgn * 14, 29.7, 0);
  }
  return g;
}

// Giza pyramids (heights as they stand today; bases from Lehner & Hawass). Sandstone-coloured limestone courses.
const pyramid = (base, topW, h, cap = 0) => () => {
  const g = new THREE.Group(), lime = M.blocks('giza', 0xcfae78, 2.6);
  put(g, loftG([[base, base, 0], [topW, topW, h]]), lime);
  if (cap) { const y = h - cap, w = topW + (base - topW) * cap / h; put(g, loftG([[w + 0.6, w + 0.6, y], [topW + 0.4, topW + 0.4, h + 0.2]]), M.stone('casing', 0xe2cfa6)); }
  return g;
};
// Great Sphinx: 73 m long, 19 m wide, 20 m high, faces east (local -z).
function sphinx() {
  const g = new THREE.Group(), lime = M.blocks('sph', 0xc9a46e, 2.6);
  put(g, loftG([[19, 56, 0], [17, 54, 10], [12, 46, 12]]), lime, 0, 0, 8);                  // body
  for (const x of [-4.5, 4.5]) put(g, loftG([[3.6, 15, 0], [3.2, 14.5, 2.6]]), lime, x, 0, -26.5); // paws
  put(g, loftG([[11, 10, 0], [10, 9, 9], [7, 7, 11]]), lime, 0, 0, -16);                    // chest / neck
  put(g, loftG([[9, 7, 11], [9, 7, 16], [5, 5, 20]]), lime, 0, 0, -16.5);                   // head with nemes
  return g;
}

// Willis Tower: 442.1 m roof (527 m with antennas), 108 floors; nine 22.86 m square tubes ending at
// floors 50, 66, 90 and 108.
function willis() {
  const g = new THREE.Group(), f = M.face('wil', '#1d1f22', '#3b3429', 1.52, 3.9, 0.85, 0.75, { metalness: 0.6, roughness: 0.3 }), t = 22.86;
  const H = [[205, 368, 270], [442, 442, 368], [270, 368, 205]];      // rows N..S, cols W..E
  H.forEach((row, r) => row.forEach((h, c) => put(g, boxG(t, h, t), f, (c - 1) * t, 0, (r - 1) * t)));
  for (const x of [-26, 3]) put(g, cylG(0.5, 1.6, 85, 8), M.white(), x, 442, 0);
  return g;
}

// CN Tower: 553.3 m. Hexagonal core with three tapering Y legs, main pod at 342-360 m, SkyPod at 447 m, antenna.
function cnTower() {
  const g = new THREE.Group(), con = M.blocks('cn', 0xc6c1b8, 4), L = [];
  for (let k = 0; k <= 14; k++) { const y = 335 * k / 14, r = 6 + 24 * (1 - y / 335) ** 1.6; L.push([8 - 3 * y / 335, r, y, 0, -r / 2]); }
  for (let k = 0; k < 3; k++) put(g, loftG(L), con, 0, 0, 0, k * 2 * PI / 3);
  put(g, cylG(7, 9, 335, 6), con);
  put(g, latheG([[7, 330], [17, 334], [19.5, 338], [19.5, 341], [17.5, 343], [18.8, 347], [18.8, 352], [16, 357], [7, 361]], 32), M.white());
  put(g, cylG(19.6, 19.6, 3.4, 32), M.darkGlass(), 0, 347.5, 0);
  put(g, cylG(5, 7, 108, 6), con, 0, 340, 0);
  put(g, latheG([[5, 443], [7.5, 446], [7.5, 451], [4, 455]], 24), M.white());
  put(g, cylG(1.9, 2.8, 28, 12), M.steel(), 0, 455, 0); put(g, cylG(1, 1.9, 40, 12), M.steel(), 0, 483, 0);
  put(g, cylG(0.25, 1, 30.3, 8), M.red(), 0, 523, 0);
  return g;
}

// Brandenburg Gate: colonnade 34 m wide (OSM) x 11 m deep, 26 m with the Quadriga; twelve 15 m Doric columns,
// five passages (centre 5.65 m). Faces east (Quadriga towards Unter den Linden).
function brandenburg() {
  const g = new THREE.Group(), s = M.blocks('bbt', 0xd9ceb4, 2.4), cu = M.copper(), xs = [-14.8, -9.25, -3.7, 3.7, 9.25, 14.8], cols = [];
  put(g, boxG(34, 1, 13), s);
  for (const x of xs) { put(g, boxG(1.3, 13.6, 9), s, x, 1, 0); cols.push([x, 1, -4.6], [x, 1, 4.6]); }
  g.add(copies(cylG(0.78, 0.875, 13.6, 16), s, cols));
  put(g, boxG(34, 4, 12), s, 0, 14.6, 0); put(g, boxG(34.8, 0.8, 12.8), s, 0, 18.6, 0);
  put(g, boxG(24, 2.6, 9.6), s, 0, 19.4, 0); put(g, boxG(9, 1.3, 5), s, 0, 22, 0);
  for (const x of [-2.1, -0.7, 0.7, 2.1]) {                            // Quadriga, horses facing east (-z)
    put(g, boxG(0.9, 1.1, 2.8), cu, x, 24.4, -0.6);
    for (const [dx, dz] of [[-0.3, -1.6], [0.3, -1.6], [-0.3, 0.5], [0.3, 0.5]]) put(g, boxG(0.22, 1.1, 0.22), cu, x + dx, 23.3, dz);
    put(g, boxG(0.5, 1.5, 0.6), cu, x, 25.1, -2.2);
  }
  put(g, boxG(3, 1.4, 1.6), cu, 0, 23.3, 1.6); put(g, cylG(0.4, 0.6, 2.6, 8), cu, 0, 23.3, 1.8);
  put(g, boxG(3.2, 1.4, 0.15), cu, 0, 25.2, 2.1); put(g, cylG(0.06, 0.06, 2.6, 6), cu, 0.6, 23.4, 1.5);
  return g;
}

// Royal Palace Amsterdam (1665): 80 m x 57.5 m, cupola to 51 m, Bremer sandstone. Faces east onto Dam Square.
function royalPalace() {
  const g = new THREE.Group(), f = M.face('rpa', '#b9aa8b', '#3a3c3e', 4.4, 5.2, 0.34, 0.5, { roughness: 0.85, metalness: 0 }), s = M.stone('rps', 0xb9aa8b);
  put(g, boxG(80, 30, 57.5), f);
  for (const z of [-29.5, 29.5]) { put(g, boxG(28, 31, 2), f, 0, 0, z); put(g, sideG([[-14, 0], [14, 0], [0, 6]], 2), s, 0, 31, z); }
  put(g, loftG([[80.4, 57.9, 30], [72, 50, 33]]), M.lead());
  put(g, boxG(11, 4, 11), s, 0, 33, 0);
  put(g, cylG(4.8, 4.8, 7, 8), s, 0, 37, 0);
  put(g, domeG(4.9, 0.8, 16), M.copper(), 0, 44, 0);
  put(g, cylG(1.4, 1.4, 2, 8), M.copper(), 0, 47.8, 0); put(g, cylG(0.1, 0.7, 1.6, 8), M.copper(), 0, 49.8, 0);
  put(g, boxG(0.2, 0.8, 1.6), M.gold(), 0, 50.2, 0);
  return g;
}

// N Seoul Tower: 236.7 m on Namsan (summit 243 m; the terrain is the mountain). Observatory at about 135 m.
function nSeoul() {
  const g = new THREE.Group(), w = M.white();
  put(g, cylG(20, 22, 12, 24), M.face('nsb', '#e9e9e6', '#33414c', 3, 4, 0.8, 0.6));
  put(g, cylG(4.4, 5.2, 132, 16), w);
  put(g, latheG([[4.4, 128], [13, 132], [15, 136], [15, 146], [12.5, 150], [13, 152], [13, 159], [6, 163]], 24), w);
  put(g, cylG(15.1, 15.1, 8, 24), M.darkGlass(), 0, 137, 0);
  for (let k = 0; k < 6; k++) put(g, cylG(2.2 - k * 0.27, 2.2 - (k + 1) * 0.27, 12.3, 10), k % 2 ? w : M.red(), 0, 163 + k * 12.3, 0);
  return g;
}

// Wat Arun central prang: 66.8-86 m by source (Wikipedia); modelled at 70 m, the height Rama II planned.
// Stepped terraces, porcelain-mosaic corncob spire, four satellite prangs.
function watArun() {
  const g = new THREE.Group(), m = mat('watarun', () => { const t = facade('#ece6da', '#9fb6c4', 0.6, 0.6, 0.5, 0.5).map; return std(0xffffff, 0.6, 0, { map: t }); });
  put(g, loftG([[37, 37, 0], [37, 37, 6], [31, 31, 6], [31, 31, 14], [25, 25, 14], [25, 25, 23], [19, 19, 23], [19, 19, 30]]), m);
  const prang = (x, z, s) => put(g, facet(latheG([[9, 30], [8.8, 38], [7.8, 46], [6.2, 54], [4.2, 60], [2.4, 64], [1.1, 67], [0.2, 70]].map(([r, y]) => [r * s, (y - 30) * s + 30 * s]), 12)), m, x, 0, z);
  prang(0, 0, 1);
  for (const [x, z] of [[-26, -26], [26, -26], [26, 26], [-26, 26]]) { put(g, loftG([[10, 10, 0], [7.6, 7.6, 12.6]]), m, x, 0, z); prang(x, z, 0.42); }
  return g;
}

// Mexico City Metropolitan Cathedral: 59 m x 128 m, towers 67 m with bell-shaped crowns. Faces south onto the Zocalo.
function mexicoCathedral() {
  const g = new THREE.Group(), s = M.blocks('mxc', 0xa39a8e, 2.6), t = M.stone('mxt', 0x8f5444);
  put(g, boxG(59, 24, 118), s, 0, 0, 5);
  put(g, boxG(20, 34, 108), s, 0, 0, 8);
  put(g, loftG([[20, 108, 34], [2, 108, 40]]), t, 0, 0, 8);
  put(g, archesG(30, 36, 4, [[0, 7, 13], [-10, 5, 10], [10, 5, 10]]), s, 0, 0, -56);
  put(g, loftG([[12, 4, 36], [1, 4, 42]]), s, 0, 0, -56);
  for (const x of [-22, 22]) {
    put(g, boxG(14, 40, 14), s, x, 0, -52);
    put(g, archesG(12, 12, 12, [[-3, 3, 9], [3, 3, 9]]), s, x, 40, -52);
    put(g, archesG(12, 12, 12, [[-3, 3, 9], [3, 3, 9]]), s, x, 40, -52, PI / 2);
    put(g, facet(latheG([[7.6, 52], [7.6, 53.5], [6.4, 56.5], [4, 59.5], [2, 61.5], [2.1, 63], [0.8, 64.5], [0.2, 67]], 4, PI / 4)), s, x, 0, -52);
  }
  put(g, cylG(8, 8, 8, 8), s, 0, 34, 20); put(g, domeG(8, 1.1, 16), M.stone('mxdome', 0xc9a24b), 0, 42, 20);
  put(g, cylG(1.6, 1.6, 4, 8), s, 0, 50.8, 20);
  return g;
}

// Obelisco de Buenos Aires: 67.5 m, 6.8 m square base, pyramidion top (1936).
function obelisco() {
  const g = new THREE.Group(), w = M.blocks('obel', 0xf0ece2, 3);
  put(g, loftG([[6.8, 6.8, 0], [3.5, 3.5, 63.5], [0.1, 0.1, 67.5]]), w);
  put(g, boxG(0.8, 1.2, 0.1), M.dark(), 0, 61, -1.8);
  return g;
}

// Cape Town City Hall (1905): Bath stone, footprint 88 x 56 m (OSM). The clock tower chimes the Westminster
// quarters; its height is not published in our sources, so it is ESTIMATED at ~52 m from photographs.
function capeTownHall() {
  const g = new THREE.Group(), f = M.face('cth', '#d8bd8a', '#3b3a36', 3.6, 5, 0.42, 0.6, { roughness: 0.85, metalness: 0 }), s = M.stone('cths', 0xd8bd8a);
  put(g, boxG(88, 19, 54), f);
  put(g, loftG([[88.4, 54.4, 19], [80, 46, 23]]), M.slate());
  put(g, boxG(11, 26, 11), f, 0, 19, -21);
  clocks(g, 5.5, 41, 2.4, 0, -21);
  put(g, boxG(11, 6, 11), s, 0, 38, -21);
  put(g, cylG(4, 4, 5, 8), s, 0, 44, -21); put(g, domeG(4.2, 1.2, 16), M.copper(), 0, 49, -21);
  for (const x of [-40, 40]) { put(g, boxG(8, 5, 8), s, x, 19, -23); put(g, domeG(4, 1.1, 16), M.copper(), x, 24, -23); }
  return g;
}

// St Mark's Campanile: 98.6 m; 12 m square brick shaft, white Istrian-stone belfry, green pyramidal spire, golden angel.
function campanile() {
  const g = new THREE.Group(), b = M.brick('camp', 0xb8644a), w = M.blocks('istria', 0xeeeae0, 2);
  put(g, boxG(12.8, 1.5, 12.8), w);
  put(g, boxG(12, 47, 12), b, 0, 1.5, 0);
  for (let i = 0; i < 4; i++) put(g, archesG(12, 6.5, 0.8, [-4.2, -1.4, 1.4, 4.2].map(x => [x, 1.9, 5]), 6), w, Math.sin(i * PI / 2) * 5.6, 48.5, Math.cos(i * PI / 2) * 5.6, i * PI / 2);
  put(g, boxG(10.6, 6.5, 10.6), M.dark(), 0, 48.5, 0);
  put(g, boxG(12.4, 1, 12.4), w, 0, 55, 0);
  put(g, boxG(11.4, 6, 11.4), M.brick('camp2', 0xd9b6a0), 0, 56, 0);
  put(g, loftG([[11, 11, 62], [0.4, 0.4, 94.5]]), M.copper());
  put(g, cylG(0.4, 0.4, 1.5, 8), M.gold(), 0, 94.5, 0); put(g, boxG(0.8, 2.6, 0.5), M.gold(), 0, 96, 0); put(g, boxG(2.4, 0.6, 0.15), M.gold(), 0, 97.4, 0.3);
  return g;
}

// Basilica di San Marco: 76.5 m x 62.6 m Greek cross, five domes (outer helmets to ~43 m). Faces west onto the Piazza.
function stMarks() {
  const g = new THREE.Group(), b = M.stone('smb', 0xcdb7a2), w = M.blocks('smw', 0xece6da, 2), lead = M.lead();
  put(g, boxG(52, 22, 66), b, 0, 0, 6);
  put(g, boxG(62, 16, 12), w, 0, 0, -32);
  put(g, archesG(62, 18, 2, [-24, -12, 0, 12, 24].map((x, i) => [x, i === 2 ? 9 : 7, i === 2 ? 16 : 13])), w, 0, 0, -38.5);
  for (const x of [-24, -12, 0, 12, 24]) put(g, boxG(x ? 6 : 8, 3.4, 0.4), M.gold(), x, 18.4, -39.3);
  for (const [x, z, r] of [[0, 5, 8.6], [0, -21, 7.4], [0, 31, 7.4], [-24, 5, 7.4], [24, 5, 7.4]]) {
    put(g, cylG(r, r, 4, 24), b, x, 22, z);
    put(g, latheG([[r + 0.4, 26], [r + 0.5, 28], [r, 32], [r * 0.72, 35.5], [r * 0.4, 37.5], [r * 0.12, 38.2], [0.1, 38.3]], 24), lead, x, 0, z);
    put(g, cylG(1, 1, 2, 8), lead, x, 38, z); put(g, onionG(1.2, 2.4, 10), M.gold(), x, 40, z); put(g, boxG(0.2, 1.6, 0.2), M.gold(), x, 42.4, z);
  }
  return g;
}

// ---------- registry ----------
function rotC(list, heading) {
  const a = -heading * D, c = Math.cos(a), s = Math.sin(a);
  return list.map(o => ({ ...o, x: o.x * c + o.z * s, z: -o.x * s + o.z * c, ...(o.type === 'box' ? { ry: (o.ry || 0) + a } : {}) }));
}
const circ = (x, z, r) => ({ type: 'circle', x, z, r }), box = (x, z, hw, hd, ry = 0) => ({ type: 'box', x, z, hw, hd, ry });
const L = (id, city, name, lat, lon, heading, clear, colliders, fn) => ({
  id, city, name, lat, lon, heading, clear, colliders: rotC(colliders, heading),
  build() { const g = finish(fn()); g.rotation.y = -heading * D; g.name = name; return g; },
});

export const LANDMARKS = [
  L('eiffel', 'paris', 'Eiffel Tower', 48.85826, 2.29450, 316, 70, [circ(-49, -49, 14), circ(49, -49, 14), circ(49, 49, 14), circ(-49, 49, 14)], eiffel),
  L('empire-state', 'new-york', 'Empire State Building', 40.74844, -73.98566, 299, 70, [box(0, 0, 28.5, 64.5)], empireState),
  L('chrysler', 'new-york', 'Chrysler Building', 40.75160, -73.97534, 299, 40, [box(0, 0, 31, 31)], chrysler),
  L('elizabeth-tower', 'london', 'Elizabeth Tower (Big Ben)', 51.50071, -0.12455, 97, 14, [box(0, 0, 6.5, 6.5)], elizabethTower),
  L('westminster', 'london', 'Palace of Westminster', 51.49934, -0.12456, 97, 70, [box(0, 0, 136, 51)], westminster),
  L('london-eye', 'london', 'London Eye', 51.50346, -0.11964, 278, 35, [circ(-10, 30, 2.5), circ(10, 30, 2.5), box(0, 0, 15, 7)], londonEye),
  L('scramble-square', 'tokyo', 'Shibuya Scramble Square', 35.65843, 139.70208, 69, 40, [box(0, 0, 35, 28)], scramble),
  L('burj-khalifa', 'dubai', 'Burj Khalifa', 25.19720, 55.27414, 36, 75, [circ(0, 0, 40)], burj),
  L('marina-bay-sands', 'singapore', 'Marina Bay Sands', 1.28368, 103.86071, 22, 130, [box(12, 114, 30, 19), box(12, 0, 30, 19), box(12, -114, 30, 19)], marinaBaySands),
  L('bank-of-china', 'hong-kong', 'Bank of China Tower', 22.27924, 114.16147, 22, 45, [box(0, 0, 32, 32)], bankOfChina),
  L('opera-house', 'sydney', 'Sydney Opera House', -33.85689, 151.21507, 13, 95, [box(0, -10, 59, 85)], operaHouse),
  L('colosseum', 'rome', 'Colosseum', 41.89033, 12.49239, 21, 100, [circ(0, 0, 78), circ(-40, 0, 54), circ(40, 0, 54)], colosseum),
  L('us-bank-tower', 'los-angeles', 'U.S. Bank Tower', 34.05106, -118.25444, 28, 35, [circ(0, 0, 29)], usBank),
  L('transamerica', 'san-francisco', 'Transamerica Pyramid', 37.79519, -122.40265, 351, 35, [box(0, 0, 26.5, 26.5)], transamerica),
  L('sagrada-familia', 'barcelona', 'Sagrada Familia', 41.40360, 2.17417, 135, 70, [box(0, 0, 23, 45), box(0, 10, 38, 15), circ(0, 45, 22)], sagrada),
  L('hagia-sophia', 'istanbul', 'Hagia Sophia', 41.00860, 28.97984, 302, 60, [box(0, -4, 36, 48), circ(-42, -42, 3), circ(42, -42, 3), circ(-42, 38, 3), circ(42, 38, 3.5)], hagiaSophia),
  L('gateway-of-india', 'mumbai', 'Gateway of India', 18.92196, 72.83456, 142, 25, [box(-7.5, 0, 3, 7.5), box(7.5, 0, 3, 7.5), box(-18.5, 0, 3.5, 7.5), box(18.5, 0, 3.5, 7.5)], gatewayOfIndia),
  L('india-gate', 'delhi', 'India Gate', 28.61292, 77.22948, 92, 18, [box(-8, 0, 3.4, 5.5), box(8, 0, 3.4, 5.5)], indiaGate),
  L('oriental-pearl', 'shanghai', 'Oriental Pearl Tower', 31.24190, 121.49527, 0, 55, [circ(0, 0, 13), circ(22, 38, 4.5), circ(22, -38, 4.5), circ(-44, 0, 4.5)], orientalPearl),
  L('tiananmen', 'beijing', 'Tiananmen', 39.90738, 116.39127, 180, 45, [box(-42, 0, 17, 19.5), box(42, 0, 17, 19.5), box(-25, 0, 6, 19.5), box(25, 0, 6, 19.5), box(-8.5, 0, 6, 19.5), box(8.5, 0, 6, 19.5)], tiananmen),
  L('st-basil', 'moscow', "St Basil's Cathedral", 55.75249, 37.62304, 326, 30, [box(0, 0, 23, 21), box(24, 18, 3.5, 3.5)], stBasil),
  L('christ-redeemer', 'rio', 'Christ the Redeemer', -22.95192, -43.21046, 95, 15, [box(0, 0, 8, 8)], christ),
  L('khufu', 'cairo', 'Great Pyramid of Khufu', 29.97917, 31.13421, 0, 130, [box(0, 0, 112, 112)], pyramid(230.3, 12.7, 138.5)),
  L('khafre', 'cairo', 'Pyramid of Khafre', 29.97610, 31.13027, 0, 120, [box(0, 0, 105, 105)], pyramid(215.3, 10.6, 136.4, 26)),
  L('menkaure', 'cairo', 'Pyramid of Menkaure', 29.97252, 31.12832, 0, 60, [box(0, 0, 50, 50)], pyramid(103.4, 7.1, 61)),
  L('sphinx', 'cairo', 'Great Sphinx of Giza', 29.97528, 31.13766, 90, 40, [box(0, -4, 9.5, 34)], sphinx),
  L('willis-tower', 'chicago', 'Willis Tower', 41.87874, -87.63596, 0, 45, [box(0, 0, 34.3, 34.3)], willis),
  L('cn-tower', 'toronto', 'CN Tower', 43.64256, -79.38709, 0, 35, [circ(0, 0, 12), circ(0, -24, 5), circ(20.8, 12, 5), circ(-20.8, 12, 5)], cnTower),
  L('brandenburg-gate', 'berlin', 'Brandenburg Gate', 52.51627, 13.37770, 83, 22, [-14.8, -9.25, -3.7, 3.7, 9.25, 14.8].map(x => box(x, 0, 1, 5.5)), brandenburg),
  L('royal-palace', 'amsterdam', 'Royal Palace Amsterdam', 52.37313, 4.89134, 91, 45, [box(0, 0, 40, 30)], royalPalace),
  L('n-seoul-tower', 'seoul', 'N Seoul Tower', 37.55117, 126.98823, 0, 25, [circ(0, 0, 22)], nSeoul),
  L('wat-arun', 'bangkok', 'Wat Arun', 13.74370, 100.48889, 90, 30, [box(0, 0, 18.5, 18.5), ...[[-26, -26], [26, -26], [26, 26], [-26, 26]].map(([x, z]) => box(x, z, 5, 5))], watArun),
  L('mexico-cathedral', 'mexico-city', 'Metropolitan Cathedral', 19.43444, -99.13306, 188, 70, [box(0, 2, 30, 61)], mexicoCathedral),
  L('obelisco', 'buenos-aires', 'Obelisco de Buenos Aires', -34.60371, -58.38163, 0, 8, [box(0, 0, 3.4, 3.4)], obelisco),
  L('cape-town-city-hall', 'cape-town', 'Cape Town City Hall', -33.92541, 18.42380, 42, 45, [box(0, 0, 44, 27)], capeTownHall),
  L('campanile', 'venice', "St Mark's Campanile", 45.43406, 12.33902, 253, 10, [box(0, 0, 6.4, 6.4)], campanile),
  L('st-marks', 'venice', "St Mark's Basilica", 45.43454, 12.33968, 253, 40, [box(0, 0, 31, 40)], stMarks),
];

// Entries within km of (lat, lon), nearest first
export function landmarksNear(lat, lon, km = 8) {
  const d = e => Math.hypot((e.lon - lon) * Math.cos(lat * D), e.lat - lat) * 111.32;
  return LANDMARKS.filter(e => d(e) <= km).sort((a, b) => d(a) - d(b));
}
