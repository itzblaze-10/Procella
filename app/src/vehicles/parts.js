// Shared low-poly parts for every vehicle: materials, primitives, wheels, rotors, hulls, decals, wake, smoke.
import * as THREE from 'three';

// One material cache per vehicle build (reset in createVehicle), so dispose() never frees another vehicle's material.
let mats = new Map();
export const resetMats = () => { mats = new Map(); };
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.65, metalness: 0.1, ...o }));
  return mats.get(k);
}
export const paintMat = c => mat(c, { metalness: 0.35, roughness: 0.4 });
export const GLASS = () => mat('#1d2b38', { metalness: 0.5, roughness: 0.15 });
export const LIGHT = () => mat('#fff4d6', { emissive: '#fff1c4', emissiveIntensity: 1.2 });
export const TAIL = () => mat('#b01818', { emissive: '#7a0a0a', emissiveIntensity: 0.8 });

export function frame() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  return { root, body, wheels: [], props: [], rotors: [], spinners: [], wake: [], smoke: null };
}

export function add(p, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = true;
  p.add(mesh);
  return mesh;
}
export const box = (p, w, h, d, m, x, y, z, rx, ry, rz) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
export const cyl = (p, rt, rb, h, seg, m, x, y, z, rx, ry, rz) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, rx, ry, rz);

const UP = new THREE.Vector3(0, 1, 0);
export function tube(p, a, b, r, m) { // cylinder from point a to point b (struts, roll cage, rails)
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A);
  const mesh = add(p, new THREE.CylinderGeometry(r, r, d.length(), 6), m);
  mesh.position.copy(A).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  return mesh;
}

// Wheel: steer group (rotation.y) holding a spin group (rotation.x).
export function wheel(p, r, w, x, y, z, front) {
  const steer = new THREE.Group(), spin = new THREE.Group();
  steer.position.set(x, y, z); steer.add(spin); p.add(steer);
  add(spin, new THREE.CylinderGeometry(r, r, w, 14), '#1d1d1f', 0, 0, 0, 0, 0, Math.PI / 2);
  add(spin, new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 5), '#9a9ea3', 0, 0, 0, 0, 0, Math.PI / 2);
  box(spin, w + 0.04, r * 0.9, 0.07, '#5c6066', 0, 0, 0); // spoke so the spin reads
  return { steer, spin, r, front };
}
export function wheels(m, r, w, x, zf, zr) {
  for (const [s, z] of [[-1, zf], [1, zf], [-1, zr], [1, zr]]) m.wheels.push(wheel(m.root, r, w, s * x, r, z, z === zf));
}

// Propeller / rotor: n blades in the local XY plane spinning about local z. rx/ry orient the spin axis.
export function rotor(p, n, len, chord, m, x, y, z, rx = 0, ry = 0) {
  const o = new THREE.Group(), s = new THREE.Group();
  o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.add(s); p.add(o);
  const g = new THREE.BoxGeometry(chord, len, 0.04).translate(0, len / 2, 0);
  for (let i = 0; i < n; i++) add(s, g, m, 0, 0, 0, 0, 0, i * 2 * Math.PI / n);
  add(s, new THREE.CylinderGeometry(chord * 0.8, chord * 0.8, 0.15, 8).rotateX(Math.PI / 2), m);
  return s;
}

// Hull: plan-view pentagon (pointed bow toward -z) extruded upward from y.
export function hull(p, len, beam, h, bow, m, y = 0, z = 0) {
  const b = beam / 2, L = len / 2, s = new THREE.Shape();
  s.moveTo(-b, -L); s.lineTo(b, -L); s.lineTo(b, L - bow); s.lineTo(0, L); s.lineTo(-b, L - bow); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2);
  return add(p, g, m, 0, y, z);
}

// Side profile [[z, y], ...] extruded across the width (sedan glasshouse).
export function profile(p, pts, w, m) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), { depth: w, bevelEnabled: false });
  return add(p, g.translate(0, 0, -w / 2).rotateY(-Math.PI / 2), m);
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
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  const g = new THREE.PlaneGeometry(w, h);
  for (const s of [-1, 1]) add(p, g, m, s * (x + 0.02), y, z, 0, s * Math.PI / 2, 0).castShadow = false;
}

// Wake: three flat quads trailing the stern; physics sets opacity and length from speed.
export function wake(p, beam, z, y) {
  const g = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0).rotateX(-Math.PI / 2); // spans local z 0..1
  const m = new THREE.MeshBasicMaterial({ color: '#f4f8fa', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  return [-1, 0, 1].map(s => {
    const w = add(p, g, m, s * beam * 0.35, y, z, 0, s * 0.35, 0);
    w.scale.x = beam * (s ? 0.3 : 0.6); w.castShadow = false;
    return w;
  });
}

// Smoke: a pool of n puffs recycled from the funnel top. Returns update(dt, speed).
// ponytail: puffs live in ship space, so they swing with the hull in turns; reparent to the scene if that ever shows.
export function smoke(p, x, y, z, n = 12) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const puffs = Array.from({ length: n }, () => {
    const q = add(p, g, new THREE.MeshStandardMaterial({ color: '#5d5d5d', flatShading: true, transparent: true, opacity: 0, depthWrite: false }), x, y, z);
    q.visible = false; q.castShadow = false; q.userData.age = 0;
    return q;
  });
  let clock = 0, next = 0;
  return (dt, speed) => {
    if ((clock += dt) > 0.35) { clock = 0; const q = puffs[next = (next + 1) % n]; q.userData.age = 0; q.position.set(x, y, z); q.visible = true; }
    for (const q of puffs) {
      if (!q.visible) continue;
      const a = (q.userData.age += dt) / 4;
      if (a >= 1) { q.visible = false; continue; }
      q.position.y += 2.5 * dt; q.position.z += (Math.abs(speed) * 0.9 + 1.5) * dt; // drifts aft as the ship steams on
      q.scale.setScalar(0.8 + a * 3); q.material.opacity = 0.55 * (1 - a);
    }
  };
}
