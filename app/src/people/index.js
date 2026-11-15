// People: one articulated procedural rig, parameterised into 6 player characters and 8 NPC roles.
// A 7.5-head figure built from smooth lathe and capsule shapes, with a face, hair, role clothing and
// shoes. Legs are solved by two-bone IK so planted feet stay planted. Feet at y = 0, facing -z.
// Geometries, materials and the two canvas textures are shared by every person and freed when the
// last one is disposed.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- shared resources ----------
const GEO = new Map(), MAT = new Map(), TEX = {};
let live = 0;
const geo = (key, make) => GEO.get(key) || GEO.set(key, make()).get(key);
const lathe = (key, pts, seg = 14, phi0 = 0, phiLen = Math.PI * 2) =>
  geo(key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiLen));
const SPH = (w = 12, h = 8) => geo(`s${w}.${h}`, () => new THREE.SphereGeometry(1, w, h));
const CAP = (theta, from = 0) => geo(`c${theta}.${from}`, () => new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, from, theta));
const BOX = () => geo('box', () => new RoundedBoxGeometry(1, 1, 1, 1, 0.18));
const CYL = (top = 1) => geo(`y${top}`, () => new THREE.CylinderGeometry(top, 1, 1, 16));
const CONE = () => geo('cone', () => new THREE.ConeGeometry(1, 1, 20));
const RING = (tube, arc = Math.PI * 2) => geo(`t${tube}.${arc}`, () => new THREE.TorusGeometry(1, tube, 5, 14, arc));

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (u) => u * u * (3 - 2 * u);

// Capsule-like limb hanging from its pivot: top sphere r0 at y = 0, bottom sphere r1 at y = -len,
// optional muscle bulge. Spheres sit on the joints, so bending never opens a gap.
function limb(r0, r1, len, bulge = 0, at = 0.35, seg = 9) {
  const pts = [];
  for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI / 2; pts.push([Math.sin(a) * r1, -len - Math.cos(a) * r1]); }
  for (let i = 1; i < 5; i++) { const t = 1 - i / 5; pts.push([lerp(r0, r1, t) + bulge * Math.exp(-(((t - at) / 0.22) ** 2)), -len * t]); }
  for (let i = 0; i <= 3; i++) { const a = (1 - i / 3) * Math.PI / 2; pts.push([Math.sin(a) * r0, Math.cos(a) * r0]); }
  return lathe(`l${r0}.${r1}.${len}.${bulge}.${at}.${seg}`, pts, seg);
}

// Torso profile: unit radius by height above the waist (metres). Scaled by chest half-width and depth.
const TORSO = [[0, 0.84], [0.06, 0.82], [0.14, 0.86], [0.22, 0.95], [0.28, 1], [0.33, 1], [0.37, 0.98], [0.405, 0.92], [0.435, 0.72], [0.458, 0.5], [0.472, 0.34]];
function torsoR(y) {
  for (let i = 1; i < TORSO.length; i++) if (y <= TORSO[i][0]) {
    const [y0, r0] = TORSO[i - 1], [y1, r1] = TORSO[i];
    return lerp(r0, r1, (y - y0) / (y1 - y0));
  }
  return TORSO[TORSO.length - 1][1];
}
// A band of the torso surface from y0 to y1, optionally only part of the way round (phi = pi is the front).
const shell = (y0, y1, phi0 = 0, phiLen = Math.PI * 2) =>
  lathe(`sh${y0}.${y1}.${phi0}.${phiLen}`, Array.from({ length: 9 }, (_, i) => { const y = lerp(y0, y1, i / 8); return [torsoR(y), y]; }), phiLen > 3 ? 14 : 6, phi0, phiLen);
// Skirt or tunic hem hanging from the waist: radius 1 at the top, `flare` at the hem `len` below.
const skirtGeo = (len, flare) => lathe(`sk${len}.${flare}`, [[flare, -len], [lerp(1.12, flare, 0.55), -len * 0.55], [1.1, -len * 0.2], [0.95, 0.03], [0.72, 0.1]], 18);

// Canvas texture multiplied over material colours: soft folds and weave for cloth, strands for hair.
function tex(kind) {
  if (TEX[kind]) return TEX[kind];
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), img = ctx.createImageData(N, N), rnd = rand(kind === 'hair' ? 3 : 7);
  const strand = Array.from({ length: N }, () => rnd());
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const v = kind === 'hair'
      ? 0.72 + 0.22 * strand[i] + 0.06 * rnd()
      : 0.92 + 0.035 * Math.sin(2 * Math.PI * (2 * i / N + 0.25 * Math.sin(2 * Math.PI * j / N))) + 0.05 * (rnd() - 0.5) + 0.02 * ((i + j) % 2);
    const o = (j * N + i) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255 * clamp(v); img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'hair' ? 6 : 4, kind === 'hair' ? 1 : 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return (TEX[kind] = t);
}

// kind: cloth | drape (two-sided cloth) | glow (hi-vis) | skin | hair | rubber | plastic | leather | metal | eye | glass
function mat(hex, kind = 'cloth') {
  const key = `${hex}|${kind}`;
  if (MAT.has(key)) return MAT.get(key);
  const cloth = kind === 'cloth' || kind === 'drape' || kind === 'glow';
  const m = cloth
    ? new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.88, map: tex('cloth'), sheen: 0.6, sheenRoughness: 0.7, sheenColor: '#ffffff', side: kind === 'drape' ? THREE.DoubleSide : THREE.FrontSide })
    : new THREE.MeshStandardMaterial({
      color: hex,
      roughness: { skin: 0.6, hair: 0.55, rubber: 0.42, plastic: 0.32, leather: 0.62, metal: 0.35, eye: 0.12, glass: 0.08 }[kind] ?? 0.8,
      metalness: kind === 'metal' ? 0.8 : 0,
      map: kind === 'hair' ? tex('hair') : null,
    });
  if (kind === 'glow') { m.emissive.set(hex); m.emissiveIntensity = 0.22; }
  MAT.set(key, m);
  return m;
}

function part(parent, g, m, s, p = [0, 0, 0], r, shadow = true) {
  const mesh = new THREE.Mesh(g, typeof m === 'string' ? mat(m) : m);
  mesh.scale.set(...s);
  mesh.position.set(...p);
  if (r) mesh.rotation.set(...r);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
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
const _c = new THREE.Color(), _c2 = new THREE.Color();
const shade = (hex, rng, l = 0.07) => '#' + _c.set(hex).offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.1, (rng() - 0.5) * 2 * l).getHexString();
const darker = (hex, l) => '#' + _c.set(hex).offsetHSL(0, 0.04, -l).getHexString();

// ---------- rig dimensions (metres, for a 1.75 m person: 7.5 heads of 0.235 m) ----------
const BASE_H = 1.75, ANK = 0.075, L2 = 0.42, L1 = 0.43, HIP_Y = ANK + L2 + L1; // hip joint at 0.925
const SPINE_Y = 0.075; // waist above the hip joints; torso spans 0.45 to the neck, head pivot (chin) at 1.515

// One smooth head mesh: a sphere reshaped into cranium, cheeks and a narrower jaw and chin (chin = width
// at the chin as a share of the cranium). Chin at y = 0, crown at 0.236, face toward -z.
const HW = 0.078, HH = 0.118, HD = 0.097;
const headW = (y, chin) => (y > -0.15 ? 1 : lerp(1, chin, ease((-0.15 - y) / 0.85)));
const headD = (y, z) => (z < 0 ? (y > -0.2 ? 1 : lerp(1, 0.84, ease((-0.2 - y) / 0.8))) : (y > -0.1 ? 1 : lerp(1, 0.55, ease((-0.1 - y) / 0.9))));
const headGeo = (chin, from = 0) => geo(`head${chin}.${from}`, () => {
  const g = new THREE.SphereGeometry(1, 18, from ? 6 : 14, 0, Math.PI * 2, from, Math.PI - from), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x * HW * headW(y, chin), HH + y * HH, 0.004 + z * HD * headD(y, z));
  }
  g.computeVertexNormals();
  return g;
});
// front surface z of that head at (x, y), so features sit on the face
function faceZ(x, y, chin) {
  const v = clamp((y - HH) / HH, -1, 1), u = x / (HW * headW(v, chin));
  return 0.004 - Math.sqrt(Math.max(0, 1 - u * u - v * v)) * HD * headD(v, -1);
}

