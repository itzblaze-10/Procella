// People: one articulated low-poly rig, parameterised into 6 player characters and 8 NPC roles.
// Feet at y = 0, facing -z, ~1.75 m. Geometries and materials are shared across every person
// and freed when the last one is disposed.
import * as THREE from 'three';

// ---------- shared resources ----------
const GEO = {};
const MAT = new Map();
let live = 0;

const MAKE = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  taper: () => new THREE.CylinderGeometry(0.5 * Math.SQRT2, 0.42 * Math.SQRT2, 1, 4).rotateY(Math.PI / 4), // box, narrower at the bottom
  sphere: () => new THREE.SphereGeometry(0.5, 8, 6),
  hemi: () => new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: () => new THREE.ConeGeometry(0.5, 1, 8),
  skirt: () => new THREE.CylinderGeometry(0.36, 0.5, 1, 8),
  torus: () => new THREE.TorusGeometry(0.5, 0.1, 5, 14),
  arc: () => new THREE.TorusGeometry(0.5, 0.06, 4, 10, Math.PI),
};
const geo = (n) => GEO[n] || (GEO[n] = MAKE[n]());

function mat(hex, rough = 0.85, metal = 0) {
  const key = `${hex}|${rough}|${metal}`;
  if (!MAT.has(key)) MAT.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, flatShading: true }));
  return MAT.get(key);
}

function part(parent, g, color, s, p = [0, 0, 0], r) {
  const m = new THREE.Mesh(geo(g), typeof color === 'string' ? mat(color) : color);
  m.scale.set(...s);
  m.position.set(...p);
  if (r) m.rotation.set(...r);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function pivot(parent, p = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...p);
  parent.add(g);
  return g;
}

// ---------- tiny seeded random (mulberry32) ----------
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const _c = new THREE.Color();
const shade = (hex, rng, l = 0.08) => '#' + _c.set(hex).offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.12, (rng() - 0.5) * 2 * l).getHexString();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---------- rig dimensions (metres, at 1.75 m) ----------
const BASE_H = 1.75;
const ANK = 0.07, L2 = 0.42, L1 = 0.43, HIP_Y = ANK + L2 + L1; // hip joint at 0.92
const TH = 0.47, UA = 0.29, LA = 0.26; // torso height, upper/lower arm
const HW = 0.19, HH = 0.22, HD = 0.21; // head box; head top lands at 1.75

// Arm poses for held props. tilt = prop pitch relative to the body, kept steady while the arm swings.
const HOLD = {
  upright: { arm: 0.15, elbow: 1.1, swing: 0.25 },
  chest: { arm: 0.12, elbow: 1.45, swing: 0.12 },
  hang: { arm: 0.04, elbow: 0.2, swing: 0.4 },
};
const FREE = { arm: 0, elbow: 0, swing: 1 };
function hold(r, side, kind, tilt = 0) {
  const a = r.arms[side > 0 ? 1 : 0];
  const g = pivot(a.hand, [0, -0.05, 0]);
  a.hold = { ...HOLD[kind], tilt, g };
  return g;
}

