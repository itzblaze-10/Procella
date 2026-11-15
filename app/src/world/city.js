// Thirty famous cities rebuilt from real OpenStreetMap footprints (© OpenStreetMap contributors, ODbL), committed so
// the demo works offline. Each footprint is extruded from the lowest ground under it; facades are drawn by a shader
// (window grid at real floor and bay sizes over CC0 textures, glass curtain walls on towers, windows lit at night).
// Geometry is merged into chunks to keep draw calls low. Roads, water and parks are laid on the terrain, and the
// real polygons sit in a spatial hash for collisions and surfaces.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DATA = new URL('../../data/cities/', import.meta.url);
const CHUNK = 300, BIG = 700, CELL = 16;       // building chunk, road/water/park chunk, collision cell (metres)
const ROAD_W = [18, 14, 11, 7, 3];              // carriageway width by class, metres
const TURN = 0.45;                               // radians: a sharper corner starts a new window grid

let INDEX;
export const loadIndex = () => (INDEX ||= fetch(new URL('index.json', DATA)).then(r => (r.ok ? r.json() : [])).catch(() => []));
export function cityNear(index, lat, lon, km = 4) {
  let best = null, bd = km;
  for (const c of index) {
    const d = Math.hypot((c.lat - lat) * 111.32, (c.lon - lon) * 111.32 * Math.cos(lat * Math.PI / 180));
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export async function loadCity(slug) {
  const r = await fetch(new URL(slug + '.json', DATA));
  if (!r.ok) throw new Error('city ' + slug + ' ' + r.status);
  return r.json();
}

// ---------- CC0 textures (Poly Haven), each with its mean linear luminance so tints set the real albedo ----------
const TEX = {};
function tex(name) {
  return (TEX[name] ||= new THREE.TextureLoader().loadAsync(new URL(`../../assets/tex/${name}.jpg`, import.meta.url).href).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (name.endsWith('_diff')) {
      t.colorSpace = THREE.SRGBColorSpace;
      const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.drawImage(t.image, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data, L = v => (v / 255) ** 2.2; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * L(d[i]) + 0.7152 * L(d[i + 1]) + 0.0722 * L(d[i + 2]);
      t.userData.mean = s / 64;
    }
    return t;
  }));
}
const SOLIDS = ['concrete_block_wall', 'clay_plaster', 'brick_wall_02', 'corrugated_iron'];

// ---------- spatial hash ----------
class Grid {
  constructor() { this.m = new Map(); this.stamp = 0; }
  add(o, x0, z0, x1, z1) {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = i * 65536 + j, a = this.m.get(k); if (a) a.push(o); else this.m.set(k, [o]);
    }
  }
  // f(o) once per item near (x, z); true from f stops the search
  some(x, z, r, f) {
    const s = ++this.stamp;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
      const a = this.m.get(i * 65536 + j); if (!a) continue;
      for (const o of a) if (o.s !== s) { o.s = s; if (f(o)) return true; }
    }
    return false;
  }
}
function inside(a, x, z) {
  let c = false;
  for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
    const zi = a[i + 1], zj = a[j + 1];
    if ((zi > z) !== (zj > z) && x < (a[j] - a[i]) * (z - zi) / (zj - zi) + a[i]) c = !c;
  }
  return c;
}
const E = { d2: 0, x: 0, z: 0, nx: 0, nz: 0 }; // nearest point on a ring's outline, and that edge's outward normal
function edge(a, x, z) {
  E.d2 = Infinity;
  for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
    const ex = a[i] - a[j], ez = a[i + 1] - a[j + 1], l2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - a[j]) * ex + (z - a[j + 1]) * ez) / l2)), cx = a[j] + ex * t, cz = a[j + 1] + ez * t, d2 = (x - cx) ** 2 + (z - cz) ** 2;
    if (d2 < E.d2) { const l = Math.sqrt(l2); E.d2 = d2; E.x = cx; E.z = cz; E.nx = ez / l; E.nz = -ex / l; }
  }
}
const segD2 = (s, x, z) => { const t = Math.max(0, Math.min(1, ((x - s.x0) * s.dx + (z - s.z0) * s.dz) / s.l2)); return (x - s.x0 - s.dx * t) ** 2 + (z - s.z0 - s.dz * t) ** 2; };
const bbox = (a, o = {}) => { o.x0 = o.z0 = Infinity; o.x1 = o.z1 = -Infinity; for (let i = 0; i < a.length; i += 2) { o.x0 = Math.min(o.x0, a[i]); o.x1 = Math.max(o.x1, a[i]); o.z0 = Math.min(o.z0, a[i + 1]); o.z1 = Math.max(o.z1, a[i + 1]); } o.a = a; return o; };