// ---------- held props: built as they hang from a straight arm; `pitch` keeps them steady in the walk ----------
// carry = arm pose while walking: [shoulder pitch, elbow, swing share]
const UPRIGHT = [0.15, 1.1, 0.25], CHEST = [0.12, 1.45, 0.12], HANG = [0.04, 0.2, 0.4], FREE = [0.05, 0.15, 1];
function hold(r, arm, pitch = 0, carry = HANG) {
  const g = pivot(r.arms[arm].hand, [0, -0.085, 0]), inner = pivot(g);
  r.props.push({ arm, g, inner, pitch });
  r.carry[arm] = carry;
  return inner;
}
const HAND_PROPS = {
  hoe: (r) => { // blade up while carried; swung blade-first when hoeing
    const g = hold(r, 1, 0, UPRIGHT);
    part(g, CYL(), mat('#8a6338', 'leather'), [0.016, 1.3, 0.016], [0, 0.5, 0]);
    part(g, BOX(), mat('#6f7378', 'metal'), [0.15, 0.11, 0.012], [0, 1.15, -0.05], [0.9, 0, 0]);
  },
  staff: (r) => {
    const g = hold(r, 1, 0, UPRIGHT);
    part(g, CYL(0.8), mat('#7a5530', 'leather'), [0.02, 1.5, 0.02], [0, -0.1, 0]);
    part(g, RING(0.22, Math.PI * 1.2), mat('#6a4627', 'leather'), [0.06, 0.06, 0.06], [0, 0.66, -0.06], [0, Math.PI / 2, 0]);
  },
  net: (r) => {
    const g = hold(r, 1);
    part(g, CONE(), mat('#9fae9a', 'drape'), [0.16, 0.55, 0.13], [0, -0.3, 0], [Math.PI, 0, 0]);
    part(g, RING(0.15), mat('#4a4d52', 'metal'), [0.15, 0.15, 0.15], [0, -0.58, 0], [Math.PI / 2, 0, 0]);
  },
  wrench: (r) => {
    const g = hold(r, 1);
    part(g, BOX(), mat('#8a9096', 'metal'), [0.028, 0.24, 0.012], [0, -0.06, 0]);
    part(g, RING(0.3, Math.PI * 1.5), mat('#8a9096', 'metal'), [0.028, 0.028, 0.03], [0, -0.19, 0], [0, 0, Math.PI * 0.75]);
  },
  hammer: (r) => {
    const g = hold(r, 1);
    part(g, CYL(), mat('#9a7448', 'leather'), [0.014, 0.32, 0.014], [0, -0.1, 0]);
    part(g, BOX(), mat('#55595e', 'metal'), [0.03, 0.03, 0.12], [0, -0.26, -0.01]);
  },
  book: (r, o) => { // held open at the chest
    const g = hold(r, 0, 2.2, CHEST);
    for (const x of [-1, 1]) {
      part(g, BOX(), o.color, [0.13, 0.2, 0.012], [x * 0.064, 0, 0.006], [0, x * 0.18, 0]);
      part(g, BOX(), '#f1ece0', [0.12, 0.19, 0.012], [x * 0.062, 0, -0.002], [0, x * 0.18, 0], false);
    }
  },
  clipboard: (r) => {
    const g = hold(r, 0, 2.0, CHEST);
    part(g, BOX(), mat('#8a5a33', 'leather'), [0.2, 0.27, 0.01], [0, 0, 0]);
    part(g, BOX(), '#f4f1e8', [0.17, 0.22, 0.004], [0, -0.01, -0.006], null, false);
    part(g, BOX(), mat('#9aa0a6', 'metal'), [0.07, 0.025, 0.014], [0, 0.125, -0.006], null, false);
  },
  basket: (r, o) => {
    const g = hold(r, 0);
    const wick = mat('#b48a4f');
    part(g, CYL(1.2), wick, [0.16, 0.14, 0.16], [0, -0.2, 0], [Math.PI, 0, 0]);
    part(g, RING(0.12, Math.PI), wick, [0.16, 0.16, 0.16], [0, -0.13, 0]);
    o.fruit.forEach((c, i) => part(g, SPH(10, 8), mat(c, 'plastic'), [0.04, 0.04, 0.04], [(i - 1) * 0.07, -0.13, (i % 2) * 0.05 - 0.025], null, false));
  },
};