// ---------- accessories: (rig, options) => void ----------
const STRAW = '#d9b56c', METAL = '#7d8187', DARK = '#23252a';
const ring = (r, f) => [r.TW * (0.84 + 0.16 * f), r.TD * (0.84 + 0.16 * f)]; // torso size at height fraction f
const ACC = {
  // headwear (on the head pivot; head box spans y 0..0.22)
  sunhat: ({ head }, o) => {
    part(head, 'cyl', o.color, [0.29, 0.1, 0.31], [0, 0.225, 0]);
    part(head, 'cyl', o.color, [0.52, 0.012, 0.54], [0, 0.182, 0]);
    part(head, 'cyl', o.band, [0.295, 0.025, 0.315], [0, 0.195, 0]);
  },
  strawhat: ({ head }, o) => {
    if (o.conical) return void part(head, 'cone', STRAW, [0.62, 0.13, 0.62], [0, 0.225, 0]);
    part(head, 'cyl', STRAW, [0.27, 0.085, 0.29], [0, 0.225, 0]);
    part(head, 'cyl', STRAW, [0.6, 0.012, 0.6], [0, 0.185, 0]);
    part(head, 'cyl', '#7a4a2a', [0.275, 0.02, 0.295], [0, 0.197, 0]);
  },
  knitcap: ({ head }, o) => {
    part(head, 'box', o.color, [HW + 0.03, 0.1, HD + 0.03], [0, 0.2, 0]);
    part(head, 'hemi', o.color, [0.2, 0.06, 0.22], [0, 0.248, 0]);
    part(head, 'box', shade(o.color, rand(7), 0.06), [HW + 0.045, 0.045, HD + 0.045], [0, 0.16, 0]);
  },
  hardhat: ({ head }, o) => {
    part(head, 'hemi', mat(o.color, 0.5), [0.3, 0.22, 0.32], [0, 0.185, 0]);
    part(head, 'cyl', mat(o.color, 0.5), [0.33, 0.015, 0.37], [0, 0.19, -0.012]);
    part(head, 'box', mat(o.color, 0.5), [0.03, 0.02, 0.26], [0, 0.29, 0]);
  },
  headwrap: ({ head }, o) => {
    part(head, 'box', o.color, [HW + 0.04, 0.12, HD + 0.04], [0, 0.19, 0]);
    part(head, 'sphere', o.color, [0.09, 0.08, 0.07], [0, 0.17, HD / 2 + 0.04]);
  },
  goggles: ({ head }) => {
    part(head, 'box', DARK, [HW + 0.025, 0.028, HD + 0.025], [0, 0.17, 0]);
    for (const x of [-0.045, 0.045]) part(head, 'cyl', mat('#5fa8c9', 0.25, 0.3), [0.06, 0.03, 0.06], [x, 0.17, -HD / 2 - 0.02], [Math.PI / 2, 0, 0]);
  },
  headset: ({ head }) => {
    part(head, 'arc', DARK, [0.25, 0.25, 0.25], [0, 0.11, 0]);
    for (const x of [-1, 1]) part(head, 'cyl', '#3a3d44', [0.075, 0.04, 0.075], [x * 0.115, 0.1, 0], [0, 0, Math.PI / 2]);
    part(head, 'box', DARK, [0.012, 0.012, 0.11], [-0.11, 0.06, -0.06], [0, -0.35, 0]);
  },
  // torso wear (on the spine pivot; torso spans y 0..TH)
  bands: (r, o) => {
    for (const f of [0.25, 0.5, 0.75]) { const [w, d] = ring(r, f); part(r.spine, 'box', o.color, [w + 0.014, 0.025, d + 0.014], [0, TH * f, 0]); }
  },
  backpack: (r, o) => {
    const z = r.TD / 2 + 0.1;
    part(r.spine, 'box', o.color, [r.TW * 0.85, 0.44, 0.2], [0, TH * 0.5, z]);
    part(r.spine, 'cyl', '#4d5a3a', [0.13, r.TW * 0.95, 0.13], [0, TH * 0.5 + 0.28, z], [0, 0, Math.PI / 2]);
    for (const x of [-1, 1]) part(r.spine, 'box', DARK, [0.04, 0.4, 0.012], [x * r.TW * 0.25, TH * 0.55, -r.TD / 2 - 0.006]);
  },
  rope: (r, o) => {
    for (const dz of [0, 0.03]) part(r.spine, 'torus', o.color, [0.26, 0.26, 0.4], [0.02, TH * 0.48, r.TD / 2 + 0.22 + dz]);
  },
  vest: (r, o) => {
    const z = -r.TD / 2 - 0.016;
    part(r.spine, 'taper', o.color, [r.TW + 0.025, TH * 0.82, r.TD + 0.025], [0, TH * 0.55, 0]);
    part(r.spine, 'box', r.spec.top.color, [0.05, TH * 0.8, 0.01], [0, TH * 0.56, z]);
    for (const x of [-1, 1]) for (const y of [0.32, 0.6]) part(r.spine, 'box', shade(o.color, rand(3), 0.05), [0.075, 0.065, 0.02], [x * r.TW * 0.27, TH * y, z]);
  },
  camera: (r) => {
    const z = -r.TD / 2 - 0.05;
    part(r.spine, 'box', mat(DARK, 0.5), [0.13, 0.085, 0.06], [0, TH * 0.55, z]);
    part(r.spine, 'cyl', mat('#33363c', 0.4), [0.065, 0.07, 0.065], [0, TH * 0.55, z - 0.06], [Math.PI / 2, 0, 0]);
    part(r.spine, 'cyl', mat('#1d3550', 0.15, 0.4), [0.05, 0.01, 0.05], [0, TH * 0.55, z - 0.096], [Math.PI / 2, 0, 0]);
    for (const x of [-1, 1]) part(r.spine, 'box', DARK, [0.018, 0.22, 0.01], [x * 0.065, TH * 0.78, -r.TD / 2 - 0.025], [0, 0, x * 0.3]);
  },
  hood: (r, o) => {
    part(r.spine, 'box', o.color, [r.TW * 0.6, 0.1, 0.1], [0, TH - 0.01, r.TD / 2 + 0.02]);
    part(r.spine, 'box', shade(o.color, rand(5), 0.06), [0.014, TH * 0.85, 0.008], [0, TH * 0.5, -r.TD / 2 - 0.004]);
  },
  collar: (r, o) => {
    part(r.spine, 'box', o.color, [r.TW * 0.78, 0.07, r.TD + 0.03], [0, TH - 0.02, 0]);
    part(r.spine, 'box', METAL, [0.012, TH * 0.8, 0.008], [0, TH * 0.48, -r.TD / 2 - 0.004]);
  },
  scarf: (r, o) => {
    part(r.spine, 'cyl', o.color, [0.18, 0.09, 0.18], [0, TH + 0.03, 0]);
    part(r.spine, 'box', o.color, [0.08, 0.2, 0.02], [0.05, TH - 0.08, -r.TD / 2 - 0.012], [0, 0, 0.1]);
  },
  shawl: (r, o) => {
    part(r.spine, 'box', o.color, [r.TW + 0.07, 0.15, r.TD + 0.07], [0, TH - 0.05, 0]);
    for (const x of [-1, 1]) {
      part(r.spine, 'box', o.color, [0.09, 0.34, 0.02], [x * r.TW * 0.22, TH - 0.25, -r.TD / 2 - 0.03]);
      part(r.spine, 'box', o.stripe, [0.092, 0.03, 0.022], [x * r.TW * 0.22, TH - 0.38, -r.TD / 2 - 0.03]);
    }
    part(r.spine, 'box', o.stripe, [r.TW + 0.075, 0.025, r.TD + 0.075], [0, TH - 0.1, 0]);
  },
  bib: (r, o) => { // overalls and waders
    const zf = -r.TD / 2 - 0.008;
    part(r.spine, 'box', o.color, [r.TW * 0.62, TH * 0.48, 0.02], [0, TH * 0.26, zf]);
    for (const x of [-1, 1]) for (const z of [zf, -zf]) part(r.spine, 'box', o.color, [0.035, TH * 0.55, 0.012], [x * r.TW * 0.22, TH * 0.72, z]);
    part(r.spine, 'box', shade(o.color, rand(9), 0.06), [0.09, 0.07, 0.024], [0, TH * 0.32, zf - 0.004]);
  },
  hivis: (r, o) => {
    part(r.spine, 'taper', o.color, [r.TW + 0.025, TH * 0.8, r.TD + 0.025], [0, TH * 0.55, 0]);
    for (const f of [0.35, 0.65]) { const [w, d] = ring(r, f); part(r.spine, 'box', mat('#dfe3e6', 0.35, 0.4), [w + 0.04, 0.03, d + 0.04], [0, TH * f, 0]); }
  },
  apron: (r, o) => {
    part(r.spine, 'box', o.color, [r.TW * 0.8, TH * 0.65, 0.015], [0, TH * 0.4, -r.TD / 2 - 0.01]);
    const flap = pivot(r.pelvis, [0, -0.02, -r.PD / 2 - 0.014]);
    part(flap, 'box', o.color, [r.PW, 0.45, 0.015], [0, -0.22, 0]);
    r.flaps.push(flap);
  },
  skirt: (r, o) => {
    part(r.pelvis, 'skirt', o.color, [(r.PW + 0.04) / 0.72, 0.52, (r.PD + 0.05) / 0.72], [0, -0.2, 0]);
  },
  toolbelt: (r) => {
    part(r.pelvis, 'box', '#6b4a2b', [r.PW + 0.03, 0.06, r.PD + 0.03], [0, 0.05, 0]);
    part(r.pelvis, 'box', '#8a5a33', [0.025, 0.18, 0.025], [r.PW / 2 + 0.01, -0.05, 0.05]);
    part(r.pelvis, 'box', mat(METAL, 0.4, 0.5), [0.03, 0.03, 0.09], [r.PW / 2 + 0.01, 0.04, 0.05]);
  },
  satchel: (r, o) => {
    for (const z of [-r.TD / 2 - 0.012, r.TD / 2 + 0.012]) part(r.spine, 'box', o.color, [0.035, 0.62, 0.012], [0, TH * 0.55, z], [0, 0, 0.75]);
    part(r.spine, 'box', o.color, [0.26, 0.2, 0.07], [r.TW * 0.3, 0.02, r.TD / 2 + 0.05]);
  },
  badge: (r) => {
    const z = -r.TD / 2 - 0.006;
    part(r.spine, 'box', '#f4f4f0', [0.05, 0.07, 0.008], [r.TW * 0.25, TH * 0.7, z]);
    part(r.spine, 'box', '#2f6fb0', [0.05, 0.018, 0.01], [r.TW * 0.25, TH * 0.7 + 0.026, z]);
  },
  stethoscope: (r) => {
    part(r.spine, 'torus', DARK, [0.18, 0.18, 0.18], [0, TH + 0.01, 0], [Math.PI / 2, 0, 0]);
    for (const x of [-1, 1]) part(r.spine, 'cyl', DARK, [0.012, 0.2, 0.012], [x * 0.05, TH - 0.1, -r.TD / 2 - 0.012]);
    part(r.spine, 'cyl', mat(METAL, 0.3, 0.7), [0.04, 0.015, 0.04], [0.05, TH - 0.21, -r.TD / 2 - 0.014], [Math.PI / 2, 0, 0]);
  },
  // held props
  hoe: (r) => {
    const g = hold(r, 1, 'upright');
    part(g, 'cyl', '#8a6338', [0.032, 1.35, 0.032], [0, -0.22, 0]);
    part(g, 'box', mat(METAL, 0.5, 0.5), [0.17, 0.1, 0.02], [0, -0.84, -0.06], [0.5, 0, 0]);
  },
  staff: (r) => {
    const g = hold(r, 1, 'upright');
    part(g, 'cyl', '#7a5530', [0.036, 1.5, 0.036], [0, -0.14, 0]);
    part(g, 'sphere', '#6a4627', [0.055, 0.06, 0.055], [0, 0.62, 0]);
  },
  net: (r) => {
    const g = hold(r, 1, 'hang');
    part(g, 'cone', '#a7b2a2', [0.3, 0.48, 0.3], [0, -0.26, 0]);
    part(g, 'torus', mat('#4a4d52', 0.5, 0.4), [0.3, 0.3, 0.3], [0, -0.5, 0], [Math.PI / 2, 0, 0]);
  },
  wrench: (r) => {
    const g = hold(r, 1, 'hang');
    part(g, 'box', mat(METAL, 0.4, 0.6), [0.03, 0.2, 0.015], [0, -0.1, 0]);
    part(g, 'box', mat(METAL, 0.4, 0.6), [0.07, 0.05, 0.015], [0, -0.22, 0]);
  },
  book: (r, o) => {
    const g = hold(r, -1, 'chest', -0.6);
    part(g, 'box', o.color, [0.16, 0.22, 0.04], [0, 0, 0]);
    part(g, 'box', '#f1ece0', [0.15, 0.205, 0.042], [0.008, 0, 0]);
  },
  clipboard: (r) => {
    const g = hold(r, -1, 'chest', -0.9);
    part(g, 'box', '#8a5a33', [0.2, 0.27, 0.012], [0, 0, 0]);
    part(g, 'box', '#f4f1e8', [0.17, 0.22, 0.004], [0, -0.01, 0.008]);
    part(g, 'box', mat(METAL, 0.4, 0.6), [0.07, 0.025, 0.012], [0, 0.125, 0.01]);
  },
  basket: (r, o) => {
    const g = hold(r, -1, 'hang');
    part(g, 'cyl', '#b48a4f', [0.3, 0.16, 0.3], [0, -0.22, 0]);
    part(g, 'cyl', '#8f6a39', [0.31, 0.03, 0.31], [0, -0.15, 0]);
    part(g, 'arc', '#8f6a39', [0.27, 0.27, 0.27], [0, -0.14, 0]);
    o.fruit.forEach((c, i) => part(g, 'sphere', c, [0.08, 0.08, 0.08], [(i - 1) * 0.08, -0.13, (i % 2) * 0.04 - 0.02]));
  },
};
const HATS = new Set(['sunhat', 'strawhat', 'knitcap', 'hardhat', 'headwrap']);