// Ring from a data record (decimetres, from index `from`) to world metres, counter-clockwise (positive shoelace in x, z).
function ring(rec, from, ox, oz) {
  const n = (rec.length - from) >> 1, a = new Float64Array(n * 2); let area = 0;
  for (let i = 0; i < n; i++) { a[i * 2] = rec[from + i * 2] / 10 + ox; a[i * 2 + 1] = rec[from + i * 2 + 1] / 10 + oz; }
  for (let i = 0, j = n - 1; i < n; j = i++) area += a[j * 2] * a[i * 2 + 1] - a[i * 2] * a[j * 2 + 1];
  if (area < 0) for (let i = 0, j = n - 1; i < j; i++, j--) { const x = a[i * 2], z = a[i * 2 + 1]; a[i * 2] = a[j * 2]; a[i * 2 + 1] = a[j * 2 + 1]; a[j * 2] = x; a[j * 2 + 1] = z; }
  return { a, n, area: Math.abs(area) / 2 };
}
// Triangles of a ring, wound to face up; null when earcut fails (self-intersecting or degenerate rings).
function triangulate(a, n, area) {
  const pts = []; for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(a[i * 2], a[i * 2 + 1]));
  const out = []; let sum = 0;
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(pts, [])) {
    const cy = (a[j * 2 + 1] - a[i * 2 + 1]) * (a[k * 2] - a[i * 2]) - (a[j * 2] - a[i * 2]) * (a[k * 2 + 1] - a[i * 2 + 1]);
    sum += Math.abs(cy) / 2; if (cy >= 0) out.push(i, j, k); else out.push(i, k, j);
  }
  return out.length && Math.abs(sum - area) < area * 0.05 ? out : null;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

// ---------- look of each building, from its OSM kind and height ----------
// mat: 0 concrete, 1 plaster, 2 brick, 3 corrugated iron, 4 stone (block texture at ashlar scale), 5 glass curtain wall
const PAL = {
  0: [0xc4c0b8, 0xaaa69f, 0x92908c, 0xd2cfc8, 0xb9b2a6],
  1: [0xe6dcc4, 0xe0cfa9, 0xd6d3cc, 0xd8b98c, 0xcfa595, 0xece9e2, 0xc9c0ad, 0xe2d2b8],
  2: [0xd8d0c8, 0xc0b4aa, 0xb4aca4, 0xe0d4c6],
  3: [0xc9ccd0, 0x8a9aa8, 0xa0463a, 0x6f8a74, 0xd8d4c8],
  4: [0xd9ccb0, 0xcfc3a6, 0xc2b8a2, 0xe0d6be, 0xd4c6a8],
  5: [0x6f90a6, 0x4a5d70, 0x8f7c60, 0xa6b0b8, 0x628d8a, 0x7d8ea0],
};
const ROOF = [0x8e8c88, 0x74726f, 0x667079, 0x8a8478, 0x5c5a57, 0x9a9690];
//            concrete plaster brick iron stone   (relative odds)
const MIX = { 0: [3, 4, 1.5, 0, 1.5], 1: [2.5, 5, 2.5, 0, 0.5], 2: [4, 2, 0.5, 0, 3], 3: [3, 4, 1, 0.5, 0.5], 4: [2.5, 0, 1, 6, 0],
  5: [0, 2.5, 1, 0, 6], 6: [0.5, 5, 4, 0, 0], 7: [3, 2, 2, 0, 3], 8: [0, 2.5, 1, 0, 6] };
const lerp = (R, a, b) => a + (b - a) * R();
function style(kind, h, R) {
  const w = MIX[kind] || MIX[0]; let r = R() * w.reduce((s, x) => s + x, 0), mat = 0;
  while (r > w[mat]) r -= w[mat++];
  const tall = h > 60 && R() < ({ 0: 0.7, 1: 0.35, 2: 0.85, 3: 0.8, 7: 0.6 }[kind] || 0);
  if (tall) mat = 5;
  const s = { mat, fh: lerp(R, 3.0, 3.4), bw: lerp(R, 2.6, 3.6), gw: lerp(R, 0.38, 0.55), gh: lerp(R, 0.5, 0.7), shop: false, metal: mat === 3 || mat === 5 ? 'metal' : 'stone' };
  if (mat === 5) Object.assign(s, { fh: lerp(R, 3.6, 4.2), bw: lerp(R, 1.4, 1.8) });
  else if (kind === 5 || kind === 8) Object.assign(s, { fh: lerp(R, 4.5, 6.5), bw: lerp(R, 3.6, 5), gw: lerp(R, 0.28, 0.4), gh: lerp(R, 0.55, 0.7) });
  else if (kind === 4) Object.assign(s, { fh: 6, bw: 4, gw: lerp(R, 0.4, 0.7), gh: 0.25 });
  else if (kind === 2) Object.assign(s, { fh: lerp(R, 3.5, 3.9), gw: lerp(R, 0.55, 0.82), gh: lerp(R, 0.5, 0.7) });
  else if (kind === 6) Object.assign(s, { fh: 2.9, bw: lerp(R, 3, 3.6), gw: 0.38, gh: 0.45 });
  s.shop = mat !== 5 && h < 45 && (kind === 3 || ((kind === 0 || kind === 1 || kind === 2) && R() < 0.45));
  s.color = new THREE.Color(pick(R, PAL[mat])).multiplyScalar(mat === 5 ? 1 : 0.72);
  s.roof = new THREE.Color(pick(R, ROOF)).multiplyScalar(0.6);
  return s;
}

