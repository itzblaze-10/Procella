// Shared vehicle parts: PBR materials with a mud overlay, smooth body shells, tyres, rotors, hulls, decals, wake, particles.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// One material cache and one set of mud uniforms per vehicle build (reset in createVehicle),
// so dispose() never frees another vehicle's material and every vehicle carries its own dirt.
let mats = new Map(), U = null;
export const resetMats = () => { mats = new Map(); U = { uDirt: { value: 0 }, uDirtH: { value: 1.5 }, uRootInv: { value: new THREE.Matrix4() } }; };
resetMats();

// Mud overlay: heaviest low on the body (root-space height), broken up by noise, climbing as dirt rises.
function muddy(m) {
  const u = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform mat4 uRootInv;\nvarying vec3 vDirtP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvDirtP = (uRootInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uDirt; uniform float uDirtH; varying vec3 vDirtP;
float dH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dH(i), dH(i + vec3(1,0,0)), f.x), mix(dH(i + vec3(0,1,0)), dH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dH(i + vec3(0,0,1)), dH(i + vec3(1,0,1)), f.x), mix(dH(i + vec3(0,1,1)), dH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float dF(vec3 p){ return 0.5 * dN(p) + 0.3 * dN(p * 2.7) + 0.2 * dN(p * 7.3); }
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  float dn = dF(vDirtP * 3.0);
  float reach = uDirt * uDirtH;
  float dm = (1.0 - smoothstep(reach * 0.35, reach + 0.08, vDirtP.y + (dn - 0.5) * 0.6 * uDirtH)) * smoothstep(0.32, 0.6, dn + uDirt * 0.45);
  dm = clamp(dm * smoothstep(0.0, 0.08, uDirt), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.035, 0.024, 0.014), vec3(0.12, 0.085, 0.05), dF(vDirtP * 11.0)), dm);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.93, dm);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, dm);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - dm;\n#endif');
  };
  m.customProgramCacheKey = () => 'mud';
  return m;
}

// Plain PBR material (smooth shaded). o.physical switches to MeshPhysicalMaterial; o.clean skips the mud overlay.
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) {
    const { physical, clean, hull, ...p } = o;
    const m = new (physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ color, roughness: 0.6, metalness: 0, ...p });
    mats.set(k, clean ? m : muddy(m));
  }
  return mats.get(k);
}
// Automotive paint: base coat under a glossy clear coat. Low metalness so it still reads without an environment map.
export const paintMat = c => mat(c, { physical: true, metalness: 0.25, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06 });
export const GLASS = () => mat('#0d151c', { physical: true, clean: true, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.6 });
export const CHROME = () => mat('#d9dde2', { metalness: 1, roughness: 0.14 });
export const ALU = () => mat('#a9adb1', { metalness: 0.9, roughness: 0.35 });
export const TRIM = () => mat('#18191b', { roughness: 0.55 });
export const STEEL = () => mat('#3a3d41', { metalness: 0.7, roughness: 0.45 });
export const LIGHT = () => mat('#fff6e0', { physical: true, clean: true, emissive: '#fff1cc', emissiveIntensity: 1.4, roughness: 0.05, clearcoat: 1 });
export const TAIL = () => mat('#9c0f12', { physical: true, clean: true, emissive: '#600608', emissiveIntensity: 0.9, roughness: 0.1, clearcoat: 1 });
export const AMBER = () => mat('#e08a10', { physical: true, clean: true, emissive: '#5a3000', roughness: 0.1, clearcoat: 1 });

export function frame(dirtH = 1.5) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body); U.uDirtH.value = dirtH;
  return { root, body, wheels: [], props: [], rotors: [], spinners: [], wake: [], smoke: null, dirt: U.uDirt, rootInv: U.uRootInv };
}

export function add(p, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = true; mesh.receiveShadow = true;
  p.add(mesh);
  return mesh;
}
export const box = (p, w, h, d, m, x, y, z, rx, ry, rz) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
export const rbox = (p, w, h, d, r, m, x, y, z, rx, ry, rz) => add(p, new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), m, x, y, z, rx, ry, rz);
export const cyl = (p, rt, rb, h, seg, m, x, y, z, rx, ry, rz) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, rx, ry, rz);
export const ball = (p, r, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const b = add(p, new THREE.SphereGeometry(r, 20, 14), m, x, y, z); b.scale.set(sx, sy, sz); return b; };