// ---------- face and hair ----------
function face(head, skin, hairColor, facial) {
  const z = -HD / 2;
  for (const x of [-0.045, 0.045]) {
    part(head, 'box', '#f2efe9', [0.05, 0.03, 0.01], [x, 0.125, z - 0.002]);
    part(head, 'box', '#1b1b1f', [0.024, 0.03, 0.012], [x, 0.125, z - 0.005]);
    part(head, 'box', hairColor, [0.055, 0.012, 0.015], [x, 0.158, z - 0.006], [0, 0, x > 0 ? -0.08 : 0.08]);
    part(head, 'box', skin, [0.03, 0.05, 0.04], [x * 2.2, 0.11, 0]); // ears
  }
  part(head, 'box', shade(skin, rand(11), 0.04), [0.035, 0.05, 0.04], [0, 0.095, z - 0.01]);
  part(head, 'box', '#6e3a34', [0.06, 0.012, 0.01], [0, 0.05, z - 0.003]);
  if (facial === 'beard') part(head, 'box', hairColor, [HW * 0.92, 0.08, 0.07], [0, 0.035, z + 0.025]);
  if (facial === 'beard' || facial === 'moustache') part(head, 'box', hairColor, [0.075, 0.016, 0.02], [0, 0.068, z - 0.007]);
}