// ---------- worn accessories: (rig, options) => void ----------
const front = (r, y, g = 1) => -r.CD * torsoR(y) * g;
const ACC = {
  // headwear, on the head pivot (chin at y = 0, crown at 0.235)
  sunhat: ({ head }, o) => {
    part(head, CYL(0.92), o.color, [0.088, 0.075, 0.104], [0, 0.23, 0.006]);
    part(head, CYL(), o.color, [0.21, 0.007, 0.22], [0, 0.195, 0.004]);
    part(head, CYL(), o.band, [0.09, 0.02, 0.106], [0, 0.205, 0.006]);
  },
  strawhat: ({ head }, o) => {
    const straw = mat('#d9b56c');
    if (o.conical) return void part(head, CONE(), straw, [0.27, 0.13, 0.27], [0, 0.255, 0.005]);
    part(head, CYL(0.9), straw, [0.086, 0.08, 0.102], [0, 0.23, 0.006]);
    part(head, CYL(), straw, [0.23, 0.008, 0.24], [0, 0.192, 0.004]);
    part(head, CYL(), '#7a4a2a', [0.088, 0.018, 0.104], [0, 0.2, 0.006]);
  },
  knitcap: ({ head }, o) => {
    part(head, CAP(Math.PI * 0.52), o.color, [0.09, 0.124, 0.124], [0, 0.128, 0.01], [0.35, 0, 0]);
    part(head, RING(0.3), darker(o.color, 0.05), [0.084, 0.104, 0.07], [0, 0.185, 0.02], [Math.PI / 2 + 0.35, 0, 0]);
  },
  hardhat: ({ head }, o) => {
    const m = mat(o.color, 'plastic');
    part(head, CAP(Math.PI / 2), m, [0.097, 0.1, 0.116], [0, 0.165, 0.004]);
    part(head, CYL(), m, [0.104, 0.006, 0.124], [0, 0.168, -0.01]);
  },
  headwrap: ({ head }, o) => { // turban or African headwrap
    part(head, CAP(Math.PI * 0.55), o.color, [0.096, 0.13, 0.12], [0, 0.135, 0.01], [0.3, 0, 0]);
    part(head, RING(0.35), o.color, [0.088, 0.106, 0.09], [0, 0.17, 0.008], [Math.PI / 2 - 0.25, 0, 0]);
    part(head, SPH(10, 8), darker(o.color, 0.05), [0.04, 0.035, 0.03], [0, 0.225, 0.07]);
  },
  headscarf: ({ head }, o) => { // dupatta, hijab or sari pallu over the hair
    const m = mat(o.color, 'drape');
    part(head, CAP(Math.PI * 0.62), m, [0.097, 0.126, 0.126], [0, 0.128, 0.012], [0.5, 0, 0]);
    part(head, limb(0.08, 0.1, 0.16), m, [1.05, 1, 0.55], [0, 0.1, 0.07]);
  },
  goggles: ({ head }) => {
    part(head, RING(0.1), '#2a2c30', [0.084, 0.108, 0.1], [0, 0.17, 0.005], [Math.PI / 2 - 0.15, 0, 0]);
    for (const x of [-0.034, 0.034]) {
      const p = [x, 0.18, faceZ(x, 0.18, 0.62) - 0.03];
      part(head, CYL(), mat('#1f3442', 'glass'), [0.021, 0.012, 0.018], p, [Math.PI / 2 - 0.5, 0, 0]);
      part(head, RING(0.25), mat('#8a9096', 'metal'), [0.022, 0.019, 0.022], p, [-0.5, 0, 0], false);
    }
  },
  headset: ({ head }) => {
    const m = mat('#2a2c30', 'plastic');
    part(head, RING(0.1, Math.PI), m, [0.09, 0.122, 0.09], [0, 0.125, 0.008]);
    for (const x of [-1, 1]) part(head, CYL(), m, [0.034, 0.024, 0.034], [x * 0.086, 0.118, 0.012], [0, 0, Math.PI / 2]);
    part(head, CYL(), m, [0.004, 0.1, 0.004], [-0.07, 0.075, -0.04], [-1.2, 0.5, 0]);
  },
  glasses: ({ head, jaw }) => {
    const m = mat('#2a2622', 'plastic');
    for (const x of [-0.032, 0.032]) part(head, RING(0.12), m, [0.017, 0.014, 0.017], [x, 0.122, faceZ(x, 0.122, jaw) - 0.016], null, false);
    part(head, CYL(), m, [0.003, 0.03, 0.003], [0, 0.126, faceZ(0, 0.126, jaw) - 0.018], [0, 0, Math.PI / 2], false);
  },
  // torso wear, on the spine pivot (waist y = 0 to neck 0.45)
  vest: (r, o) => {
    part(r.spine, shell(0.06, 0.41, Math.PI + 0.22, Math.PI * 2 - 0.44), mat(o.color, 'drape'), [r.CW * 1.08, 1, r.CD * 1.12]);
    for (const x of [-1, 1]) for (const y of [0.12, 0.25]) part(r.spine, BOX(), darker(o.color, 0.05), [0.06, 0.065, 0.02], [x * 0.07, y, front(r, y, 1.12) - 0.008]);
  },
  hivis: (r, o) => {
    part(r.spine, shell(0.04, 0.41), mat(o.color, 'glow'), [r.CW * 1.07, 1, r.CD * 1.1]);
    for (const y of [0.13, 0.26]) part(r.spine, shell(y, y + 0.03), mat('#cfd4d8', 'metal'), [r.CW * 1.085, 1, r.CD * 1.12]);
  },
  bib: (r, o) => { // overalls and waders
    const m = mat(o.color, o.kind || 'cloth');
    part(r.spine, shell(-0.02, 0.27, Math.PI - 0.6, 1.2), m, [r.CW * 1.04, 1, r.CD * 1.06]);
    part(r.spine, shell(-0.02, 0.08), m, [r.CW * 1.04, 1, r.CD * 1.06]);
    for (const x of [-1, 1]) {
      part(r.spine, shell(0.26, 0.45, Math.PI + x * 0.42 - 0.07, 0.14), m, [r.CW * 1.05, 1, r.CD * 1.07]);
      part(r.spine, shell(0.06, 0.45, x * 0.42 - 0.07, 0.14), m, [r.CW * 1.05, 1, r.CD * 1.07]);
      part(r.spine, SPH(8, 6), mat('#b9bcc0', 'metal'), [0.009, 0.009, 0.006], [x * 0.055, 0.26, front(r, 0.26, 1.06) - 0.002], null, false);
    }
  },
  backpack: (r, o) => {
    const z = r.CD + 0.085;
    part(r.spine, BOX(), o.color, [0.27, 0.4, 0.15], [0, 0.24, z]);
    part(r.spine, BOX(), darker(o.color, 0.08), [0.2, 0.14, 0.05], [0, 0.14, z + 0.085]);
    part(r.spine, CYL(), '#4d5a3a', [0.06, 0.28, 0.06], [0, 0.48, z], [0, 0, Math.PI / 2]);
    for (const x of [-1, 1]) part(r.spine, shell(0.1, 0.45, Math.PI + x * 0.36 - 0.06, 0.12), '#2d2f33', [r.CW * 1.06, 1, r.CD * 1.08]);
  },
  rope: (r, o) => { part(r.spine, RING(0.18), o.color, [0.13, 0.17, 0.2], [0.02, 0.24, r.CD + 0.17]); },
  bands: (r, o) => { for (const y of [0.13, 0.26]) part(r.spine, shell(y, y + 0.035), o.color, [r.CW * 1.02, 1, r.CD * 1.03]); },
  camera: (r) => {
    const z = front(r, 0.2) - 0.045;
    part(r.spine, BOX(), mat('#23252a', 'plastic'), [0.13, 0.085, 0.065], [0, 0.2, z]);
    part(r.spine, CYL(), mat('#33363c', 'plastic'), [0.032, 0.07, 0.032], [0, 0.2, z - 0.06], [Math.PI / 2, 0, 0]);
    part(r.spine, CYL(), mat('#1d3550', 'glass'), [0.026, 0.004, 0.026], [0, 0.2, z - 0.096], [Math.PI / 2, 0, 0], false);
    for (const x of [-1, 1]) part(r.spine, shell(0.22, 0.45, Math.PI + x * 0.3 - 0.04, 0.08), '#23252a', [r.CW * 1.1, 1, r.CD * 1.14]);
  },
  hood: (r, o) => {
    part(r.spine, SPH(), o.color, [0.11, 0.06, 0.06], [0, 0.43, r.CD * 0.7 + 0.025]);
    part(r.spine, RING(0.35), o.color, [0.07, 0.065, 0.07], [0, 0.44, 0.005], [Math.PI / 2, 0, 0]);
  },
  collar: (r, o) => { part(r.spine, RING(0.45), o.color, [0.072, 0.068, 0.07], [0, 0.44, 0.008], [Math.PI / 2, 0, 0]); },
  scarf: (r, o) => {
    part(r.spine, RING(0.42), o.color, [0.068, 0.064, 0.07], [0, 0.45, 0.005], [Math.PI / 2, 0, 0]);
    part(r.spine, limb(0.03, 0.03, 0.18), mat(o.color, 'drape'), [1.2, 1, 0.4], [0.05, 0.43, front(r, 0.36) - 0.02], [0, 0, 0.12]);
  },
  shawl: (r, o) => {
    const m = mat(o.color, 'drape');
    part(r.spine, shell(0.25, 0.455), m, [r.CW * 1.32, 1, r.CD * 1.22]);
    part(r.spine, shell(0.25, 0.28), o.stripe, [r.CW * 1.33, 1, r.CD * 1.23]);
    part(r.spine, shell(0.06, 0.3, Math.PI - 0.55, 0.4), m, [r.CW * 1.1, 1, r.CD * 1.14]);
  },
  pallu: (r, o) => { // the loose end of a sari, draped over the left shoulder, front and back
    const m = mat(o.color, 'drape');
    part(r.spine, shell(0.04, 0.47, Math.PI - 0.15, 1.05), m, [r.CW * 1.06, 1, r.CD * 1.1]);
    part(r.spine, shell(-0.05, 0.47, -0.95, 1.1), m, [r.CW * 1.06, 1, r.CD * 1.1]);
  },
  placket: (r, o) => { part(r.spine, BOX(), o.color, [0.022, 0.16, 0.006], [0, 0.36, front(r, 0.36) - 0.002], null, false); },
  badge: (r) => {
    const z = front(r, 0.3) - 0.004;
    part(r.spine, BOX(), '#f4f4f0', [0.045, 0.06, 0.006], [0.07, 0.3, z], null, false);
    part(r.spine, BOX(), '#2f6fb0', [0.045, 0.014, 0.008], [0.07, 0.325, z], null, false);
  },
  stethoscope: (r) => {
    const m = mat('#23252a', 'rubber');
    part(r.spine, RING(0.08), m, [0.075, 0.08, 0.06], [0, 0.42, -0.012], [Math.PI / 2 + 0.5, 0, 0], false);
    for (const x of [-1, 1]) part(r.spine, CYL(), m, [0.006, 0.17, 0.006], [x * 0.045, 0.31, front(r, 0.31) - 0.012], [0, 0, x * 0.1], false);
    part(r.spine, CYL(), mat('#b9bcc0', 'metal'), [0.018, 0.01, 0.018], [0.03, 0.21, front(r, 0.21) - 0.014], [Math.PI / 2, 0, 0], false);
  },
  satchel: (r, o) => {
    for (const phi of [Math.PI + 0.32, -0.32]) part(r.spine, shell(0.08, 0.47, phi - 0.06, 0.12), o.color, [r.CW * 1.04, 1, r.CD * 1.06], [0, 0, 0], null, false);
    part(r.pelvis, BOX(), mat(o.color, 'leather'), [0.06, 0.2, 0.25], [-0.2, 0.02, 0.02]);
  },
  // hip wear, on the pelvis pivot (hip joints at y = 0, waist at 0.075)
  skirt: (r, o) => { // sari, wrap skirt, kurta hem: `len` metres below the waist
    const m = part(r.pelvis, skirtGeo(o.len, o.flare || 1.45), mat(o.color, 'drape'), [r.PW * 1.05, 1, r.PD * 1.3], [0, 0.085, 0]);
    r.skirts.push({ m, z: m.scale.z });
    // ponytail: legs under an ankle-length skirt are hidden rather than kept from poking through the cloth
    if (o.len > 0.7) for (const l of r.legs) for (const j of [l.hip, l.knee]) for (const c of j.children) if (c.isMesh) c.visible = false;
  },
  apron: (r, o) => {
    const m = mat(o.color, 'drape');
    part(r.pelvis, lathe('apron', [[1.25, -0.48], [1.05, -0.2], [1, 0], [0.92, 0.09]], 18, Math.PI - 0.9, 1.8), m, [r.PW * 1.1, 1, r.PD * 1.3], [0, 0.085, 0]);
    part(r.spine, shell(0.0, 0.3, Math.PI - 0.5, 1.0), m, [r.CW * 1.06, 1, r.CD * 1.1]);
  },
  belt: (r, o) => { part(r.pelvis, CYL(), mat(o.color || '#3a2a1e', 'leather'), [r.PW * 0.93, 0.035, r.PD * 1.0], [0, 0.085, 0.004]); },
  toolbelt: (r) => {
    const m = mat('#6b4a2b', 'leather');
    part(r.pelvis, CYL(), m, [r.PW * 0.97, 0.05, r.PD * 1.05], [0, 0.07, 0.004]);
    for (const x of [-1, 1]) part(r.pelvis, BOX(), m, [0.05, 0.12, 0.1], [x * r.PW * 0.95, 0.0, -0.02]);
    part(r.pelvis, BOX(), mat('#3d4248', 'metal'), [0.06, 0.08, 0.012], [-r.PW * 0.95, 0.07, -0.02]);
  },
};
const HATS = new Set(['sunhat', 'strawhat', 'knitcap', 'hardhat', 'headwrap', 'headscarf']);