const UP = new THREE.Vector3(0, 1, 0);
export function tube(p, a, b, r, m, seg = 8) { // cylinder from point a to point b (struts, roll cage, rails, rigging)
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A);
  const mesh = add(p, new THREE.CylinderGeometry(r, r, d.length(), seg), m);
  mesh.position.copy(A).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  return mesh;
}

// Arc of points [z, y] around (cz, cy), angle a0 -> a1 (0 = +z, PI/2 = up). Used for wheel arches and round ends.
export function arc(cz, cy, r, a0, a1, n = 10) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cz + r * Math.cos(a), cy + r * Math.sin(a)]; });
}
// Wheel arch cut into a sill at height y: returns the points going from the rear edge to the front edge (decreasing z).
export const arch = (cz, cy, r, y) => { const a = Math.asin(THREE.MathUtils.clamp((y - cy) / r, -1, 1)); return arc(cz, cy, r, a, Math.PI - a, 12); };

// Side profile [[z, y], ...] extruded across width w with rounded edges, then optionally squeezed:
// def(y, z) returns a width scale (tumblehome, tapered noses). Smooth normals with creases kept above ~35 degrees.
export function shell(p, pts, w, m, { bevel = 0.06, def, steps = 1, crease = 0.6 } = {}) {
  const bs = Math.min(bevel, w * 0.3);
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))),
    { depth: Math.max(0.001, w - 2 * bs), steps, bevelEnabled: bs > 0, bevelThickness: bs, bevelSize: bs * 0.7, bevelOffset: -bs * 0.7, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(w - 2 * bs) / 2).rotateY(-Math.PI / 2);
  if (def) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) a.setX(i, a.getX(i) * def(a.getY(i), a.getZ(i))); }
  g.deleteAttribute('uv');
  return add(p, toCreasedNormals(g, crease), m);
}

// Surface of revolution about local y from [[radius, y], ...]; rx/rz orient it (e.g. rz = PI/2 for a wheel).
export const lathe = (p, pts, seg, m, x, y, z, rx, ry, rz) => add(p, new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg), m, x, y, z, rx, ry, rz);

// NACA 4-digit airfoil section, chord 1 along +z from the leading edge, as [[z, y], ...] (closed loop).
export function airfoil(camber = 0.02, pos = 0.4, thick = 0.12, n = 14) {
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos(Math.PI * i / n)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < pos ? camber / pos ** 2 * (2 * pos * x - x * x) : camber / (1 - pos) ** 2 * (1 - 2 * pos + 2 * pos * x - x * x);
    up.push([x, yc + yt]); lo.push([x, yc - yt]);
  }
  return [...up.reverse(), ...lo.slice(1, -1)];
}
// Wing or tail surface across x from -span/2 to span/2: chord(ax) and sweep(ax) (leading-edge z offset), dihedral rise per metre.
export function wing(p, span, chordAt, m, { x = 0, y = 0, z = 0, foil = airfoil(), dihedral = 0, sweep = () => 0, half = false } = {}) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(foil.map(([a, b]) => new THREE.Vector2(a, b))), { depth: half ? span / 2 : span, steps: 16, bevelEnabled: false });
  g.translate(0, 0, half ? 0 : -span / 2).rotateY(-Math.PI / 2);
  const a = g.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const ax = Math.abs(a.getX(i)), c = chordAt(ax);
    a.setZ(i, sweep(ax) + a.getZ(i) * c); a.setY(i, a.getY(i) * c + ax * dihedral);
  }
  g.deleteAttribute('uv');
  return add(p, toCreasedNormals(g, 0.9), m, x, y, z);
}