// ---------- shaders ----------
const COMMON = /* glsl */`
varying vec3 vWP; varying vec3 vWN;
float fRough, fMetal; vec3 fEmit; vec2 fNrm;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`;
// tangent frame: x along the wall (or east), y up the wall (or north)
const NORMAL = /* glsl */`
#include <normal_fragment_maps>
{
  vec3 N = normalize(vWN), T = abs(N.y) > 0.5 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-N.z, 0.0, N.x)), B = abs(N.y) > 0.5 ? vec3(0.0, 0.0, -1.0) : vec3(0.0, 1.0, 0.0);
  normal = normalize((viewMatrix * vec4(normalize(N + T * fNrm.x + B * fNrm.y), 0.0)).xyz);
}`;
function patch(m, uniforms, attrs, vert, frag, key) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; varying vec3 vWN;\n${attrs}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * normal);\n${vert}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${COMMON}\n${Object.keys(uniforms).map(k => `uniform ${uniforms[k].type} ${k};`).join('\n')}\n${attrs.replace(/attribute \w+ \w+;/g, '')}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfRough = roughness; fMetal = metalness; fEmit = vec3(0.0); fNrm = vec2(0.0);\n${frag}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = fRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = fMetal;')
      .replace('#include <normal_fragment_maps>', NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fEmit;');
  };
  m.customProgramCacheKey = () => key;
  return m;
}

const FACADE = /* glsl */`
{
  float part = vA.x, mat = vA.y, seed = vA.z, top = vA.w;
  bool roof = part > 1.5;
  vec2 p = roof ? vec2(vWP.x, -vWP.z) : vU;
  vec4 c, q; float m = roof ? 0.0 : mat;
  if (m < 0.5) { c = texture2D(tD0, p / 3.0); q = texture2D(tN0, p / 3.0); c.rgb = vec3(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) / uMean.x); }
  else if (m < 1.5) { c = texture2D(tD1, p / 3.0); q = texture2D(tN1, p / 3.0); c.rgb = vec3(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) / uMean.y); }
  else if (m < 2.5) { c = texture2D(tD2, p / 2.4); q = texture2D(tN2, p / 2.4); c.rgb /= uMean.z * 1.6; }
  else if (m < 3.5) { c = texture2D(tD3, p / 2.0); q = texture2D(tN3, p / 2.0); c.rgb = vec3(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) / uMean.w); }
  else { c = texture2D(tD0, p / 5.5); q = texture2D(tN0, p / 5.5); c.rgb = vec3(mix(1.0, dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) / uMean.x, 0.6)); }
  vec3 base = diffuseColor.rgb * c.rgb, col = base;
  vec2 tn = (q.xy * 2.0 - 1.0) * vec2(roof ? 1.0 : -1.0, 1.0);
  fRough = 0.88; fMetal = 0.0; fNrm = tn * 0.6;
  if (part > 2.5) { col = diffuseColor.rgb * (0.85 + 0.15 * step(0.5, fract(vU.x * 2.5))); fRough = 0.45; fMetal = 0.5; fNrm = vec2(0.0); }
  else if (!roof) {
    if (mat > 2.5 && mat < 3.5) { fRough = 0.5; fMetal = 0.45; }
    float u = vU.x, v = vU.y, run = vC.x, fh = vB.x, gw = vB.z, gh = vB.w;
    float bx = run / max(1.0, floor(run / vB.y + 0.5));
    float g0 = part > 0.5 ? 4.5 : 0.0;
    float px = max(fwidth(u), fwidth(v)), fade = smoothstep(0.05, 0.25, px / min(fh, bx));
    vec2 cell = vec2(floor(u / bx), floor((v - g0) / fh)), f = vec2(u - cell.x * bx, v - g0 - cell.y * fh);
    float rnd = h21(cell + vec2(seed * 1.7, vC.y * 7.31)), lit = step(0.58, h21(cell.yx * 1.37 + vec2(vC.y * 3.1, seed * 0.31)));
    vec3 warm = mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.7, 0.42), rnd) * (0.35 + 0.5 * rnd);
    bool zone = run > 1.8 && v > 0.2 && v < top - 0.9 && (v < g0 || (cell.y + 1.0) * fh + g0 < top - 0.3);
    vec3 avg = base; float avgRough = 0.85, glassFrac = 0.0;
    if (mat > 4.5) { // curtain wall: mullions every bay, a spandrel band at each slab
      vec3 g = diffuseColor.rgb;
      float dx = min(f.x, bx - f.x), slab = step(f.y, 0.85);
      col = g * 0.35; fRough = 0.05; fMetal = 0.92; fNrm = vec2((rnd - 0.5) * 0.04, 0.0); // panes sit a hair off-plane, so reflections break up
      if (slab > 0.5) { col = g * 0.22; fRough = 0.25; fMetal = 0.7; }
      if (dx < 0.06 || abs(f.y - 0.85) < 0.04) { col = vec3(0.42, 0.44, 0.46); fRough = 0.35; fMetal = 0.85; fNrm = vec2(0.0); }
      float on = step(0.6, h21(vec2(floor(cell.x / 3.0), cell.y) + seed));
      fEmit = (1.0 - slab) * on * vec3(0.8, 0.88, 1.0) * 0.45 * uNight;
      avg = g * 0.3; avgRough = 0.1; glassFrac = 0.7;
      if (v > top - 0.6) { col = vec3(0.4); fRough = 0.4; fEmit = vec3(0.0); }
    } else if (zone) {
      float W = gw * bx, H = gh * fh, x0 = (bx - W) * 0.5, y0 = max(0.35, (fh - H) * 0.6);
      if (v < g0) { f = vec2(f.x, v); W = bx - 0.5; x0 = 0.25; y0 = 0.15; H = g0 - 0.95; }  // shopfront
      vec2 l = f - vec2(x0, y0);
      float rv = 0.12, e = min(min(l.x, W - l.x), min(l.y, H - l.y));
      vec3 frame = h21(vec2(seed)) > 0.5 ? vec3(0.62, 0.6, 0.56) : vec3(0.06);
      if (e > 0.0) {
        if (e < rv) { // reveal: jambs face sideways, the head faces down and sits in shadow, the sill faces up
          col = base * 0.55; fNrm = vec2(0.0, 0.9);
          if (e == l.x) fNrm = vec2(0.9, 0.0); else if (e == W - l.x) fNrm = vec2(-0.9, 0.0); else if (e == H - l.y) { fNrm = vec2(0.0, -0.9); col *= 0.6; }
        } else {
          vec2 g = l - rv; float gw2 = W - 2.0 * rv, gh2 = H - 2.0 * rv;
          if (g.x < 0.05 || g.x > gw2 - 0.05 || g.y < 0.05 || g.y > gh2 - 0.05 || (gw2 > 1.1 && abs(g.x - gw2 * 0.5) < 0.03) || (v > g0 && abs(g.y - gh2 * 0.72) < 0.025)) {
            col = frame; fRough = 0.5; fNrm = vec2(0.0);
          } else {
            col = vec3(0.035, 0.042, 0.05) + vec3(0.12, 0.11, 0.09) * step(0.8, rnd) * step(g.y, gh2 * (0.4 + rnd * 0.5)); // some blinds half down
            fRough = 0.03; fMetal = 0.15; fNrm = vec2(0.0);
            fEmit = warm * lit * uNight * (v < g0 ? 1.8 : 1.0);
          }
        }
      } else if (l.y < 0.0 && l.y > -0.09 && l.x > -0.08 && l.x < W + 0.08 && v > g0) { col = base * 1.12; fNrm = vec2(0.0, 0.8); }
      glassFrac = (W - 2.0 * rv) * (H - 2.0 * rv) / (bx * fh);
      avg = mix(base, vec3(0.05), glassFrac * 0.85); avgRough = mix(0.88, 0.2, glassFrac);
    }
    if (v > top - 0.3 && mat < 4.5) { col = base * 1.15; fNrm = vec2(0.0, 0.5); fEmit = vec3(0.0); } // parapet coping
    col = mix(col, avg, fade); fRough = mix(fRough, avgRough, fade); fNrm *= 1.0 - fade;
    fEmit = mix(fEmit, vec3(1.0, 0.6, 0.3) * 0.1 * glassFrac * uNight, fade);
  }
  diffuseColor.rgb = col;
}`;