// ---------- head: cranium, jaw, face, ears, hair ----------
function buildHead(r, s) {
  const { head } = r, skin = mat(s.skin, 'skin'), jaw = r.jaw = s.fem ? 0.6 : 0.68;
  part(head, headGeo(jaw), skin, [1, 1, 1]);
  for (const x of [-1, 1]) part(head, SPH(8, 6), skin, [0.011, 0.025, 0.02], [x * 0.077, 0.116, 0.016], [0, x * 0.3, 0], false);
  const white = mat('#efe9df', 'eye'), iris = mat(s.eyes || '#3a2414', 'eye'), brow = mat(s.hair.color, 'hair');
  r.eyes = [];
  for (const x of [-0.031, 0.031]) {
    const z = faceZ(x, 0.122, jaw);
    r.eyes.push(part(head, SPH(10, 6), white, [0.0115, 0.0085, 0.0115], [x, 0.122, z + 0.0045], null, false),
      part(head, SPH(8, 4), iris, [0.0056, 0.0056, 0.0035], [x, 0.122, z - 0.0062], null, false));
    part(head, SPH(6, 4), brow, [0.019, 0.0035, 0.007], [x * 1.05, 0.142, faceZ(x, 0.142, jaw) - 0.003], [0, 0, x > 0 ? -0.12 : 0.12], false);
  }
  part(head, SPH(10, 8), skin, [0.0095, 0.026, 0.013], [0, 0.098, faceZ(0, 0.098, jaw) - 0.003], [0.3, 0, 0], false);
  part(head, SPH(10, 8), skin, [0.013, 0.0095, 0.01], [0, 0.083, faceZ(0, 0.083, jaw) - 0.006], null, false);
  const lip = mat('#' + _c.set(s.skin).lerp(_c2.set('#8e3f3c'), 0.3).getHexString(), 'skin'), zl = faceZ(0, 0.06, jaw);
  part(head, SPH(12, 6), lip, [0.02, 0.005, 0.007], [0, 0.064, zl - 0.001], null, false);
  part(head, SPH(12, 6), lip, [0.018, 0.0058, 0.0075], [0, 0.055, zl], null, false);
  if (s.facial === 'beard') part(head, headGeo(jaw, Math.PI * 0.62), brow, [1.07, 1, 1.07], [0, -0.004, -0.02], [0.3, 0, 0], false);
  if (s.facial) part(head, SPH(10, 6), brow, [0.024, 0.006, 0.009], [0, 0.071, faceZ(0, 0.071, jaw) - 0.003], null, false);

  const { style, color } = s.hair, h = mat(color, 'hair');
  if (style === 'bald') return void part(head, CAP(Math.PI * 0.2, Math.PI * 0.45), h, [0.081, 0.11, 0.11], [0, 0.13, 0.008], [0.5, 0, 0], false);
  if (s.acc.some(([n]) => n === 'headscarf')) return;
  const R = style === 'buzz' ? 0.109 : style === 'curly' ? 0.122 : 0.114;
  part(head, CAP(Math.PI * 0.56), h, [R * 0.73, R, R], [0, 0.13, 0.008], [0.66, 0, 0]);
  if (style === 'long') part(head, limb(0.07, 0.06, 0.24), h, [1.15, 1, 0.45], [0, 0.16, 0.065]);
  if (style === 'bun') part(head, SPH(12, 8), h, [0.045, 0.042, 0.042], [0, 0.17, 0.11]);
  if (style === 'ponytail') {
    part(head, SPH(10, 8), h, [0.022, 0.022, 0.022], [0, 0.15, 0.11], null, false);
    part(head, limb(0.026, 0.014, 0.2), h, [1, 1, 0.8], [0, 0.15, 0.115], [-0.3, 0, 0]);
  }
  if (style === 'braid') for (let i = 0; i < 6; i++) part(head, SPH(10, 8), h, [0.024, 0.03, 0.022], [0, 0.11 - i * 0.045, 0.105 + i * 0.002], null, false);
}

// ---------- the one rig builder ----------
// ponytail: ~55-70 meshes (draw calls) per person, materials shared by colour, so never mutate one per person.
// Fine for the ~20 on screen; for crowds, merge each pivot's static meshes with vertex colours.
function buildPerson(spec, seed) {
  const s = { build: 1, shoulder: 1, hip: 1, height: BASE_H, acc: [], ...spec };
  const b = s.build, f = !!s.fem;
  const object = new THREE.Group();
  const rig = pivot(object);
  rig.scale.setScalar(s.height / BASE_H);
  const r = {
    s, rig, skirts: [], props: [], carry: [FREE, FREE],
    CW: (f ? 0.14 : 0.158) * s.shoulder * b, CD: (f ? 0.1 : 0.11) * b ** 1.2,
    PW: (f ? 0.175 : 0.16) * s.hip * b, PD: (f ? 0.118 : 0.11) * b,
    HX: (f ? 0.09 : 0.085) * s.hip * b,
  };
  r.footX = r.HX + 0.01;
  const skin = mat(s.skin, 'skin'), top = mat(s.top.color, s.top.kind), bottom = mat(s.bottom.color, s.bottom.kind);
  const g = Math.sqrt(b); // limb girth

  r.pelvis = pivot(rig, [0, HIP_Y, 0]);
  part(r.pelvis, SPH(16, 12), bottom, [r.PW, 0.095, r.PD], [0, 0.07, 0.012]);
  part(r.pelvis, CYL(0.95), bottom, [r.PW * 0.92, 0.06, r.PD * 0.98], [0, 0.1, 0.008]); // waistband over the shirt seam
  r.spine = pivot(r.pelvis, [0, SPINE_Y, 0]);
  r.torso = part(r.spine, shell(0, 0.472), top, [r.CW, 1, r.CD]);
  if (b > 1.12) part(r.spine, SPH(), top, [r.CW * 0.78, 0.1, r.CD * 0.8], [0, 0.09, -r.CD * 0.12]);
  r.neck = pivot(r.spine, [0, 0.425, 0.005]);
  part(r.neck, limb(0.05, 0.047, 0.085, 0, 0, 8), skin, [g, 1, g], [0, 0, 0], [Math.PI, 0, 0]);
  r.head = pivot(r.neck, [0, 0.082, -0.012]);
  buildHead(r, s);

  const long = s.top.sleeves !== 'short' && s.top.sleeves !== 'none';
  r.shY = 0.362;
  r.arms = [-1, 1].map((side) => { // index 0 = left (-x), 1 = right (+x)
    const sh = pivot(r.spine, [side * r.CW * 1.0, r.shY, 0.012]);
    part(sh, limb(0.054, 0.04, 0.3, 0.006, 0.25), s.top.sleeves === 'none' ? skin : long ? top : skin, [g, 1, g]);
    if (s.top.sleeves === 'short') part(sh, limb(0.058, 0.05, 0.12), top, [g, 1, g]);
    const el = pivot(sh, [0, -0.3, 0]);
    part(el, limb(0.041, 0.029, 0.245, 0.007, 0.2), long ? top : skin, [g, 1, g * 0.92]);
    const hand = pivot(el, [0, -0.245, 0]);
    const hm = s.gloves ? mat(s.gloves, 'leather') : skin;
    part(hand, limb(0.029, 0.024, 0.115, 0, 0, 8), hm, [0.62, 1, 1.15], [0, -0.012, -0.004]);
    part(hand, limb(0.012, 0.01, 0.045, 0, 0, 6), hm, [1, 1, 1], [-side * 0.006, -0.02, -0.024], [0.55, 0, -side * 0.2]);
    return { side, sh, el, hand };
  });

  const shoe = s.shoes === 'sandal' ? skin : mat(s.shoes, s.boots === 'rubber' ? 'rubber' : 'leather');
  const sole = mat(s.shoes === 'sandal' ? '#4a3524' : '#22201e', 'rubber');
  const boot = s.boots && mat(s.boots === 'rubber' ? s.bottom.color : s.shoes, s.boots === 'rubber' ? 'rubber' : 'leather');
  r.legs = [-1, 1].map((side) => {
    const hip = pivot(r.pelvis, [side * r.HX, 0, 0]);
    hip.rotation.order = 'YXZ'; // undo pelvis twist first, then swing in the walking plane
    part(hip, limb(0.08, 0.052, L1, 0.01, 0.25), s.bottom.shorts ? skin : bottom, [g, 1, g * 1.05]);
    if (s.bottom.shorts) part(hip, limb(0.085, 0.07, 0.2), bottom, [g, 1, g * 1.05]);
    const knee = pivot(hip, [0, -L1, 0]);
    part(knee, limb(0.053, 0.033, L2, 0.013, 0.28), s.bottom.shorts || s.bottom.bare ? skin : bottom, [g, 1, g]);
    if (boot) part(knee, limb(0.048, 0.045, 0.17), boot, [g * 1.06, 1, g * 1.06], [0, -L2 + 0.17, 0]);
    const ankle = pivot(knee, [0, -L2, 0]);
    part(ankle, limb(0.044, 0.04, 0.165), shoe, [1.1, 1, 0.9], [0, -0.04, 0.012], [Math.PI / 2, 0, 0]);
    part(ankle, limb(0.044, 0.042, 0.165, 0, 0, 8), sole, [1.14, 1, 0.2], [0, -0.068, 0.012], [Math.PI / 2, 0, 0]);
    if (s.shoes === 'sandal') part(ankle, RING(0.25), mat('#4a3524', 'leather'), [0.045, 0.03, 0.03], [0, -0.045, -0.06], [Math.PI / 2, 0, 0], false);
    return { side, hip, knee, ankle };
  });

  for (const [name, o] of s.acc) (ACC[name] || HAND_PROPS[name])(r, o || {});
  r.work = s.work;

  live++;
  let disposed = false;
  const person = {
    object, height: s.height, onStep: null,
    dispose() {
      if (disposed) return;
      disposed = true;
      object.removeFromParent();
      if (--live === 0) { // last person gone: free the shared pool
        GEO.forEach((x) => x.dispose()); GEO.clear();
        MAT.forEach((x) => x.dispose()); MAT.clear();
        for (const k in TEX) { TEX[k].dispose(); delete TEX[k]; }
      }
    },
  };
  return Object.assign(person, animator(r, person, rand(seed)));
}