// Tyre tread: a canvas bump map wrapped round the tyre (u = circumference, v = sidewall -> tread -> sidewall).
const treads = {};
function treadMap(kind) {
  if (treads[kind]) return treads[kind];
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#000';
  const t0 = 128 * 3 / 8, t1 = 128 * 5 / 8, n = kind === 'mud' ? 36 : 64, w = 1024 / n;
  for (let i = 0; i < n; i++) {
    const x = i * w;
    if (kind === 'mud') { // big staggered lugs with deep voids
      g.fillRect(x, t0 - 6, w * 0.38, (t1 - t0) * 0.55 + 6); g.fillRect(x + w * 0.5, t0 + (t1 - t0) * 0.45, w * 0.38, (t1 - t0) * 0.55 + 6);
    } else { // road: circumferential grooves plus fine sipes
      g.fillRect(x, t0 + 2, 2, (t1 - t0) * 0.3); g.fillRect(x + w / 2, t1 - (t1 - t0) * 0.3 - 2, 2, (t1 - t0) * 0.3);
    }
  }
  if (kind !== 'mud') for (const f of [0.3, 0.5, 0.7]) g.fillRect(0, t0 + (t1 - t0) * f - 2, 1024, 4);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping;
  return (treads[kind] = tex);
}
// Wheel: a steer group (rotation.y, position.y = suspension travel) holding a spin group (rotation.x).
// style: 'steel' | 'alloy' | 'buggy'; tread: 'road' | 'mud'.
export function wheel(p, r, w, x, y, z, front, { style = 'alloy', tread = 'road', rimCol } = {}) {
  const steer = new THREE.Group(), spin = new THREE.Group();
  steer.position.set(x, y, z); steer.add(spin); p.add(steer);
  const rr = r * (style === 'buggy' ? 0.5 : 0.6), hw = w / 2;
  const rub = mat('#141414', { side: THREE.DoubleSide, roughness: 0.92, bumpMap: treadMap(tread), bumpScale: tread === 'mud' ? 6 : 2 });
  lathe(spin, [[rr, -hw * 0.82], [r * 0.82, -hw], [r * 0.96, -hw * 0.96], [r, -hw * 0.72], [r, hw * 0.72], [r * 0.96, hw * 0.96], [r * 0.82, hw], [rr, hw * 0.82]], 36, rub, 0, 0, 0, 0, 0, Math.PI / 2);
  const out = Math.sign(x) || 1, RM = mat(rimCol || (style === 'steel' ? '#c9c6bd' : '#b4b8bc'), { side: THREE.DoubleSide, metalness: style === 'steel' ? 0.4 : 0.85, roughness: 0.35 });
  // dished rim face, opening toward the outside of the car
  lathe(spin, [[rr * 1.02, hw * 0.75], [rr * 0.95, hw * 0.6], [rr * 0.35, hw * 0.25], [rr * 0.2, hw * 0.45], [0.01, hw * 0.47]], 24, RM, 0, 0, 0, 0, 0, -Math.PI / 2 * out);
  const spokes = style === 'steel' ? 6 : 5;
  for (let i = 0; i < spokes; i++) {
    const a = i * 2 * Math.PI / spokes;
    if (style === 'steel') add(spin, new THREE.CylinderGeometry(rr * 0.13, rr * 0.13, 0.02, 10), TRIM(), out * hw * 0.42, Math.cos(a) * rr * 0.62, Math.sin(a) * rr * 0.62, 0, 0, Math.PI / 2);
    else rbox(spin, 0.035, rr * 0.75, rr * 0.2, 0.012, RM, out * hw * 0.5, Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5, a);
  }
  cyl(spin, rr * 0.18, rr * 0.22, 0.05, 12, CHROME(), out * hw * 0.52, 0, 0, 0, 0, Math.PI / 2);
  return { steer, spin, r, front, x, y0: y, z };
}

// Propeller / rotor: n blades in the local XY plane spinning about local z. rx/ry orient the spin axis.
// twist (rad) pitches each blade; tip taper narrows the chord. Returns the spinning group.
export function rotor(p, n, len, chord, m, x, y, z, rx = 0, ry = 0, { twist = 0.25, root = 0, thick = 0.035 } = {}) {
  const o = new THREE.Group(), s = new THREE.Group();
  o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.add(s); p.add(o);
  for (let i = 0; i < n; i++) {
    const arm = new THREE.Group(); arm.rotation.z = i * 2 * Math.PI / n; s.add(arm);
    const b = rbox(arm, chord, len - root, thick, thick * 0.45, m, 0, root + (len - root) / 2, 0, 0, twist);
    b.scale.x = 1; b.geometry.attributes.position.array.forEach((_, j, a) => { if (j % 3 === 0) a[j] *= 1 - 0.45 * Math.max(0, a[j + 1] / ((len - root) / 2)); }); // taper toward the tip
    b.geometry.computeVertexNormals();
  }
  return s;
}