const ROAD = /* glsl */`
{
  float ac = vR.x, al = vR.y, cls = vR.z, w = vR.w;
  vec2 p = vec2(vWP.x, -vWP.z);
  vec3 c; vec2 tn;
  if (cls > 3.5) { c = vec3(dot(texture2D(tP, p / 1.6).rgb, vec3(0.2126, 0.7152, 0.0722)) / uMean.y) * vec3(0.36, 0.34, 0.31); tn = texture2D(tPN, p / 1.6).xy * 2.0 - 1.0; }
  else { c = vec3(dot(texture2D(tA, p / 7.0).rgb, vec3(0.2126, 0.7152, 0.0722)) / uMean.x) * vec3(0.085, 0.084, 0.082); tn = texture2D(tAN, p / 7.0).xy * 2.0 - 1.0; }
  float px = fwidth(al), mark = 0.0;
  if (cls < 2.5) mark = step(abs(ac - w * 0.5), 0.07) * step(fract(al / 9.0), 0.45);
  if (cls < 1.5) mark = max(mark, step(abs(ac - 0.7), 0.08) + step(abs(w - ac - 0.7), 0.08));
  c = mix(c, vec3(0.62), mark * (1.0 - smoothstep(0.06, 0.2, px)));
  float side = min(ac, w - ac);
  if (cls < 3.5) c = mix(c, vec3(0.3, 0.29, 0.27), step(side, 0.28));
  diffuseColor.rgb = c; diffuseColor.a = smoothstep(0.0, 0.18, side);
  fNrm = tn * 0.5;
}`;

// overlays blend colour only: destination alpha stays 1, or the page behind the canvas shows through
const blend = { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, polygonOffset: true };

function geom(index, attrs) {
  const g = new THREE.BufferGeometry();
  for (const k in attrs) g.setAttribute(k, new THREE.Float32BufferAttribute(attrs[k][0], attrs[k][1]));
  g.setIndex(index); return g;
}
// split triangles until every edge is shorter than L, so overlays follow the ground
function drape(out, ax, az, bx, bz, cx, cz, L) {
  const ab = (ax - bx) ** 2 + (az - bz) ** 2, bc = (bx - cx) ** 2 + (bz - cz) ** 2, ca = (cx - ax) ** 2 + (cz - az) ** 2, m = Math.max(ab, bc, ca);
  if (m < L * L) { out.push(ax, az, bx, bz, cx, cz); return; }
  if (m === ab) { const mx = (ax + bx) / 2, mz = (az + bz) / 2; drape(out, ax, az, mx, mz, cx, cz, L); drape(out, mx, mz, bx, bz, cx, cz, L); }
  else if (m === bc) { const mx = (bx + cx) / 2, mz = (bz + cz) / 2; drape(out, ax, az, bx, bz, mx, mz, L); drape(out, ax, az, mx, mz, cx, cz, L); }
  else { const mx = (cx + ax) / 2, mz = (cz + az) / 2; drape(out, ax, az, bx, bz, mx, mz, L); drape(out, mx, mz, bx, bz, cx, cz, L); }
}
const yieldFrame = () => new Promise(r => setTimeout(r));