function hair(head, { style, color: c }, hasHat) {
  if (style === 'bald') return;
  if (!hasHat) {
    if (style === 'curly') part(head, 'sphere', c, [HW + 0.07, 0.17, HD + 0.07], [0, HH - 0.01, 0.012]);
    else {
      const th = style === 'buzz' ? 0.02 : 0.05;
      part(head, 'box', c, [HW + 0.02, th, HD + 0.02], [0, HH + th / 2 - 0.012, 0]);
      if (style !== 'buzz') part(head, 'box', c, [HW + 0.02, 0.07, HD * 0.75], [0, HH - 0.04, 0.03]);
    }
  }
  part(head, 'box', c, [HW + 0.02, 0.14, 0.03], [0, HH - 0.08, HD / 2 + 0.005]);
  if (style === 'long') part(head, 'box', c, [HW + 0.03, 0.3, 0.05], [0, 0.05, HD / 2 + 0.02]);
  if (style === 'bun') part(head, 'sphere', c, [0.1, 0.1, 0.1], [0, HH - 0.02, HD / 2 + 0.04]);
  if (style === 'ponytail') part(head, 'cyl', c, [0.05, 0.2, 0.05], [0, 0.08, HD / 2 + 0.05], [0.25, 0, 0]);
  if (style === 'braid') for (let i = 0; i < 4; i++) part(head, 'sphere', c, [0.055, 0.065, 0.055], [0, 0.1 - i * 0.07, HD / 2 + 0.03]);
}