// Parametric hull, waterline-agnostic: keel bottom at y = 0, bow at z = -len/2.
// n: section squareness (2 round bilge, 5+ flat bottom, <2 vee), bowT: fraction of length that tapers to the stem,
// transom: stern half-beam fraction, rise: forefoot rise of the keel at the bow, rake: stem overhang at deck level,
// sheer: extra deck height at the bow. Returns the geometry.
export function hullGeo({ len, beam, depth, n = 2.5, bowT = 0.35, transom = 0.85, rise = 0.5, rake = 0, sheer = 0, rows = 28, cols = 10 }) {
  const P = [], idx = [], L = len / 2, B = beam / 2;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, tb = Math.min(1, t / bowT);
    const half = B * (t < bowT ? Math.sqrt(1 - (1 - tb) ** 2) : 1 - (1 - transom) * ((t - bowT) / (1 - bowT)) ** 2);
    const keel = depth * rise * (1 - tb) ** 2, top = depth + sheer * (1 - t) ** 2;
    for (let j = 0; j <= cols; j++) { // j = 0 keel centre .. cols = deck edge, mirrored later
      const th = j / cols * Math.PI / 2, sx = Math.sin(th) ** (2 / n), cy = 1 - Math.cos(th) ** (2 / n);
      const y = keel + (top - keel) * cy;
      P.push([half * sx, y, -L + t * len - rake * Math.max(0, 1 - t / 0.15) ** 2 * cy ** 2]);
    }
  }
  const W = cols + 1, pos = [];
  for (const s of [1, -1]) {
    const o = pos.length / 3;
    for (const [x, y, z] of P) pos.push(s * x, y, z);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = o + i * W + j, b = a + W, c = b + 1, d = a + 1;
      if (s > 0) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
    }
  }
  // deck (flat at each row's sheer) and transom: material group 1
  const sides = idx.length, o = pos.length / 3;
  for (let i = 0; i <= rows; i++) { const [x, y, z] = P[i * W + cols]; pos.push(x, y, z, -x, y, z); }
  for (let i = 0; i < rows; i++) { const a = o + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const t0 = pos.length / 3;
  for (let j = 0; j <= cols; j++) { const [x, y, z] = P[rows * W + j]; pos.push(x, y, z, -x, y, z); }
  for (let j = 0; j < cols; j++) { const a = t0 + j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.addGroup(0, sides, 0); g.addGroup(sides, idx.length - sides, 1);
  return toCreasedNormals(g, 0.7);
}
export const hull = (p, o, paint, deck, wl, y = 0, z = 0) => add(p, hullGeo(o), [hullMat(paint, wl), deck], 0, y, z);
// Hull material: paint above the boot stripe, antifouling below the waterline (root-space height wl).
export function hullMat(paint, wl, anti = '#7a1f19', boot = '#16181b') {
  const m = mat(paint, { physical: true, side: THREE.DoubleSide, metalness: 0.15, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1, hull: wl });
  if (m.userData.hull) return m;
  m.userData.hull = true;
  const base = m.onBeforeCompile, A = new THREE.Color(anti), Bt = new THREE.Color(boot);
  m.onBeforeCompile = sh => {
    base(sh);
    sh.uniforms.uWL = { value: wl }; sh.uniforms.uAnti = { value: A }; sh.uniforms.uBoot = { value: Bt };
    sh.fragmentShader = 'uniform float uWL; uniform vec3 uAnti; uniform vec3 uBoot;\n' + sh.fragmentShader.replace('float dn = dF',
      'diffuseColor.rgb = vDirtP.y < uWL ? uAnti : vDirtP.y < uWL + 0.18 ? uBoot : diffuseColor.rgb;\n  float dn = dF');
  };
  m.customProgramCacheKey = () => 'mud-hull';
  return m;
}

// Decals: drawn on a canvas, shown on both sides of the body. Transparent background, so paint shows through.
const INK = '#f6f3ea', LINE = '#16181c';
function text(c, w, h, a, b) {
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = h * 0.05; c.strokeStyle = LINE; c.fillStyle = INK;
  c.font = `bold ${Math.round(h * 0.5)}px sans-serif`;
  c.strokeText(a, w / 2, b ? h * 0.42 : h / 2, w * 0.9); c.fillText(a, w / 2, b ? h * 0.42 : h / 2, w * 0.9);
  if (b) { c.font = `bold ${Math.round(h * 0.17)}px sans-serif`; c.fillText(b, w / 2, h * 0.82, w * 0.9); }
}
const stripes = (c, w, h) => { c.fillStyle = INK; c.fillRect(0, h * 0.3, w, h * 0.14); c.fillRect(0, h * 0.56, w, h * 0.14); };
export const DECALS = {
  'Racing stripe': stripes,
  'Boot stripe': stripes,
  'PROCELLA expedition': (c, w, h) => text(c, w, h, 'PROCELLA', 'EARTH TREND EXPEDITION'),
  'Rally number': (c, w, h) => {
    c.fillStyle = INK; c.strokeStyle = LINE; c.lineWidth = h * 0.05;
    c.beginPath(); c.arc(w / 2, h / 2, h * 0.42, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = LINE; c.font = `bold ${Math.round(h * 0.5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('27', w / 2, h / 2);
  },
  'Checker band': (c, w, h) => { const q = h / 4; for (let i = 0; i * q < w; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? LINE : INK; c.fillRect(i * q, h * 0.25 + j * q, q, q); } },
  'Sunset bands': (c, w, h) => ['#f2b84b', '#ff6a3d', '#c2362b'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, h * (0.28 + i * 0.16), w, h * 0.11); }),
  'Registration VT-PRC': (c, w, h) => text(c, w, h, 'VT-PRC'),
  'Wave line': (c, w, h) => {
    c.strokeStyle = INK; c.lineWidth = h * 0.12; c.beginPath();
    for (let x = 0; x <= w; x += 8) c.lineTo(x, h / 2 + Math.sin(x / h * 4) * h * 0.25);
    c.stroke();
  },
};
export function decal(p, name, x, y, z, w, h) {
  const draw = DECALS[name];
  if (!draw) return; // 'None' or unknown
  const cv = document.createElement('canvas');
  cv.height = 128; cv.width = Math.min(2048, Math.round(128 * w / h));
  draw(cv.getContext('2d'), cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = muddy(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
  const g = new THREE.PlaneGeometry(w, h);
  for (const s of [-1, 1]) add(p, g, m, s * (x + 0.012), y, z, 0, s * Math.PI / 2, 0).castShadow = false;
}

// Wake: three flat quads trailing the stern; physics sets opacity and length from speed.
export function wake(p, beam, z, y) {
  const g = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0).rotateX(-Math.PI / 2); // spans local z 0..1
  const m = new THREE.MeshBasicMaterial({ color: '#f4f8fa', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  return [-1, 0, 1].map(s => {
    const w = add(p, g, m, s * beam * 0.35, y, z, 0, s * 0.35, 0);
    w.scale.x = beam * (s ? 0.3 : 0.6); w.castShadow = w.receiveShadow = false;
    return w;
  });
}

// Particles: one pooled THREE.Points per vehicle, in world space (the vehicle adds it to its own parent).
// emit(x, y, z, vx, vy, vz, life s, size m, colour [r, g, b, a], gravity, growth m/s, drag 1/s).
export function particles(n = 700) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  const vel = new Float32Array(n * 3), age = new Float32Array(n).fill(1), life = new Float32Array(n).fill(1), a0 = new Float32Array(n), k = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color4', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const uScale = { value: 600 };
  const mtl = new THREE.ShaderMaterial({
    uniforms: { uScale }, transparent: true, depthWrite: false,
    vertexShader: `attribute float size; attribute vec4 color4; uniform float uScale; varying vec4 vC;
      void main(){ vC = color4; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = vC.a > 0.0 ? min(size * uScale / max(-mv.z, 0.1), 384.0) : 0.0; }`,
    fragmentShader: `varying vec4 vC;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - smoothstep(0.18, 0.5, d)));
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mtl);
  pts.frustumCulled = false; pts.renderOrder = 2;
  pts.onBeforeRender = (r, s, cam) => { uScale.value = r.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov || 60) / 2)); };
  let next = 0;
  const emit = (x, y, z, vx, vy, vz, lf, sz, c, grav = 9.81, grow = 0, drag = 0) => {
    if (![x, y, z, vx, vy, vz].every(Number.isFinite)) return;
    const i = next; next = (next + 1) % n;
    pos.set([x, y, z], i * 3); vel.set([vx, vy, vz], i * 3); k.set([grav, grow, drag], i * 3);
    col.set(c, i * 4); a0[i] = c[3]; size[i] = sz; age[i] = 0; life[i] = lf;
  };
  // floor(x, z): ground height, so clods land instead of falling through
  const update = (dt, floor) => {
    for (let i = 0; i < n; i++) {
      if (age[i] >= life[i]) { col[i * 4 + 3] = 0; continue; }
      const t = (age[i] += dt) / life[i], j = i * 3, f = Math.exp(-k[j + 2] * dt);
      vel[j + 1] -= k[j] * dt; vel[j] *= f; vel[j + 1] *= f; vel[j + 2] *= f;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (floor && k[j] > 3) { const h = floor(pos[j], pos[j + 2]); if (pos[j + 1] < h) { pos[j + 1] = h; vel[j] = vel[j + 1] = vel[j + 2] = 0; } }
      size[i] += k[j + 1] * dt;
      col[i * 4 + 3] = a0[i] * Math.min(1, t * 12) * (1 - t);
    }
    g.attributes.position.needsUpdate = g.attributes.color4.needsUpdate = g.attributes.size.needsUpdate = true;
  };
  return { points: pts, emit, update };
}