// ---------- poses: the animator blends idle, gait, work and talk poses field by field ----------
const pose = () => ({
  y: HIP_Y, shift: 0, tilt: 0, twist: 0, lean: 0, sy: 0, sz: 0, hx: 0, hy: 0, hz: 0,
  arm: [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]], // shoulder x, y, z, elbow, wrist x, y, z
  prop: [0, 0], slide: [0, 0], foot: [[0, 0], [0, 0]], // standing foot x, z
});
function copy(a, b) { for (const k in b) if (typeof b[k] === 'number') a[k] = b[k]; else copy(a[k], b[k]); }
function mix(a, b, w) { for (const k in a) if (typeof a[k] === 'number') a[k] += (b[k] - a[k]) * w; else mix(a[k], b[k], w); }
// arm pose with mirrored sides: pitch forward, twist inward, raise outward, elbow bend, wrist
function setA(a, side, x, twist, out, el, wx = 0, wy = 0) { a[0] = x; a[1] = side * twist; a[2] = side * out; a[3] = el; a[4] = wx; a[5] = side * wy; a[6] = 0; }
// cyclic keyframes [[time 0..1, value], ...] (first time 0), eased between neighbours
function kf(c, ks) {
  let i = ks.length - 1;
  while (c < ks[i][0]) i--;
  const [t0, v0] = ks[i], [t1, v1] = ks[i + 1] || [1, ks[0][1]];
  return lerp(v0, v1, ease((c - t0) / (t1 - t0)));
}

// Role work loops while standing at the workplace. Props: right hand = arm 1, left = arm 0.
// prop values are the prop's pitch in the hip frame (0 = as it hangs from a straight arm).
const WORK = {
  farmer(X, t) { // hoeing: slow lift, quick chop, short drag
    const s = kf((t * 0.5) % 1, [[0, 0], [0.5, 1], [0.62, 0]]);
    X.y -= lerp(0.07, 0.03, s); X.lean = lerp(-0.38, -0.1, s); X.hx = lerp(0.3, 0.15, s);
    setA(X.arm[1], 1, lerp(0.6, 0.85, s), 0.2, 0.05, lerp(0.3, 1.5, s));
    setA(X.arm[0], -1, lerp(0.8, 1.15, s), 0.35, -0.05, lerp(0.08, 1.1, s));
    X.prop[1] = lerp(-2.15, 0.15, s);
    X.foot[0][1] = -0.16; X.foot[1][1] = 0.1;
  },
  fisher(X, t) { // mending the net, now and then looking out to the water
    const m = Math.sin(t * 5.5), up = kf((t / 14) % 1, [[0, 0], [0.75, 0], [0.82, 1], [0.94, 1]]);
    X.lean = -0.1; X.hx = lerp(0.45, -0.02, up); X.hy = up * 0.6;
    setA(X.arm[0], -1, 0.5 + 0.05 * m, 0.35, -0.08, 1.25 + 0.1 * m, 0, 0.3 * m);
    setA(X.arm[1], 1, 0.45 - 0.05 * m, 0.3, -0.08, 1.3 - 0.1 * m, 0, -0.2 * m);
    X.prop[1] = 0.6;
  },
  vendor(X, t) { // takes goods from the basket and sets them out on the stall
    const n = Math.floor(t / 3.2), s = kf((t / 3.2) % 1, [[0, 0], [0.35, 1], [0.55, 1], [0.85, 0]]), aim = ((n * 7) % 3 - 1) * 0.3;
    X.lean = lerp(-0.12, -0.4, s); X.hx = 0.3; X.hy = aim * s; X.y -= 0.03 * s;
    setA(X.arm[0], -1, 0.5, 0.25, -0.05, 1.35);
    setA(X.arm[1], 1, lerp(0.5, 1.0, s), lerp(0.4, -aim, s), lerp(-0.1, 0.1, s), lerp(1.3, 0.35, s), lerp(0, 0.4, s));
    X.prop[0] = 0;
  },
  builder(X, t) { // crouched, driving a stake with the hammer
    const s = kf((t * 1.25) % 1, [[0, 0], [0.5, 1], [0.6, 0]]);
    X.y -= 0.2; X.lean = -0.5; X.hx = 0.35;
    X.foot[0][1] = -0.14; X.foot[1][1] = 0.12; X.foot[0][0] -= 0.05; X.foot[1][0] += 0.05;
    setA(X.arm[1], 1, lerp(0.75, 1.6, s), 0.1, 0.12, lerp(0.4, 1.8, s));
    setA(X.arm[0], -1, 0.95, 0.25, -0.05, 0.25);
    X.prop[1] = lerp(1.0, 3.5, s);
  },
  teacher(X, t) { // reads from the book, turns a page, looks up at the class
    const up = kf((t / 9) % 1, [[0, 0], [0.6, 0], [0.66, 1], [0.85, 1], [0.92, 0]]), turn = kf((t / 4.5) % 1, [[0, 0], [0.7, 0], [0.8, 1], [0.9, 0]]);
    X.hx = lerp(0.42, 0.02, up); X.hy = up * 0.35;
    setA(X.arm[0], -1, 0.45, 0.45, -0.12, 1.5);
    setA(X.arm[1], 1, lerp(0.06, 0.5, turn), lerp(0, 0.5, turn), lerp(0.07, -0.1, turn), lerp(0.15, 1.3, turn));
    X.prop[0] = 2.25;
  },
  clipboard(X, t) { // writes notes, looks up, writes again (nurse, factory inspector)
    const up = kf((t / 7) % 1, [[0, 0], [0.7, 0], [0.76, 1], [0.92, 1], [0.97, 0]]), wr = Math.sin(t * 9) * (1 - up);
    X.hx = lerp(0.45, 0.02, up); X.hy = up * 0.3;
    setA(X.arm[0], -1, 0.5, 0.45, -0.12, 1.5);
    setA(X.arm[1], 1, 0.45 + 0.03 * wr, lerp(0.55, 0.1, up), -0.15, lerp(1.45, 0.3, up) + 0.06 * wr, 0.15 * wr);
    X.prop[0] = 2.05;
  },
  herder(X, t) { // leans on the staff and watches the flock
    X.hy = 0.7 * Math.sin(t * 0.23); X.hx = 0.06; X.lean = -0.04;
    setA(X.arm[1], 1, 0.6, 0, 0.12, 0.75);
    X.prop[1] = -0.18; X.slide[1] = 0.12; X.foot[1][1] = 0.06;
  },
  factory(X, t) { // turns a fitting with the wrench
    const m = Math.sin(t * 4);
    X.lean = -0.28; X.hx = 0.3; X.y -= 0.04;
    setA(X.arm[1], 1, 0.8 + 0.1 * m, 0.25, 0.05, 0.7 + 0.25 * Math.sin(t * 4 + 1.2));
    X.arm[1][6] = 0.4 * m;
    setA(X.arm[0], -1, 0.9, 0.3, -0.05, 0.6);
    X.prop[1] = 1.5 + 0.3 * m;
  },
};