// ---------- the one rig builder ----------
// ponytail: ~35-42 meshes (draw calls) per person and materials are shared by colour, so never mutate one per person.
// Fine for a few dozen NPCs; for big crowds merge each pivot's static meshes (BufferGeometryUtils.mergeGeometries).
function buildPerson(spec, seed) {
  const s = { build: 1, shoulder: 1, hip: 1, height: BASE_H, acc: [], ...spec };
  const b = s.build;
  const object = new THREE.Group();
  const rig = pivot(object);
  rig.scale.setScalar(s.height / BASE_H);
  const body = pivot(rig);
  const pelvis = pivot(body, [0, HIP_Y, 0]);
  const r = {
    spec: s, rig, body, pelvis, flaps: [],
    TW: 0.36 * s.shoulder * b, TD: 0.2 * b * (b > 1.1 ? 1.12 : 1), PW: 0.31 * s.hip * b, PD: 0.2 * b,
  };
  const { top, bottom, skin } = s;
  part(pelvis, 'box', bottom.color, [r.PW, 0.2, r.PD]);
  r.spine = pivot(pelvis, [0, 0.08, 0]);
  r.torso = part(r.spine, 'taper', top.color, [r.TW, TH, r.TD], [0, TH / 2, 0]);

  r.arms = [-1, 1].map((side) => { // index 0 = left (-x), 1 = right (+x)
    const sh = pivot(r.spine, [side * (r.TW / 2 + 0.035 * b), TH - 0.05, 0]);
    part(sh, 'taper', top.color, [0.09 * b, UA, 0.09 * b], [0, -UA / 2, 0]);
    const el = pivot(sh, [0, -UA, 0]);
    part(el, 'taper', top.sleeves === 'short' ? skin : top.color, [0.075 * b, LA, 0.075 * b], [0, -LA / 2, 0]);
    const hand = pivot(el, [0, -LA, 0]);
    part(hand, 'box', s.gloves || skin, [0.07 * b, 0.09, 0.04], [0, -0.045, 0]);
    return { side, sh, el, hand, hold: null };
  });
  r.legs = [-1, 1].map((side) => {
    const hip = pivot(pelvis, [side * r.PW * 0.28, 0, 0]);
    part(hip, 'taper', bottom.color, [0.13 * b, L1, 0.14 * b], [0, -L1 / 2, 0]);
    const knee = pivot(hip, [0, -L1, 0]);
    part(knee, 'taper', bottom.shorts ? skin : bottom.color, [0.1 * b, L2, 0.11 * b], [0, -L2 / 2, 0]);
    const ankle = pivot(knee, [0, -L2, 0]);
    part(ankle, 'box', s.shoes, [0.1 * b, ANK, 0.24], [0, -ANK / 2, -0.06]);
    return { hip, knee, ankle };
  });
  const neck = pivot(r.spine, [0, TH, 0]);
  part(neck, 'cyl', skin, [0.09 * b, 0.09, 0.09 * b], [0, 0.03, 0]);
  r.head = pivot(neck, [0, 0.06, 0]);
  part(r.head, 'box', skin, [HW, HH, HD], [0, HH / 2, 0]);
  face(r.head, skin, s.hair.color, s.facial);
  hair(r.head, s.hair, s.acc.some(([n]) => HATS.has(n)));
  for (const [name, o] of s.acc) ACC[name](r, o || {});

  live++;
  let disposed = false;
  return { object, height: s.height, ...animator(r, rand(seed)), dispose() {
    if (disposed) return;
    disposed = true;
    object.removeFromParent();
    if (--live === 0) { // last person gone: free the shared pool
      for (const k in GEO) { GEO[k].dispose(); delete GEO[k]; }
      MAT.forEach((m) => m.dispose());
      MAT.clear();
    }
  } };
}