export class City {
  constructor(scene, terrain, data, landmarks = []) {
    this.scene = scene; this.terrain = terrain; this.data = data; this.landmarks = landmarks;
    this.center = terrain.toLocal(data.lat, data.lon);
    this.group = new THREE.Group(); this.group.name = 'city:' + data.slug; scene.add(this.group);
    this.bGrid = new Grid(); this.rGrid = new Grid(); this.wGrid = new Grid(); this.pGrid = new Grid();
    this.parks = []; this.uNight = { value: 0 };
  }

  async build() {
    const t0 = performance.now(), D = this.data;
    const [d0, d1, d2, d3, n0, n1, n2, n3, asph, asphN, water, grass] = await Promise.all([
      ...SOLIDS.map(n => tex(n + '_diff')), ...SOLIDS.map(n => tex(n + '_nor_gl')), tex('aerial_asphalt_01_diff'), tex('aerial_asphalt_01_nor_gl'), tex('waternormals'), tex('aerial_grass_rock_diff')]);
    this.tLoad = performance.now() - t0;
    this.buildings(D.b || [], { d0, d1, d2, d3, n0, n1, n2, n3 }); await yieldFrame();
    this.roads(D.r || [], asph, asphN, d0, n0); await yieldFrame();
    this.areas(D.w || [], D.p || [], water, grass);
    this.lights(D.r || []);
    this.buildMs = performance.now() - t0;
    return this;
  }