// ---------- animation ----------
function animator(r, person, rng) {
  const S = r.rig.scale.x, cw = r.torso.scale.x, cd = r.torso.scale.z, work = WORK[r.work];
  const held = [r.props.some((p) => p.arm === 0), r.props.some((p) => p.arm === 1)];
  const gArm = held[1] && !held[0] ? 0 : 1; // talk with the free hand
  const P = pose(), X = pose(), feet = [[0, 0, 0], [0, 0, 0]], stance = [true, true], fz = [0, 0];
  const gest = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]], gestT = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]];
  const breathRate = 1.3 + rng() * 0.5, eyeY = r.eyes.map((m) => m.scale.y);
  let t = rng() * 10, ph = rng(), walkW = 0, runW = 0, talkW = 0, workW = 0, talking = false, working = false;
  let look = 0, lookT = 0, nextLook = 1 + rng() * 3, ws = 0, wsT = rng() < 0.5 ? -1 : 1, nextShift = 2 + rng() * 5;
  let beatIn = 0, nodT = 9, blinkIn = 1 + rng() * 3;

  function talk(dt) {
    if ((beatIn -= dt) <= 0) { // a new beat: fresh gesture targets, sometimes a nod
      beatIn = 0.45 + rng() * 0.9;
      const both = rng() < 0.3;
      for (let i = 0; i < 2; i++) {
        const on = i === gArm || (both && !held[i]), side = i ? 1 : -1;
        if (!on) { setA(gestT[i], side, 0.06, 0, 0.08, 0.2, 0.1); continue; }
        setA(gestT[i], side, 0.3 + 0.45 * rng(), 0.1 + 0.35 * rng(), 0.1 + 0.25 * rng(), 1.0 + 0.7 * rng(), -0.3 + 0.5 * rng(), 0.3 + 0.9 * rng());
      }
      if (rng() < 0.55) nodT = 0;
    }
    const k = 1 - Math.exp(-6 * dt);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 7; j++) gest[i][j] += (gestT[i][j] - gest[i][j]) * k;
    nodT += dt;
    copy(X, P);
    for (let i = 0; i < 2; i++) if (!held[i] || i === gArm) X.arm[i].splice(0, 7, ...gest[i]);
    X.hx = 0.03 + 0.13 * (nodT < 0.5 ? Math.sin(Math.PI * nodT / 0.5) : 0);
    X.hy = 0.08 * Math.sin(t * 0.7); X.hz = 0.05 * Math.sin(t * 0.9);
    X.lean = 0.02;
  }

  function update(dt, speedMps = 0) {
    const speed = Number.isFinite(speedMps) ? clamp(speedMps, 0, 10) : 0, v = speed / S; // v in rig units
    t += dt;
    const k = 1 - Math.exp(-8 * dt), k3 = 1 - Math.exp(-3 * dt);
    walkW += ((speed > 0.15 ? 1 : 0) - walkW) * k;
    runW += (clamp((speed - 2.6) / 2) - runW) * k; // a full run from 4.6 m/s
    talkW += ((talking ? 1 : 0) - talkW) * k3;
    workW += ((working && work && !talking && speed <= 0.15 ? 1 : 0) - workW) * (1 - Math.exp(-2.5 * dt));
    const w = walkW;

    // gait: stance then swing per foot; cadence and stride follow speed (walk 2.2 m/s ~ 2.5 steps/s, run 6 m/s ~ 3)
    const step = lerp(0.3 + 0.27 * v, 0.75 + 0.21 * v, runW), beta = lerp(0.6, 0.32, runW);
    if (v > 0.05) ph = (ph + (dt * v) / (2 * step)) % 1;
    const E = Math.max(0.05, 2 * step * beta - 0.2) * lerp(0.9, 0.72, runW), fr = E * 0.38, bk = E - fr;
    const lift = lerp(Math.min(0.12, 0.06 + 0.03 * v), Math.min(0.36, 0.12 + 0.04 * v), runW);
    for (let i = 0; i < 2; i++) {
      const p = (ph + i * 0.5) % 1, f = feet[i], on = p < beta;
      if (on) { const u = p / beta; f[2] = lerp(-fr, bk, u); f[1] = 0; f[0] = 0.25 * (1 - runW) * Math.max(0, 1 - u / 0.18); }
      else { const u = (p - beta) / (1 - beta); f[2] = lerp(bk, -fr, 0.5 - 0.5 * Math.cos(Math.PI * u)); f[1] = lift * Math.sin(Math.PI * u ** lerp(1, 0.6, runW)); f[0] = lerp(-0.6, 0.2, u); }
      if (on && !stance[i] && w > 0.5 && v > 0.05) person.onStep?.(i ? 'right' : 'left');
      stance[i] = on;
    }
    const reach = Math.sqrt((L1 + L2) ** 2 * 0.996 - fr * fr) + ANK;
    const gaitY = lerp(Math.min(HIP_Y - 0.01, reach + 0.03 * (0.5 - 0.5 * Math.cos(4 * Math.PI * ph))),
      reach - 0.035 + 0.06 * (0.5 - 0.5 * Math.cos(4 * Math.PI * (ph - beta / 2))), runW);

    // idle: breathing, weight shifts between the legs, looking around
    const br = Math.sin(t * breathRate);
    if ((nextShift -= dt) <= 0) { wsT = -Math.sign(wsT) * (0.5 + 0.5 * rng()); nextShift = 3 + rng() * 6; }
    ws += (wsT - ws) * (1 - Math.exp(-1.2 * dt));
    if ((nextLook -= dt) <= 0) { lookT = rng() < 0.4 ? 0 : (rng() - 0.5) * 1.2; nextLook = 2 + rng() * 4; }
    look += (lookT - look) * k3;

    const yl = feet[0][1], yr = feet[1][1], zl = feet[0][2], zr = feet[1][2], st = 1 - 0.8 * runW;
    P.y = lerp(HIP_Y - 0.012 - 0.012 * Math.abs(ws), gaitY, w);
    P.shift = lerp(0.022 * ws, 0.16 * (yl - yr) * st, w);
    P.tilt = lerp(0.04 * ws, 0.3 * (yl - yr) * st, w);
    P.twist = w * 0.18 * (zl - zr);
    P.lean = lerp(0.012 * br, -0.03 - 0.012 * v - 0.16 * runW, w);
    P.sy = -1.8 * P.twist; P.sz = -0.7 * P.tilt;
    P.hx = lerp(0.02 * br, 0, w) - P.lean * 0.7;
    P.hy = look * (1 - w) - P.twist - P.sy;
    P.hz = -(P.tilt + P.sz) * 0.8;
    const armA = lerp(Math.min(0.45, 0.1 + 0.17 * v), 0.8, runW);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, fwd = clamp(-(i ? zl : zr) / (E / 2 + 0.05), -1.2, 1.2), rel = Math.max(0, -side * ws);
      const c = r.carry[i], free = c === FREE;
      setA(P.arm[i], side, c[0] + 0.02 * br * (1 - w) + w * (0.01 + armA * fwd * c[2]), 0, lerp(0.07 + 0.01 * br, 0.07 + 0.06 * runW, w),
        c[1] + w * (free ? lerp(0.05 + 0.25 * Math.max(0, fwd) * Math.min(1, v), 1.35 + 0.25 * fwd, runW) : 0.3 * runW), 0.1);
      P.foot[i][0] = side * (r.footX + 0.02 * rel); P.foot[i][1] = -0.05 * rel;
      P.prop[i] = 0; P.slide[i] = 0;
    }
    for (const p of r.props) P.prop[p.arm] = p.pitch;

    if (workW > 0.001) { copy(X, P); work(X, t); mix(P, X, workW); }
    talk(dt);
    if (talkW > 0.001) mix(P, X, talkW * (1 - w));

    // apply the upper body
    r.pelvis.position.set(P.shift, P.y, 0);
    r.pelvis.rotation.set(0, P.twist, P.tilt);
    r.spine.rotation.set(P.lean, P.sy, P.sz);
    r.torso.scale.set(cw * (1 + 0.008 * br), 1, cd * (1 + 0.025 * br));
    r.neck.rotation.set(P.hx * 0.35, P.hy * 0.35, P.hz * 0.35);
    r.head.rotation.set(P.hx * 0.65, P.hy * 0.65, P.hz * 0.65);
    r.arms.forEach((a, i) => {
      const q = P.arm[i];
      a.sh.position.y = r.shY + 0.004 * br * (1 - w);
      a.sh.rotation.set(q[0], q[1], q[2]);
      a.el.rotation.x = Math.max(0, q[3]);
      a.hand.rotation.set(q[4], q[5], q[6]);
    });
    for (const p of r.props) {
      const a = r.arms[p.arm];
      p.g.rotation.x = P.prop[p.arm] - (r.spine.rotation.x + a.sh.rotation.x + a.el.rotation.x + a.hand.rotation.x);
      p.inner.position.y = P.slide[p.arm];
    }

    // legs: two-bone IK to each foot target; out of reach lifts the heel (toe-off)
    const Lr = (L1 + L2) * 0.998;
    for (let i = 0; i < 2; i++) {
      const l = r.legs[i], side = l.side, f = feet[i], sf = P.foot[i];
      const fx = lerp(sf[0], side * r.footX * 0.7, w), fy = ANK + f[1] * w;
      let pitch = f[0] * w, z = (fz[i] = lerp(sf[1], f[2], w));
      const ct = Math.cos(P.tilt);
      const hx = P.shift + side * r.HX * ct * Math.cos(P.twist), hy = P.y + side * r.HX * Math.sin(P.tilt);
      const dz = z + side * r.HX * ct * Math.sin(P.twist), dx = fx - hx, roll = Math.atan2(dx, hy - fy);
      let vert = Math.hypot(dx, hy - fy);
      if (vert * vert + dz * dz > Lr * Lr) {
        const nv = Math.sqrt(Math.max(0.01, Lr * Lr - dz * dz));
        pitch = Math.min(pitch, -Math.asin(clamp((vert - nv) / 0.15)));
        vert = nv;
      }
      const d = Math.max(0.3, Math.hypot(vert, dz));
      const a = Math.atan2(-dz, vert) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const kn = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1)) - Math.PI;
      l.hip.rotation.set(a, -P.twist, roll - P.tilt);
      l.knee.rotation.x = kn;
      l.ankle.rotation.set(pitch - a - kn, 0, -roll);
    }
    for (const sk of r.skirts) sk.m.scale.z = sk.z * (1 + 0.6 * Math.abs(fz[0] - fz[1]));

    if ((blinkIn -= dt) < -0.12) blinkIn = 2 + rng() * 4;
    r.eyes.forEach((m, i) => { m.scale.y = eyeY[i] * (blinkIn < 0 ? 0.12 : 1); });
  }
  update(0, 0); // settle into the idle pose
  return {
    update,
    setTalking: (v) => { talking = !!v; },
    setWorking: (v) => { working = !!v; },
  };
}