// ---------- animation: idle / walk / run blend, talk layered on top ----------
function animator(r, rng) {
  let t = rng() * 10, phase = 0, walkW = 0, runW = 0, talkW = 0, talking = false;
  let yaw = 0, yawTarget = 0, nextTurn = 1.5 + rng() * 3;
  const tb = r.torso.scale.clone();
  const S = r.rig.scale.x;
  const gestureArm = r.arms[1].hold && !r.arms[0].hold ? 0 : 1; // talk with a free hand
  const hips = [0, 0], knees = [0, 0];

  function update(dt, speedMps = 0) {
    const speed = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
    t += dt;
    const k = 1 - Math.exp(-8 * dt);
    walkW += ((speed >= 0.2 ? 1 : 0) - walkW) * k;
    runW += (clamp01((speed - 2.2) / 1.6) - runW) * k; // full run by ~3.8 m/s
    talkW += ((talking ? 1 : 0) - talkW) * (1 - Math.exp(-5 * dt));
    // one cycle = two steps; stride grows with the run blend, so cadence tracks speed
    phase = (phase + (dt * Math.PI * Math.min(speed, 10)) / ((0.7 + 0.6 * runW) * S)) % (Math.PI * 2);

    const w = walkW, sp = Math.sin(phase), cp = Math.cos(phase);
    const breath = Math.sin(t * 1.7);
    const hipA = lerp(0.42, 0.68, runW) * w, kneeA = lerp(0.6, 1.5, runW);
    hips[0] = hipA * sp; hips[1] = -hipA * sp;
    knees[0] = -lerp(0.04, 0.1 + kneeA * Math.max(0, cp), w);
    knees[1] = -lerp(0.04, 0.1 + kneeA * Math.max(0, -cp), w);
    r.legs.forEach((l, i) => {
      l.hip.rotation.x = hips[i];
      l.knee.rotation.x = knees[i];
      l.ankle.rotation.x = -(hips[i] + knees[i]); // keep soles flat
    });
    // drop the body so the lower foot touches y = 0 (natural walk bob); running drops less, so feet leave the ground
    const ext = (i) => L1 * Math.cos(hips[i]) + L2 * Math.cos(hips[i] + knees[i]);
    r.body.position.y = (Math.max(ext(0), ext(1)) - (L1 + L2)) * (1 - 0.5 * runW);
    r.body.rotation.z = 0.015 * Math.sin(t * 0.8) * (1 - w);
    r.pelvis.rotation.y = -0.07 * sp * w;
    r.spine.rotation.y = 0.1 * sp * w;
    r.spine.rotation.x = lerp(0.012 * breath, -0.04 - 0.22 * runW, w);
    r.torso.scale.set(tb.x * (1 + 0.012 * breath * (1 - w)), tb.y, tb.z * (1 + 0.03 * breath * (1 - w)));
    for (const f of r.flaps) f.rotation.x = Math.max(0, hips[0], hips[1]) * 0.9;

    const armA = lerp(0.38, 0.85, runW);
    const talk = talkW * (1 - 0.7 * w);
    r.arms.forEach((a, i) => {
      const h = a.hold || FREE;
      const g = talk * (i === gestureArm ? 1 : 0.3);
      const ax = h.arm + 0.03 * breath * (1 - w) + (i ? 1 : -1) * armA * sp * h.swing * w
        + g * (0.5 + 0.25 * Math.sin(t * 2.7 + i * 2));
      const ex = h.elbow + lerp(0.12, lerp(0.25, 1.3, runW), w) * (a.hold ? 0.3 : 1)
        + g * (0.8 + 0.35 * Math.sin(t * 3.7 + i));
      a.sh.rotation.x = ax;
      a.sh.rotation.z = a.side * (0.07 + g * 0.12 * (1 + Math.sin(t * 1.9 + i)));
      a.el.rotation.x = ex;
      if (a.hold) a.hold.g.rotation.x = a.hold.tilt - ax - ex; // prop keeps its pitch while the arm moves
    });

    if ((nextTurn -= dt) <= 0) {
      yawTarget = rng() < 0.4 ? 0 : (rng() - 0.5) * 1.2;
      nextTurn = 2.5 + rng() * 4.5;
    }
    yaw += (yawTarget * (1 - w) * (1 - talkW) - yaw) * (1 - Math.exp(-3 * dt));
    r.head.rotation.y = yaw;
    r.head.rotation.x = -r.spine.rotation.x * 0.6 + talkW * 0.07 * Math.sin(t * 4.5) + 0.02 * breath * (1 - w);
  }
  update(0, 0); // settle into the idle pose
  return { update, setTalking: (v) => { talking = !!v; } };
}

// ---------- palettes ----------
const SKIN = ['#f5d6c1', '#eabf9f', '#dba67f', '#c98d62', '#b07448', '#94603a', '#76492b', '#5a3620', '#432817'];
const HAIR = ['#151210', '#1f1712', '#3b2a1e', '#5a3d27', '#7a4b2a', '#a8743f', '#c9a463'];