  buildings(list, T) {
    const t = this.terrain, { x: ox, z: oz } = this.center, chunks = new Map();
    const clear = this.landmarks.map(L => ({ ...t.toLocal(L.lat, L.lon), r2: (L.clear || 0) ** 2 }));
    this.count = 0;
    for (const rec of list) {
      const { a, n, area } = ring(rec, 3, ox, oz);
      if (n < 3 || area < 4) continue;
      let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += a[i * 2]; cz += a[i * 2 + 1]; } cx /= n; cz /= n;
      if (clear.some(L => (cx - L.x) ** 2 + (cz - L.z) ** 2 < L.r2)) continue;
      const tris = triangulate(a, n, area); if (!tris) continue;
      let lo = Infinity; for (let i = 0; i < n; i++) lo = Math.min(lo, t.heightAt(a[i * 2], a[i * 2 + 1]));
      const h = Math.max(3, rec[0] / 10), minH = rec[1] / 10, top = lo + h, bot = minH > 0 ? lo + minH : lo - 0.6;
      if (top - bot < 1) continue;
      const R = rng(Math.imul(Math.round(cx * 10), 73856093) ^ Math.imul(Math.round(cz * 10), 19349663)), st = style(rec[2], h, R), seed = Math.floor(R() * 997);
      if (minH > 0) st.shop = false;
      const key = Math.floor(cx / CHUNK) * 65536 + Math.floor(cz / CHUNK);
      let B = chunks.get(key); if (!B) chunks.set(key, B = { P: [], N: [], U: [], C: [], A: [], Bv: [], R: [], I: [], v: 0 });
      let col = st.color, part = st.shop ? 1 : 0, run = 0, runId = 0;
      const vert = (x, y, z, nx, ny, nz, u, v) => {
        B.P.push(x, y, z); B.N.push(nx, ny, nz); B.U.push(u, v); B.C.push(col.r, col.g, col.b); B.A.push(part, st.mat, seed, h); B.Bv.push(st.fh, st.bw, st.gw, st.gh); B.R.push(run, runId);
        return B.v++;
      };
      // walls: consecutive edges turning less than TURN share one window grid, so curved fronts keep their windows
      const turn = i => {
        const p = (i + n - 1) % n, q = (i + 1) % n, ax = a[i * 2] - a[p * 2], az = a[i * 2 + 1] - a[p * 2 + 1], bx = a[q * 2] - a[i * 2], bz = a[q * 2 + 1] - a[i * 2 + 1];
        return Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
      };
      let s0 = 0; for (let i = 0; i < n; i++) if (turn(i) > TURN) { s0 = i; break; }
      const runs = []; let cur = null;
      for (let k = 0; k < n; k++) {
        const i = (s0 + k) % n, j = (i + 1) % n, len = Math.hypot(a[j * 2] - a[i * 2], a[j * 2 + 1] - a[i * 2 + 1]);
        if (len < 0.01) continue;
        if (!cur || turn(i) > TURN) runs.push(cur = { len: 0, e: [] });
        cur.e.push(i, j, cur.len, len); cur.len += len;
      }
      runs.forEach((r, ri) => {
        run = r.len; runId = ri + seed * 0.013;
        for (let k = 0; k < r.e.length; k += 4) {
          const i = r.e[k], j = r.e[k + 1], u0 = r.e[k + 2], len = r.e[k + 3], x0 = a[i * 2], z0 = a[i * 2 + 1], x1 = a[j * 2], z1 = a[j * 2 + 1];
          const nx = (z1 - z0) / len, nz = -(x1 - x0) / len;
          const A0 = vert(x0, bot, z0, nx, 0, nz, u0, bot - lo), B0 = vert(x1, bot, z1, nx, 0, nz, u0 + len, bot - lo), B1 = vert(x1, top, z1, nx, 0, nz, u0 + len, h), A1 = vert(x0, top, z0, nx, 0, nz, u0, h);
          B.I.push(A0, B1, B0, A0, A1, B1);
        }
      });
      // flat roof
      col = st.roof; part = 2;
      const r0 = B.v; for (let i = 0; i < n; i++) vert(a[i * 2], top, a[i * 2 + 1], 0, 1, 0, 0, 0);
      for (const i of tris) B.I.push(r0 + i);
      // plant boxes on tall roofs: lift housings and air handlers
      if (h > 25 && area > 250) {
        part = 3; const k = Math.sqrt(area) * 0.3;
        for (let b = 1 + Math.floor(R() * 3); b > 0; b--) {
          const w = lerp(R, 1.5, 4), d = lerp(R, 1.5, 3.5), hh = lerp(R, 1.2, 3), x = cx + (R() - 0.5) * k, z = cz + (R() - 0.5) * k;
          if (![[-w, -d], [w, -d], [w, d], [-w, d]].every(([dx, dz]) => inside(a, x + dx, z + dz))) continue;
          col = new THREE.Color(pick(R, [0x9a9c9e, 0x7f8285, 0xb5b3ad])).multiplyScalar(0.6);
          const y1 = top + hh, faces = [[[-w, -d], [w, -d], 0, -1], [[w, -d], [w, d], 1, 0], [[w, d], [-w, d], 0, 1], [[-w, d], [-w, -d], -1, 0]];
          for (const [[ax, az], [bx2, bz], fx, fz] of faces) {
            const q0 = vert(x + ax, top, z + az, fx, 0, fz, 0, 0), q1 = vert(x + bx2, top, z + bz, fx, 0, fz, 2 * Math.max(w, d), 0), q2 = vert(x + bx2, y1, z + bz, fx, 0, fz, 2 * Math.max(w, d), hh), q3 = vert(x + ax, y1, z + az, fx, 0, fz, 0, hh);
            B.I.push(q0, q2, q1, q0, q3, q2);
          }
          const q0 = vert(x - w, y1, z - d, 0, 1, 0, 0, 0), q1 = vert(x + w, y1, z - d, 0, 1, 0, 0, 0), q2 = vert(x + w, y1, z + d, 0, 1, 0, 0, 0), q3 = vert(x - w, y1, z + d, 0, 1, 0, 0, 0);
          B.I.push(q0, q2, q1, q0, q3, q2);
        }
      }
      const o = bbox(a, { top, mat: st.metal }); this.bGrid.add(o, o.x0, o.z0, o.x1, o.z1);
      this.count++;
    }
    const mean = [T.d0, T.d1, T.d2, T.d3].map(x => x.userData.mean);
    const U = { tD0: T.d0, tD1: T.d1, tD2: T.d2, tD3: T.d3, tN0: T.n0, tN1: T.n1, tN2: T.n2, tN3: T.n3 };
    const uniforms = Object.fromEntries(Object.entries(U).map(([k, v]) => [k, { value: v, type: 'sampler2D' }]));
    uniforms.uMean = { value: new THREE.Vector4(...mean), type: 'vec4' }; uniforms.uNight = Object.assign(this.uNight, { type: 'float' });
    this.bMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }), uniforms,
      'attribute vec4 aA; attribute vec4 aB; attribute vec2 aC; attribute vec2 aU; varying vec4 vA; varying vec4 vB; varying vec2 vC; varying vec2 vU;',
      'vA = aA; vB = aB; vC = aC; vU = aU;', FACADE, 'procella-city-facade');
    for (const B of chunks.values()) {
      const g = geom(B.I, { position: [B.P, 3], normal: [B.N, 3], aU: [B.U, 2], color: [B.C, 3], aA: [B.A, 4], aB: [B.Bv, 4], aC: [B.R, 2] });
      const m = new THREE.Mesh(g, this.bMat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; this.group.add(m);
    }
  }

  roads(list, asph, asphN, pave, paveN) {
    const t = this.terrain, { x: ox, z: oz } = this.center, chunks = new Map();
    const sorted = [...list].sort((p, q) => q[0] - p[0]); // footways first, motorways drawn over them at junctions
    for (const rec of sorted) {
      const cls = Math.min(4, Math.max(0, rec[0])), w = ROAD_W[cls], hw = w / 2, n = (rec.length - 1) >> 1;
      if (n < 2) continue;
      const P = []; for (let i = 0; i < n; i++) P.push(rec[1 + i * 2] / 10 + ox, rec[2 + i * 2] / 10 + oz);
      for (let i = 0; i < n - 1; i++) {
        const s = { x0: P[i * 2], z0: P[i * 2 + 1], dx: P[i * 2 + 2] - P[i * 2], dz: P[i * 2 + 3] - P[i * 2 + 1], hw, cls };
        s.l2 = s.dx * s.dx + s.dz * s.dz || 1;
        const m = hw + 2; this.rGrid.add(s, Math.min(s.x0, s.x0 + s.dx) - m, Math.min(s.z0, s.z0 + s.dz) - m, Math.max(s.x0, s.x0 + s.dx) + m, Math.max(s.z0, s.z0 + s.dz) + m);
      }
      // resample every 4 m so the strip follows the ground
      const S = [], L = []; let along = 0;
      for (let i = 0; i < n - 1; i++) {
        const x0 = P[i * 2], z0 = P[i * 2 + 1], dx = P[i * 2 + 2] - x0, dz = P[i * 2 + 3] - z0, len = Math.hypot(dx, dz), k = Math.max(1, Math.ceil(len / 4));
        for (let j = 0; j < k; j++) { S.push(x0 + dx * j / k, z0 + dz * j / k); L.push(along + len * j / k); }
        along += len;
      }
      S.push(P[n * 2 - 2], P[n * 2 - 1]); L.push(along);
      if (along < 0.5) continue;
      const m = S.length >> 1, key = Math.floor(S[0] / BIG) * 65536 + Math.floor(S[1] / BIG);
      let B = chunks.get(key); if (!B) chunks.set(key, B = { P: [], R: [], I: [], v: 0 });
      const lift = 0.15;
      for (let i = 0; i < m; i++) {
        const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
        let tx = S[b * 2] - S[a * 2], tz = S[b * 2 + 1] - S[a * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        let k = 1; // miter: keep the width through bends, capped
        if (i > 0 && i < m - 1) { const ux = S[i * 2] - S[a * 2], uz = S[i * 2 + 1] - S[a * 2 + 1], ul = Math.hypot(ux, uz) || 1; k = Math.min(2, 1 / Math.max(0.5, (ux * tx + uz * tz) / ul)); }
        const nx = -tz * hw * k, nz = tx * hw * k, x = S[i * 2], z = S[i * 2 + 1];
        B.P.push(x + nx, t.heightAt(x + nx, z + nz) + lift, z + nz, x - nx, t.heightAt(x - nx, z - nz) + lift, z - nz);
        B.R.push(0, L[i], cls, w, w, L[i], cls, w);
        if (i) { const v = B.v + i * 2; B.I.push(v - 2, v, v - 1, v - 1, v, v + 1); } // left of travel is +z for eastward roads: this order faces up
      }
      B.v += m * 2;
    }
    const uniforms = { tA: { value: asph, type: 'sampler2D' }, tAN: { value: asphN, type: 'sampler2D' }, tP: { value: pave, type: 'sampler2D' }, tPN: { value: paveN, type: 'sampler2D' },
      uMean: { value: new THREE.Vector2(asph.userData.mean, pave.userData.mean), type: 'vec2' } };
    this.rMat = patch(new THREE.MeshStandardMaterial({ roughness: 0.85, ...blend, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), uniforms,
      'attribute vec4 aR; varying vec4 vR;', 'vR = aR;', ROAD, 'procella-city-road');
    for (const B of chunks.values()) {
      const g = geom(B.I, { position: [B.P, 3], normal: [new Float32Array(B.P.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3], aR: [B.R, 4] });
      const m = new THREE.Mesh(g, this.rMat); m.receiveShadow = true; m.renderOrder = 2; m.matrixAutoUpdate = false; this.group.add(m);
    }
  }

  // Water lies flat at its banks' typical height; parks follow the ground as a lawn overlay.
  areas(wList, pList, wn, grass) {
    const t = this.terrain, { x: ox, z: oz } = this.center;
    const W = { P: [], U: [], I: [] }, chunks = new Map();
    for (const rec of wList) {
      const { a, n, area } = ring(rec, 0, ox, oz); if (n < 3) continue;
      const tris = triangulate(a, n, area); if (!tris) continue;
      const hs = []; for (let i = 0; i < n; i++) hs.push(t.heightAt(a[i * 2], a[i * 2 + 1]));
      hs.sort((p, q) => p - q); const y = hs[n >> 1] + 0.2, v0 = W.P.length / 3;
      for (let i = 0; i < n; i++) { W.P.push(a[i * 2], y, a[i * 2 + 1]); W.U.push(a[i * 2] / 60, -a[i * 2 + 1] / 60); }
      for (const i of tris) W.I.push(v0 + i);
      const o = bbox(a); this.wGrid.add(o, o.x0, o.z0, o.x1, o.z1);
    }
    for (const rec of pList) {
      const { a, n, area } = ring(rec, 0, ox, oz); if (n < 3) continue;
      const tris = triangulate(a, n, area); if (!tris) continue;
      const o = bbox(a); this.pGrid.add(o, o.x0, o.z0, o.x1, o.z1); this.parks.push(Array.from(a));
      const key = Math.floor(o.x0 / BIG) * 65536 + Math.floor(o.z0 / BIG);
      let B = chunks.get(key); if (!B) chunks.set(key, B = { P: [], U: [] });
      const tri = [];
      for (let i = 0; i < tris.length; i += 3) { const [p, q, r] = [tris[i], tris[i + 1], tris[i + 2]]; drape(tri, a[p * 2], a[p * 2 + 1], a[q * 2], a[q * 2 + 1], a[r * 2], a[r * 2 + 1], 12); }
      for (let i = 0; i < tri.length; i += 2) { B.P.push(tri[i], t.heightAt(tri[i], tri[i + 1]) + 0.08, tri[i + 1]); B.U.push(tri[i] / 5, -tri[i + 1] / 5); }
    }
    if (W.I.length) {
      wn.repeat.set(1, 1);
      const m = new THREE.Mesh(geom(W.I, { position: [W.P, 3], normal: [W.P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3], uv: [W.U, 2] }),
        new THREE.MeshStandardMaterial({ color: 0x0f3a52, roughness: 0.06, normalMap: wn, normalScale: new THREE.Vector2(0.5, 0.5), ...blend, opacity: 0.94, transparent: false, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      m.material.blending = THREE.CustomBlending; m.receiveShadow = true; m.renderOrder = 1; this.water = m; this.group.add(m);
    }
    for (const B of chunks.values()) {
      const m = new THREE.Mesh(geom(null, { position: [B.P, 3], normal: [B.P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3], uv: [B.U, 2] }),
        new THREE.MeshStandardMaterial({ map: grass, color: 0x86a860, roughness: 0.95, ...blend, opacity: 0.55, transparent: false, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }));
      m.receiveShadow = true; m.renderOrder = 1.5; this.group.add(m);
    }
  }

  // Street lights on the bigger roads: instanced poles with emissive heads and a soft pool on the ground at night.
  lights(list) {
    const t = this.terrain, { x: ox, z: oz } = this.center, spots = [], taken = new Set();
    for (const rec of list) {
      const cls = rec[0]; if (cls > 2) continue;
      const hw = ROAD_W[cls] / 2, n = (rec.length - 1) >> 1; let next = 10, along = 0, side = 1;
      for (let i = 0; i < n - 1; i++) {
        const x0 = rec[1 + i * 2] / 10 + ox, z0 = rec[2 + i * 2] / 10 + oz, dx = rec[3 + i * 2] / 10 + ox - x0, dz = rec[4 + i * 2] / 10 + oz - z0, len = Math.hypot(dx, dz);
        while (next < along + len) {
          const k = (next - along) / len, tx = dx / len, tz = dz / len;
          for (const sd of cls < 2 ? [1, -1] : [side]) {
            const x = x0 + dx * k - tz * (hw + 0.7) * sd, z = z0 + dz * k + tx * (hw + 0.7) * sd, cell = Math.round(x / 12) * 65536 + Math.round(z / 12);
            if (taken.has(cell) || this.hitBuilding(x, z, 0.6) || this.inWater(x, z)) continue;
            taken.add(cell); spots.push(x, t.heightAt(x, z), z, Math.atan2(tz * sd, -tx * sd));
          }
          side = -side; next += 32;
        }
        along += len;
      }
    }
    const N = spots.length / 4; if (!N) return;
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.7 });
    const pole = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.11, 8, 6).translate(0, 4, 0), new THREE.BoxGeometry(0.07, 0.07, 1.5).translate(0, 7.95, 0.72)]);
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.4, emissive: 0xffc98a, emissiveIntensity: 0 });
    const pc = document.createElement('canvas'); pc.width = pc.height = 64; const g = pc.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.poolMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), color: 0xffb870, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const meshes = [new THREE.InstancedMesh(pole, steel, N), new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.12, 0.55).translate(0, 7.88, 1.4), this.headMat, N),
      new THREE.InstancedMesh(new THREE.CircleGeometry(7, 20).rotateX(-Math.PI / 2).translate(0, 0.3, 1.4), this.poolMat, N)];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < N; i++) { m4.compose(new THREE.Vector3(spots[i * 4], spots[i * 4 + 1], spots[i * 4 + 2]), q.setFromAxisAngle(up, spots[i * 4 + 3]), one); for (const m of meshes) m.setMatrixAt(i, m4); }
    meshes[0].castShadow = true; meshes[2].visible = false; this.pools = meshes[2];
    for (const m of meshes) { m.computeBoundingSphere(); this.group.add(m); }
    this.lampCount = N;
  }

  hitBuilding(x, z, m = 0) {
    return this.bGrid.some(x, z, m, b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m && (inside(b.a, x, z) || (m > 0 && (edge(b.a, x, z), E.d2 < m * m))));
  }
  onRoad(x, z, m = 0) { return this.rGrid.some(x, z, 0, s => segD2(s, x, z) < (s.hw + m) ** 2); }
  inWater(x, z) { return this.wGrid.some(x, z, 0, o => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && inside(o.a, x, z)); }
  inPark(x, z) { return this.pGrid.some(x, z, 0, o => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && inside(o.a, x, z)); }

  // Push a circle of radius r at (x, z) out of the building it overlaps most. y above the roof: no hit.
  collide(x, z, r, y = -Infinity) {
    let best = null;
    this.bGrid.some(x, z, r, b => {
      if (y > b.top || x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1) return false;
      const inn = inside(b.a, x, z); edge(b.a, x, z); const d = Math.sqrt(E.d2);
      if (!inn && d >= r) return false;
      const depth = inn ? d + r : r - d;
      if (best && depth <= best.depth) return false;
      let nx = E.nx, nz = E.nz;
      if (d > 1e-6) { nx = (x - E.x) / d; nz = (z - E.z) / d; if (inn) { nx = -nx; nz = -nz; } }
      best = { nx, nz, depth, material: b.mat };
      return false;
    });
    return best;
  }
  blocked(x, z) { return this.hitBuilding(x, z, 1) || this.onRoad(x, z, 1.5) || this.inWater(x, z); }
  surfaceAt(x, z) { return this.onRoad(x, z) ? 'road' : this.inWater(x, z) ? 'water' : null; }

  setNight(n) {
    this.uNight.value = n;
    if (this.headMat) { this.headMat.emissiveIntensity = n * 2.5; this.poolMat.opacity = n * 0.14; this.pools.visible = n > 0.05; }
  }
  update(dt) { const n = this.water?.material.normalMap; if (n) { n.offset.x += dt * 0.01; n.offset.y += dt * 0.006; } }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
}