// ---------- palettes ----------
const SKIN = ['#f3d5c0', '#e8bfa0', '#dcaa86', '#cf9670', '#be8259', '#a86d47', '#93593a', '#7a472d', '#603722', '#4a2a1a'];
const DARK_HAIR = ['#120e0c', '#1a1310', '#24190f', '#2e2016'];
const ANY_HAIR = [...DARK_HAIR, '#4a3220', '#6a4528', '#8f5f33', '#b88a4f', '#d2b27a', '#8a3c1e'];
// broad regions by latitude and longitude: skin tone range (indices into SKIN), hair, dress style
const REGIONS = [
  { lat: [5, 37], lon: [60, 98], skin: [3, 8], hair: DARK_HAIR, dress: 'sa' },
  { lat: [-11, 55], lon: [98, 150], skin: [1, 5], hair: DARK_HAIR, dress: 'ea' },
  { lat: [15, 42], lon: [-18, 60], skin: [2, 6], hair: DARK_HAIR, dress: 'me' },
  { lat: [-35, 15], lon: [-18, 52], skin: [6, 9], hair: DARK_HAIR, dress: 'af' },
  { lat: [35, 72], lon: [-25, 45], skin: [0, 3], hair: ANY_HAIR, dress: 'west' },
  { lat: [-56, 15], lon: [-120, -30], skin: [2, 7], hair: DARK_HAIR, dress: 'west' },
];
const WORLD = { skin: [0, 9], hair: ANY_HAIR, dress: 'west' };
const regionAt = (lat, lon) => REGIONS.find((g) => lat >= g.lat[0] && lat <= g.lat[1] && lon >= g.lon[0] && lon <= g.lon[1]) || WORLD;