// ---------- player characters ----------
const LOOKS = {
  mountaineer: {
    height: 1.68, shoulder: 0.92, hip: 1.06, skin: '#b98157', hair: { style: 'braid', color: '#18120e' },
    top: { color: '#c8372d' }, bottom: { color: '#3b4048' }, shoes: '#5a3b22', gloves: '#2d2f33',
    acc: [['bands', { color: '#a12a22' }], ['backpack', { color: '#e09a2b' }], ['rope', { color: '#2f7fc1' }]],
  },
  photojournalist: {
    height: 1.8, build: 1.05, shoulder: 1.05, hip: 0.95, skin: '#5a3825', hair: { style: 'curly', color: '#141010' }, facial: 'beard',
    top: { color: '#2c3e5c', sleeves: 'short' }, bottom: { color: '#3d3a35' }, shoes: '#2a2420',
    acc: [['vest', { color: '#a89060' }], ['camera']],
  },
  scientist: {
    height: 1.64, shoulder: 0.9, hip: 1.08, skin: '#d9a77f', hair: { style: 'ponytail', color: '#4a2c1a' },
    top: { color: '#8fb8d8', sleeves: 'short' }, bottom: { color: '#b9a57d', shorts: true }, shoes: '#6b5039',
    acc: [['sunhat', { color: '#e8dcb5', band: '#6b8f3a' }], ['clipboard']],
  },
  sailor: {
    height: 1.82, build: 1.15, shoulder: 1.06, hip: 0.97, skin: '#f0c8ae', hair: { style: 'short', color: '#b5562a' }, facial: 'beard',
    top: { color: '#f2c230' }, bottom: { color: '#2b3a55' }, shoes: '#1f2326',
    acc: [['knitcap', { color: '#1f3a5f' }], ['hood', { color: '#f2c230' }]],
  },
  trekker: {
    height: 1.7, shoulder: 0.9, hip: 1.06, skin: '#c08a62', hair: { style: 'long', color: '#1a1210' },
    top: { color: '#e7dfcc' }, bottom: { color: '#8a7357' }, shoes: '#a07a4f',
    acc: [['headwrap', { color: '#d9c39a' }], ['goggles'], ['scarf', { color: '#b5562f' }]],
  },
  pilot: {
    height: 1.76, shoulder: 1.04, hip: 0.96, skin: '#e2b48c', hair: { style: 'short', color: '#121212' },
    top: { color: '#6b4226' }, bottom: { color: '#5b5f4a' }, shoes: '#2c2622',
    acc: [['collar', { color: '#e6d8bf' }], ['headset']],
  },
};

export const CHARACTERS = [
  { id: 'mountaineer', name: 'Pema Lhamo', title: 'Mountaineer', blurb: 'Six summits in, she has watched the glaciers below each one pull back a little further every season.' },
  { id: 'photojournalist', name: 'Kofi Mensah', title: 'Photojournalist', blurb: 'Twenty years of front pages. Now he chases the stories written in rivers, coastlines and fields.' },
  { id: 'scientist', name: 'Lucía Ortega', title: 'Field Scientist', blurb: 'Soil probes, weather logs and a clipboard full of numbers that refuse to lie.' },
  { id: 'sailor', name: 'Erik Halvorsen', title: 'Sailor', blurb: 'Eleven North Atlantic crossings, and the sea ice is no longer where his old charts put it.' },
  { id: 'trekker', name: 'Amira Haddad', title: 'Desert Trekker', blurb: 'Walks the dunes by starlight and keeps count of how far the sand moves each year.' },
  { id: 'pilot', name: 'Kaito Mori', title: 'Bush Pilot', blurb: 'Lands on gravel bars and glacier strips, flying supplies where no road reaches.' },
];

export function createCharacter(id) {
  const look = LOOKS[id];
  if (!look) throw new Error(`Unknown character id: ${id}`);
  const p = buildPerson(look, CHARACTERS.findIndex((c) => c.id === id) + 101);
  p.id = id;
  return p;
}

// ---------- NPCs ----------
export const NPC_ROLES = ['farmer', 'fisher', 'factory', 'herder', 'teacher', 'nurse', 'builder', 'vendor'];

// role => (rng, feminine) => outfit fields merged over the random base person
const ROLES = {
  farmer: (rng, f) => {
    const skirt = f && rng() < 0.4 ? shade(pick(rng, ['#7a3b5a', '#3f5f8a', '#6b5a3a']), rng) : null;
    return {
      top: { color: shade(pick(rng, ['#6d8b4e', '#b9493a', '#d8cfb8', '#4f6d8f']), rng) },
      bottom: skirt ? { color: skirt, shorts: true } : { color: shade('#5a4a38', rng) },
      acc: [['strawhat', { conical: rng() < 0.4 }], ['hoe'], ...(skirt ? [['skirt', { color: skirt }]] : [])],
    };
  },
  fisher: (rng) => {
    const wader = shade(pick(rng, ['#4b5a3a', '#2f3b33', '#3a4250']), rng, 0.05);
    return {
      top: { color: shade(pick(rng, ['#2f5e7d', '#c94f2d', '#d9d2c2', '#e0b53a']), rng) },
      bottom: { color: wader }, shoes: '#1e2420',
      acc: [['bib', { color: wader }], ['net'], ...(rng() < 0.45 ? [['knitcap', { color: shade(pick(rng, ['#1f3a5f', '#9b2b2b', '#3d4a3a']), rng) }]] : [])],
    };
  },
  factory: (rng) => {
    const overall = shade(pick(rng, ['#2f4f7f', '#4b5563', '#7a3b2e', '#3b5a4a']), rng);
    return {
      top: { color: shade(pick(rng, ['#c9ccd1', '#e9e6df', '#8a9099']), rng, 0.04) },
      bottom: { color: overall }, gloves: '#cfa94a',
      acc: [['bib', { color: overall }], ['hardhat', { color: pick(rng, ['#f2f2ee', '#f2c230', '#e06a1f']) }], ['wrench']],
    };
  },
  herder: (rng, f) => {
    const skirt = f && rng() < 0.5 ? shade(pick(rng, ['#5a2f3a', '#3b4a6b', '#6b4f2f']), rng) : null;
    return {
      top: { color: shade(pick(rng, ['#8a5a3c', '#6b4f8a', '#3e6b5a', '#7d6a4f']), rng) },
      bottom: skirt ? { color: skirt, shorts: true } : { color: shade('#4e4436', rng) },
      acc: [['shawl', { color: shade(pick(rng, ['#a3322c', '#d98c2b', '#4a6fa5', '#6b2d5c']), rng), stripe: shade(pick(rng, ['#f0e2c0', '#1f1f24', '#e0b53a']), rng, 0.04) }],
        ['staff'], ...(skirt ? [['skirt', { color: skirt }]] : [])],
    };
  },
  teacher: (rng, f) => {
    const skirt = f && rng() < 0.5 ? shade(pick(rng, ['#3b3f4a', '#6b3a3a', '#2f4a5a']), rng) : null;
    return {
      top: { color: shade(pick(rng, ['#e8e2d4', '#9bb7d4', '#c97b63', '#6e8f6a']), rng) },
      bottom: skirt ? { color: skirt, shorts: true } : { color: shade(pick(rng, ['#3b3f4a', '#5b4b3d']), rng) },
      acc: [['book', { color: shade(pick(rng, ['#8a2b2b', '#2b4a8a', '#2b6b4a']), rng) }], ['satchel', { color: shade('#7a4e2d', rng) }],
        ...(skirt ? [['skirt', { color: skirt }]] : [])],
    };
  },
  nurse: (rng) => {
    const scrubs = shade(pick(rng, ['#4fa3a5', '#3d6fb3', '#7b5ea7', '#58a37a']), rng, 0.05);
    return { top: { color: scrubs, sleeves: 'short' }, bottom: { color: scrubs }, shoes: '#e8e8e8', acc: [['badge'], ['stethoscope']] };
  },
  builder: (rng) => ({
    top: { color: shade(pick(rng, ['#6d7a86', '#9a5b3a', '#3c4a5c', '#d9d2c2']), rng) },
    bottom: { color: shade('#3a4252', rng) }, gloves: '#c9a26b', shoes: '#5a4026',
    acc: [['hivis', { color: pick(rng, ['#c8f03a', '#ff7a1a']) }], ['hardhat', { color: pick(rng, ['#f2c230', '#f2f2ee', '#e06a1f']) }], ['toolbelt']],
  }),
  vendor: (rng, f) => {
    const skirt = f && rng() < 0.6 ? shade(pick(rng, ['#c0392b', '#e5a43a', '#2e86ab', '#8e44ad', '#27ae60']), rng) : null;
    return {
      top: { color: shade(pick(rng, ['#d0453a', '#e5a43a', '#3a8fb7', '#8a3a7a', '#4c8a4c']), rng) },
      bottom: skirt ? { color: skirt, shorts: true } : { color: shade(pick(rng, ['#3b3f4a', '#6b5a3a']), rng) },
      acc: [['apron', { color: shade(pick(rng, ['#f2efe6', '#3f6e9b', '#c9b48a']), rng, 0.04) }],
        ['basket', { fruit: [pick(rng, ['#e8862a', '#d6402e']), pick(rng, ['#6fae3a', '#e8c23a']), pick(rng, ['#d6402e', '#7a3a8a'])] }],
        ...(skirt ? [['skirt', { color: skirt }]] : []),
        ...(f && rng() < 0.35 ? [['headwrap', { color: shade(pick(rng, ['#e5a43a', '#c0392b', '#2e86ab']), rng) }]] : [])],
    };
  },
};

export function createNPC(role, seed = 0) {
  const idx = NPC_ROLES.indexOf(role);
  if (idx < 0) throw new Error(`Unknown NPC role: ${role}`);
  const s = Math.imul((seed | 0) + 1, 0x9e3779b1) ^ Math.imul(idx + 1, 0x85ebca6b);
  const rng = rand(s);
  const f = rng() < 0.5;
  const grey = rng() < 0.18;
  const base = {
    height: 1.55 + rng() * 0.3,
    build: 0.9 + rng() * 0.3,
    shoulder: f ? 0.9 : 1.05,
    hip: f ? 1.08 : 0.95,
    skin: shade(pick(rng, SKIN), rng, 0.03),
    hair: {
      style: pick(rng, f ? ['long', 'bun', 'ponytail', 'braid', 'short', 'curly'] : ['short', 'buzz', 'curly', 'bald', 'short']),
      color: grey ? pick(rng, ['#9a9a96', '#d8d6d0']) : pick(rng, HAIR),
    },
    facial: f ? null : pick(rng, [null, null, 'beard', 'moustache']),
    shoes: shade('#3a2c22', rng),
  };
  const p = buildPerson({ ...base, ...ROLES[role](rng, f) }, s ^ 0x5bd1e995);
  p.role = role;
  return p;
}