// ---------- player characters ----------
const LOOKS = {
  mountaineer: {
    fem: true, height: 1.65, shoulder: 0.96, hip: 1.0, skin: '#b98157', hair: { style: 'braid', color: '#18120e' },
    top: { color: '#c8372d' }, bottom: { color: '#3b4048' }, shoes: '#5a3b22', boots: 'leather', gloves: '#2d2f33',
    acc: [['bands', { color: '#a12a22' }], ['backpack', { color: '#e09a2b' }], ['rope', { color: '#2f7fc1' }], ['knitcap', { color: '#e0b53a' }]],
  },
  photojournalist: {
    height: 1.8, build: 1.04, shoulder: 1.04, skin: '#5a3825', hair: { style: 'curly', color: '#141010' }, facial: 'beard',
    top: { color: '#2c3e5c', sleeves: 'short' }, bottom: { color: '#3d3a35' }, shoes: '#2a2420',
    acc: [['vest', { color: '#a89060' }], ['camera'], ['belt']],
  },
  scientist: {
    fem: true, height: 1.64, shoulder: 0.95, hip: 1.04, skin: '#d9a77f', hair: { style: 'ponytail', color: '#4a2c1a' }, eyes: '#4a3018',
    top: { color: '#8fb8d8', sleeves: 'short' }, bottom: { color: '#b9a57d', shorts: true }, shoes: '#6b5039', boots: 'leather',
    acc: [['sunhat', { color: '#e8dcb5', band: '#6b8f3a' }], ['clipboard'], ['belt', { color: '#5a3b22' }]],
  },
  sailor: {
    height: 1.84, build: 1.12, shoulder: 1.06, skin: '#f0c8ae', hair: { style: 'short', color: '#b5562a' }, facial: 'beard', eyes: '#4f7390',
    top: { color: '#f2c230', kind: 'rubber' }, bottom: { color: '#2b3a55' }, shoes: '#1f2326', boots: 'rubber',
    acc: [['knitcap', { color: '#1f3a5f' }], ['hood', { color: '#f2c230' }]],
  },
  trekker: {
    fem: true, height: 1.7, shoulder: 0.94, hip: 1.02, skin: '#c08a62', hair: { style: 'long', color: '#1a1210' },
    top: { color: '#e7dfcc' }, bottom: { color: '#8a7357' }, shoes: '#a07a4f', boots: 'leather',
    acc: [['headwrap', { color: '#d9c39a' }], ['goggles'], ['scarf', { color: '#b5562f' }], ['belt', { color: '#5a3b22' }]],
  },
  pilot: {
    height: 1.76, shoulder: 1.03, skin: '#e2b48c', hair: { style: 'short', color: '#121212' },
    top: { color: '#6b4226', kind: 'leather' }, bottom: { color: '#5b5f4a' }, shoes: '#2c2622', boots: 'leather',
    acc: [['collar', { color: '#e6d8bf' }], ['headset'], ['belt']],
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

const BRIGHT = ['#c0392b', '#e5a43a', '#2e86ab', '#8e44ad', '#27ae60', '#d35400', '#b03060', '#1f6f5f'];
const SARI = ['#c2185b', '#e65100', '#f9a825', '#2e7d32', '#6a1b9a', '#00838f', '#b71c1c', '#ad1457'];
// Everyday clothes by region and gender: sari or kurta in South Asia, wrap and headwrap in Africa, and so on.
function everyday(rng, f, dress, out) {
  if (dress === 'sa' && f) {
    const c = shade(pick(rng, SARI), rng);
    out.top = { color: shade(pick(rng, SARI), rng), sleeves: 'short' }; out.bottom = { color: c };
    out.acc.push(['skirt', { color: c, len: 0.86, flare: 1.4 }], ['pallu', { color: c }]);
    if (rng() < 0.4) out.acc.push(['headscarf', { color: c }]);
    out.shoes = 'sandal';
  } else if (dress === 'sa') {
    const c = shade(pick(rng, ['#f2ede2', '#e8dcc0', '#c9d6e0', '#d8c3a5', '#9fb7a0']), rng, 0.04);
    out.top = { color: c }; out.bottom = { color: shade(pick(rng, ['#efe9dc', '#d9d2c2', '#3b3f4a']), rng, 0.04) };
    out.acc.push(['skirt', { color: c, len: 0.42, flare: 1.2 }], ['placket', { color: darker(c, 0.08) }]);
    out.shoes = 'sandal';
  } else if (dress === 'af' && f) {
    const c = shade(pick(rng, BRIGHT), rng);
    out.top = { color: shade(pick(rng, BRIGHT), rng), sleeves: 'short' }; out.bottom = { color: c };
    out.acc.push(['skirt', { color: c, len: 0.8, flare: 1.3 }], ['headwrap', { color: shade(pick(rng, BRIGHT), rng) }]);
  } else if (dress === 'me' && f) {
    const c = shade(pick(rng, ['#3b3f4a', '#5a3a4a', '#2f4a5a', '#6b5a4a']), rng);
    out.top = { color: c }; out.bottom = { color: c };
    out.acc.push(['skirt', { color: c, len: 0.84, flare: 1.35 }], ['headscarf', { color: shade(pick(rng, ['#e8e2d4', '#2a2a30', '#7a3a4a', '#3a5a7a']), rng) }]);
  } else if (f) {
    out.top = { color: shade(pick(rng, ['#d0453a', '#e5a43a', '#3a8fb7', '#8a3a7a', '#4c8a4c', '#e8e2d4']), rng), sleeves: rng() < 0.5 ? 'short' : 'long' };
    if (rng() < 0.5) { const c = shade(pick(rng, ['#3b3f4a', '#6b3a3a', '#2f4a5a', '#7a6a4a']), rng); out.bottom = { color: c, bare: true }; out.acc.push(['skirt', { color: c, len: 0.6, flare: 1.3 }]); }
    else out.bottom = { color: shade(pick(rng, ['#2f3a55', '#3b3f4a', '#5b4b3d']), rng) };
  } else {
    out.top = { color: shade(pick(rng, ['#6d8b4e', '#b9493a', '#d8cfb8', '#4f6d8f', '#e8e2d4', '#7a6a8a']), rng), sleeves: rng() < 0.4 ? 'short' : 'long' };
    out.bottom = { color: shade(pick(rng, ['#2f3a55', '#3b3f4a', '#5b4b3d', '#6b5a3a']), rng) };
    out.acc.push(['belt']);
    if (dress === 'me' && rng() < 0.5) out.acc.push(['headwrap', { color: shade(pick(rng, ['#efe9dc', '#c0392b']), rng, 0.03) }]);
  }
  return out;
}
const skirted = (o) => o.acc.some(([n]) => n === 'skirt');

// role => (rng, feminine, dress) => outfit fields merged over the random base person
const ROLES = {
  farmer: (rng, f, dress) => {
    const o = everyday(rng, f, dress, { acc: [['hoe']] });
    if (!o.acc.some(([n]) => HATS.has(n))) o.acc.push(['strawhat', { conical: dress === 'ea' || (dress === 'sa' && rng() < 0.3) }]);
    if (dress === 'west' && !f && rng() < 0.5) { const c = shade('#3d5a80', rng); o.bottom = { color: c }; o.acc.push(['bib', { color: c }]); }
    return o;
  },
  fisher: (rng) => {
    const wader = shade(pick(rng, ['#3e4a32', '#2f3b33', '#3a4250', '#5a4a2a']), rng, 0.04);
    return {
      top: { color: shade(pick(rng, ['#2f5e7d', '#c94f2d', '#d9d2c2', '#e0b53a', '#3d4a3a']), rng) },
      bottom: { color: wader, kind: 'rubber' }, shoes: wader, boots: 'rubber',
      acc: [['bib', { color: wader, kind: 'rubber' }], ['net'], ...(rng() < 0.5 ? [['knitcap', { color: shade(pick(rng, ['#1f3a5f', '#9b2b2b', '#3d4a3a']), rng) }]] : [])],
    };
  },
  factory: (rng) => {
    const overall = shade(pick(rng, ['#2f4f7f', '#4b5563', '#7a3b2e', '#3b5a4a']), rng);
    const clip = rng() < 0.4;
    return {
      top: { color: shade(pick(rng, ['#c9ccd1', '#e9e6df', '#8a9099']), rng, 0.04) },
      bottom: { color: overall }, gloves: clip ? null : '#cfa94a', shoes: '#2a2622', boots: 'leather',
      acc: [['bib', { color: overall }], ['hardhat', { color: pick(rng, ['#f2f2ee', '#f2c230', '#e06a1f']) }], [clip ? 'clipboard' : 'wrench']],
      work: clip ? 'clipboard' : 'factory',
    };
  },
  herder: (rng, f, dress) => {
    const o = everyday(rng, f, dress, { acc: [['staff']], boots: 'leather', shoes: '#4a3424' });
    if (o.shoes === 'sandal') o.boots = null;
    o.acc.push(['shawl', { color: shade(pick(rng, dress === 'af' ? ['#b0262c', '#c0392b'] : ['#a3322c', '#d98c2b', '#4a6fa5', '#6b2d5c', '#7a6a4f']), rng), stripe: shade(pick(rng, ['#f0e2c0', '#1f1f24', '#e0b53a']), rng, 0.04) }]);
    if (!o.acc.some(([n]) => HATS.has(n)) && rng() < 0.6) o.acc.push(dress === 'sa' || dress === 'me' ? ['headwrap', { color: shade(pick(rng, ['#efe9dc', '#d98c2b', '#c0392b']), rng, 0.03) }] : ['knitcap', { color: shade('#5a4a3a', rng) }]);
    return o;
  },
  teacher: (rng, f, dress) => {
    const o = everyday(rng, f, dress, { acc: [['book', { color: shade(pick(rng, ['#8a2b2b', '#2b4a8a', '#2b6b4a']), rng) }], ['satchel', { color: shade('#7a4e2d', rng) }]] });
    if (rng() < 0.45) o.acc.push(['glasses']);
    if (o.shoes === 'sandal' && rng() < 0.5) o.shoes = shade('#3a2c22', rng);
    return o;
  },
  nurse: (rng, f) => {
    const scrubs = shade(pick(rng, ['#4fa3a5', '#3d6fb3', '#7b5ea7', '#58a37a']), rng, 0.05);
    return { top: { color: scrubs, sleeves: 'short' }, bottom: { color: scrubs }, shoes: '#ecebe8', acc: [['badge'], ['stethoscope'], ['clipboard']], ...(f ? { hairStyle: 'bun' } : {}) };
  },
  builder: (rng) => ({
    top: { color: shade(pick(rng, ['#6d7a86', '#9a5b3a', '#3c4a5c', '#d9d2c2']), rng) },
    bottom: { color: shade('#3a4a66', rng) }, gloves: '#c9a26b', shoes: '#6a4a2a', boots: 'leather',
    acc: [['hivis', { color: pick(rng, ['#c8f03a', '#ff7a1a']) }], ['hardhat', { color: pick(rng, ['#f2c230', '#f2f2ee', '#e06a1f']) }], ['toolbelt'], ['hammer']],
  }),
  vendor: (rng, f, dress) => {
    const o = everyday(rng, f, dress, {
      acc: [['basket', { fruit: [pick(rng, ['#e8862a', '#d6402e']), pick(rng, ['#6fae3a', '#e8c23a']), pick(rng, ['#d6402e', '#7a3a8a'])] }]],
    });
    if (!skirted(o) || rng() < 0.5) o.acc.push(['apron', { color: shade(pick(rng, ['#f2efe6', '#3f6e9b', '#c9b48a']), rng, 0.04) }]);
    return o;
  },
};

// createNPC(role, seed, { lat, lon }?): the optional place picks skin tones and dress plausible for the region.
export function createNPC(role, seed = 0, place) {
  const idx = NPC_ROLES.indexOf(role);
  if (idx < 0) throw new Error(`Unknown NPC role: ${role}`);
  const s = Math.imul((seed | 0) + 1, 0x9e3779b1) ^ Math.imul(idx + 1, 0x85ebca6b);
  const rng = rand(s), R = place ? regionAt(place.lat, place.lon) : WORLD;
  const f = rng() < (role === 'builder' || role === 'fisher' ? 0.2 : role === 'nurse' ? 0.7 : 0.5);
  const age = rng();
  const outfit = { shoes: shade('#3a2c22', rng), ...ROLES[role](rng, f, R.dress) };
  const base = {
    fem: f,
    height: f ? 1.5 + rng() * 0.2 : 1.62 + rng() * 0.24,
    build: 0.9 + rng() * 0.28 + (age > 0.6 ? 0.06 : 0),
    shoulder: 0.95 + rng() * 0.1,
    hip: 0.95 + rng() * 0.1,
    skin: shade(SKIN[R.skin[0] + Math.floor(rng() * (R.skin[1] - R.skin[0] + 1))], rng, 0.03),
    hair: {
      style: outfit.hairStyle || pick(rng, f ? ['long', 'bun', 'ponytail', 'braid', 'short', 'curly'] : ['short', 'buzz', 'curly', 'short', ...(age > 0.6 ? ['bald'] : [])]),
      color: age > 0.82 ? pick(rng, ['#8f8d88', '#c9c6c0']) : pick(rng, R.hair),
    },
    eyes: pick(rng, ['#2a1a10', '#3a2414', '#4a3018', ...(R === WORLD || R.dress === 'west' ? ['#4f7390', '#5a6a3a'] : [])]),
    facial: f ? null : pick(rng, [null, null, 'beard', 'moustache']),
  };
  const p = buildPerson({ ...base, ...outfit, work: outfit.work || role }, s ^ 0x5bd1e995);
  p.role = role;
  return p;
}
