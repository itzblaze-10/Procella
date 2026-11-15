// Vegetation of the place: which trees grow follows the NASA climate record (temperature and rainfall),
// where they grow follows the Sentinel-2 imagery (how green the ground is). Trees: EZ-Tree (MIT, procedural).
// Near the traveller: full 3D trees, grass and rocks. Far away: baked billboards of the same trees.
import * as THREE from 'three';
import { Tree } from 'ez-tree';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const NEAR = 200;          // full trees inside this radius, billboards outside
const CAP = 60;           // full trees per variant (each is about 20k triangles)
const TREE_GRID = 11;      // metres between candidate tree spots near the player
const FAR_GRID = 46;       // metres between candidate billboard spots
const GRASS_R = 42, GRASS_GRID = 0.85, ROCK_R = 400, ROCK_GRID = 22;
const hash = (x, z, s = 0) => { const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };

// Biome from the place's own 45-year means: annual temperature (°C) and rainfall (mm/day).
export function biomeFor(tMean, rain) {
  if (tMean < -6) return { name: 'ice', trees: [], density: 0, grass: 0 };
  if (tMean < 1) return { name: 'tundra', trees: [['Pine Small', 6, 0x3b5a3a], ['Bush 2', 1.2, 0x6a7a4a]], density: 0.25, grass: 0.5, dry: 0.3 };
  if (tMean < 7) return { name: 'boreal', trees: [['Pine Large', 20, 0x2f4f33], ['Pine Medium', 15, 0x355a38], ['Aspen Medium', 14, 0x7a9a4a]], density: 1, grass: 0.7 };
  if (tMean < 18) return rain < 1 ? { name: 'steppe', trees: [['Bush 1', 1.8, 0x7d8a52], ['Ash Small', 7, 0x7b8f4f]], density: 0.3, grass: 0.8, dry: 0.6 }
    : { name: 'temperate', trees: [['Oak Large', 15, 0x4d7a35], ['Ash Medium', 13, 0x5a8a3c], ['Aspen Medium', 12, 0x7d9d45], ['Pine Medium', 15, 0x355a38]], density: 1, grass: 1 };
  if (rain < 0.7) return { name: 'desert', trees: [['Bush 3', 1.5, 0x8a8a5a], ['Bush 1', 1.2, 0x9a9460]], density: 0.12, grass: 0.15, dry: 1 };
  if (rain < 2.6) return { name: 'savanna', trees: [['Ash Medium', 9, 0x6f8a3a], ['Bush 2', 2.2, 0x7a8a45], ['Oak Small', 8, 0x6a8540]], density: 0.4, grass: 1, dry: 0.7 };
  return { name: 'tropical', trees: [['Oak Large', 17, 0x2e6a2a], ['Ash Large', 15, 0x336f2c], ['Bush 1', 2.5, 0x3a7a30]], density: 1.4, grass: 1 };
}

const waitTextures = async mats => {
  for (let i = 0; i < 60 && !mats.every(m => !m.map || (m.map.image && (m.map.image.complete ?? true) && m.map.image.width)); i++) await new Promise(r => setTimeout(r, 50));
};

export class Vegetation {
  constructor(scene, renderer, terrain, biome) {
    this.scene = scene; this.renderer = renderer; this.t = terrain; this.biome = biome;
    this.group = new THREE.Group(); scene.add(this.group);
    this.near = []; this.time = 0; this.center = new THREE.Vector3(1e9, 0, 1e9); this.far = new Map();
    this.on = true; this.cap = CAP; this.grassDensity = 1; this.wind = { value: 2 }; this.timeU = { value: 0 }; this.centerU = { value: new THREE.Vector3() };
  }

  async init() {
    this.variants = [];
    for (const [i, [preset, height, tint]] of this.biome.trees.entries()) {
      const tree = new Tree(); tree.loadPreset(preset); tree.options.seed = 1000 + i * 77; tree.options.leaves.tint = tint;
      tree.options.leaves.count = Math.min(tree.options.leaves.count, 12); tree.generate();
      const box = new THREE.Box3().setFromObject(tree), s = height / Math.max(0.01, box.max.y - box.min.y);
      const parts = [tree.branchesMesh, tree.leavesMesh].map(m => { const g = m.geometry.clone(); g.scale(s, s, s); g.translate(0, -box.min.y * s, 0); return { geo: g, mat: m.material }; });
      // own leaf material: EZ-Tree's wind shader ignores instancing, so leaves would not follow each tree
      const src = tree.leavesMesh.material;
      parts[1].mat = new THREE.MeshStandardMaterial({ map: src.map, color: src.color, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
      parts[1].mat.onBeforeCompile = sh => {
        sh.uniforms.uWind = this.wind; sh.uniforms.uTime = this.timeU;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind, uTime;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
            vec2 ip = instanceMatrix[3].xz;
            #else
            vec2 ip = vec2(0.0);
            #endif
            float sw = sin(uTime * 1.7 + ip.x * 0.2 + position.y * 0.3) * (0.02 + uWind * 0.012) * position.y * 0.15;
            transformed.x += sw; transformed.z += sw * 0.6;`);
      };
      this.variants.push({ tree, parts, height, scale: s, trunkR: preset.startsWith('Bush') ? 0 : Math.max(0.25, height * 0.025) });
    }
    await waitTextures(this.variants.flatMap(v => v.parts.map(p => p.mat)));
    // near pool: one instanced mesh per variant part
    this.pools = this.variants.map(v => v.parts.map(p => { const m = new THREE.InstancedMesh(p.geo, p.mat, this.cap); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); return m; }));
    this.bakeImpostors();
    this.initGrass(); await this.initRocks();
  }

  // Render each tree once from the side into a texture; far trees are two crossed quads showing that picture.
  bakeImpostors() {
    const W = 256, H = 512, cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500), sc = new THREE.Scene();
    sc.add(new THREE.AmbientLight(0xffffff, 1.6), new THREE.DirectionalLight(0xffffff, 1.4).translateX(5).translateY(10).translateZ(8));
    this.imp = this.variants.map(v => {
      const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group(); v.parts.forEach(p => g.add(new THREE.Mesh(p.geo, p.mat))); sc.add(g);
      const box = new THREE.Box3().setFromObject(g), w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 * 1.05, h = v.height;
      const half = Math.max(w, h / 2 * (W / H));
      cam.left = -half; cam.right = half; cam.top = half * H / W; cam.bottom = -half * H / W; cam.position.set(0, half * H / W, 100); cam.lookAt(0, half * H / W, 0); cam.updateProjectionMatrix();
      const r = this.renderer, prev = r.getRenderTarget(), pc = r.getClearColor(new THREE.Color()), pa = r.getClearAlpha();
      r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(sc, cam); r.setRenderTarget(prev); r.setClearColor(pc, pa);
      sc.remove(g);
      const qw = half * 2, qh = half * 2 * H / W, a = new THREE.PlaneGeometry(qw, qh), b = a.clone().rotateY(Math.PI / 2);
      const geo = mergeTwo(a, b); geo.translate(0, qh / 2, 0);
      const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // lit like the canopy top, not the quad
      const mat = new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
      mat.onBeforeCompile = sh => { // hand over to full trees near the camera
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWp;\nuniform vec3 uCenter;`).replace('void main() {', `void main() {\n if (distance(vWp.xz, uCenter.xz) < ${NEAR.toFixed(1)}) discard;`);
        sh.uniforms.uCenter = this.centerU;
      };
      mat.customProgramCacheKey = () => 'procella-impostor';
      return { geo, mat, rt };
    });
  }

  // Billboards for one terrain tile, from a coarse grid weighted by imagery greenness.
  addTile(key, tile) {
    if (!this.imp || !this.variants.length) return;
    this.dropTile(key); this.center.set(1e9, 0, 1e9); // new imagery: re-plant this tile and the near field
    const t = this.t, box = new THREE.Box3().setFromBufferAttribute(tile.mesh.geometry.attributes.position), spots = this.variants.map(() => []);
    for (let x = Math.ceil(box.min.x / FAR_GRID) * FAR_GRID; x < box.max.x; x += FAR_GRID) for (let z = Math.ceil(box.min.z / FAR_GRID) * FAR_GRID; z < box.max.z; z += FAR_GRID) {
      const px = x + (hash(x, z, 1) - 0.5) * FAR_GRID, pz = z + (hash(x, z, 2) - 0.5) * FAR_GRID, y = t.heightAt(px, pz);
      if (y < 1 || t.slopeAt(px, pz, 8) > 0.7) continue;
      if (hash(x, z, 3) > t.greenAt(px, pz) ** 1.4 * this.biome.density * 0.5) continue;
      spots[Math.floor(hash(x, z, 4) * this.variants.length)].push([px, y, pz, 0.75 + hash(x, z, 5) * 0.5, hash(x, z, 6) * 6.28]);
    }
    const meshes = spots.map((list, i) => {
      if (!list.length) return null;
      const m = new THREE.InstancedMesh(this.imp[i].geo, this.imp[i].mat, list.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      list.forEach(([x, y, z, k, r], j) => { q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r); m.setMatrixAt(j, M.compose(p.set(x, y - 0.3, z), q, s.setScalar(k))); });
      m.computeBoundingSphere(); this.group.add(m); return m;
    }).filter(Boolean);
    this.far.set(key, meshes);
  }
  dropTile(key) { for (const m of this.far.get(key) || []) { this.group.remove(m); m.dispose(); } this.far.delete(key); }

  // Grass: thin curved blades in tufts, tinted by the satellite colour, swaying with the measured wind.
  initGrass() {
    const blades = 7, pos = [], col = [];
    for (let b = 0; b < blades; b++) {
      const a = b / blades * Math.PI * 2 + b, r = 0.1 * (b % 3), x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.22 + (b * 37 % 10) / 32, w = 0.035, lean = 0.12 + (b % 4) * 0.05;
      const dx = Math.cos(a + 1.3) * w, dz = Math.sin(a + 1.3) * w, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean;
      const v = [[x - dx, 0, z - dz], [x + dx, 0, z + dz], [x - dx * 0.6 + tx * 0.4, h * 0.55, z - dz * 0.6 + tz * 0.4], [x + dx * 0.6 + tx * 0.4, h * 0.55, z + dz * 0.6 + tz * 0.4], [x + tx, h, z + tz]];
      for (const tri of [[0, 1, 2], [1, 3, 2], [2, 3, 4]]) for (const i of tri) { pos.push(...v[i]); const k = v[i][1] / h; col.push(0.35 + 0.65 * k, 0.4 + 0.6 * k, 0.3 + 0.5 * k); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uWind = this.wind; sh.uniforms.uTime = this.timeU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind, uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec2 ip = instanceMatrix[3].xz; float k = position.y * position.y;
          float sway = sin(uTime * (1.2 + uWind * 0.15) + ip.x * 0.35 + ip.y * 0.27) * (0.04 + uWind * 0.018) + uWind * 0.012;
          transformed.x += sway * k * 2.5; transformed.z += sway * k * 0.8;`);
    };
    const N = Math.ceil(Math.PI * (GRASS_R / GRASS_GRID) ** 2 * 1.05);
    this.grass = new THREE.InstancedMesh(g, mat, N); this.grass.count = 0; this.grass.frustumCulled = false; this.grass.receiveShadow = true;
    this.grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.group.add(this.grass);
  }

  async initRocks() {
    const L = new GLTFLoader(), geos = [];
    for (const n of ['rock1', 'rock2', 'rock3']) {
      try { const g = await L.loadAsync(new URL(`../../assets/models/${n}.glb`, import.meta.url).href); g.scene.traverse(o => { if (o.isMesh && !geos.find(x => x.n === n)) geos.push({ n, geo: o.geometry, mat: o.material }); }); } catch { /* rocks are optional */ }
    }
    this.rocks = geos.map(({ geo, mat }) => {
      geo.computeBoundingBox(); const s = 1 / Math.max(0.01, geo.boundingBox.max.x - geo.boundingBox.min.x);
      const m = new THREE.InstancedMesh(geo, mat, 120); m.count = 0; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.userData.unit = s; this.group.add(m); return m;
    });
  }

  // Rebuild what surrounds the traveller whenever they have moved far enough.
  refresh(c) {
    const t = this.t, M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    this.near = [];
    // trees
    if (this.pools) {
      const counts = this.variants.map(() => 0);
      const gx = Math.round(c.x / TREE_GRID), gz = Math.round(c.z / TREE_GRID), R = Math.ceil(NEAR / TREE_GRID);
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
        const x = (gx + i) * TREE_GRID, z = (gz + j) * TREE_GRID, px = x + (hash(x, z, 11) - 0.5) * TREE_GRID, pz = z + (hash(x, z, 12) - 0.5) * TREE_GRID;
        if ((px - c.x) ** 2 + (pz - c.z) ** 2 > NEAR * NEAR) continue;
        const y = t.heightAt(px, pz); if (y < 1 || t.slopeAt(px, pz, 6) > 0.7 || this.blocked?.(px, pz)) continue;
        if (hash(x, z, 13) > t.greenAt(px, pz) ** 1.4 * this.biome.density * 0.55) continue;
        const v = Math.floor(hash(x, z, 14) * this.variants.length); if (counts[v] >= this.cap) continue;
        const k = 0.75 + hash(x, z, 15) * 0.5;
        M.compose(p.set(px, y - 0.2, pz), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash(x, z, 16) * 6.28), s.setScalar(k));
        this.pools[v].forEach(m => m.setMatrixAt(counts[v], M)); counts[v]++;
        if (this.variants[v].trunkR) this.near.push({ x: px, z: pz, r: this.variants[v].trunkR * k });
      }
      this.pools.forEach((parts, v) => parts.forEach(m => { m.count = counts[v]; m.instanceMatrix.needsUpdate = true; }));
    }
    // grass
    if (this.grass) {
      let n = 0; const R = Math.ceil(GRASS_R / GRASS_GRID), gx = Math.round(c.x / GRASS_GRID), gz = Math.round(c.z / GRASS_GRID), dry = this.biome.dry || 0;
      if (this.on && this.biome.grass > 0 && !(t.snow > 0.5)) for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
        const x = (gx + i) * GRASS_GRID, z = (gz + j) * GRASS_GRID, px = x + (hash(x, z, 21) - 0.5) * GRASS_GRID, pz = z + (hash(x, z, 22) - 0.5) * GRASS_GRID;
        const d2 = (px - c.x) ** 2 + (pz - c.z) ** 2; if (d2 > GRASS_R * GRASS_R) continue;
        const sat = t.satAt(px, pz); if (!sat) continue;
        const green = t.greenAt(px, pz), keep = (0.25 + green) * this.biome.grass * (1 - d2 / (GRASS_R * GRASS_R) * 0.5);
        if (hash(x, z, 23) > keep * this.grassDensity) continue;
        const y = t.heightAt(px, pz); if (y < 0.8 || this.blocked?.(px, pz)) continue;
        const k = (0.6 + hash(x, z, 24) * 0.5) * (0.7 + green * 0.5);
        this.grass.setMatrixAt(n, M.compose(p.set(px, y - 0.03, pz), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash(x, z, 25) * 6.28), s.set(k, k * (0.8 + green * 0.6), k)));
        col.setRGB(sat[0] / 255, sat[1] / 255, sat[2] / 255, THREE.SRGBColorSpace).lerp(new THREE.Color(0.18, 0.3, 0.06), 0.45 - dry * 0.3).lerp(new THREE.Color(0.55, 0.48, 0.22), dry * 0.35);
        this.grass.setColorAt(n++, col);
        if (n >= this.grass.instanceMatrix.count) break;
      }
      this.grass.count = n; this.grass.instanceMatrix.needsUpdate = true; this.grass.instanceColor.needsUpdate = true;
    }
    // rocks on steep or bare ground
    if (this.rocks?.length) {
      const counts = this.rocks.map(() => 0), R = Math.ceil(ROCK_R / ROCK_GRID), gx = Math.round(c.x / ROCK_GRID), gz = Math.round(c.z / ROCK_GRID);
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
        const x = (gx + i) * ROCK_GRID, z = (gz + j) * ROCK_GRID, px = x + (hash(x, z, 31) - 0.5) * ROCK_GRID, pz = z + (hash(x, z, 32) - 0.5) * ROCK_GRID;
        if ((px - c.x) ** 2 + (pz - c.z) ** 2 > ROCK_R * ROCK_R) continue;
        const y = t.heightAt(px, pz); if (y < 0.5 || this.blocked?.(px, pz)) continue;
        const slope = t.slopeAt(px, pz, 6), bare = 1 - t.greenAt(px, pz), chance = 0.02 + slope * 0.6 * bare + (this.biome.dry || 0) * 0.04;
        if (hash(x, z, 33) > chance) continue;
        const v = Math.floor(hash(x, z, 34) * this.rocks.length), m = this.rocks[v]; if (counts[v] >= 120) continue;
        const size = 0.5 + hash(x, z, 35) ** 3 * 4, k = m.userData.unit * size;
        m.setMatrixAt(counts[v]++, M.compose(p.set(px, y - size * 0.15, pz), q.setFromEuler(new THREE.Euler(hash(x, z, 36), hash(x, z, 37) * 6.28, 0)), s.setScalar(k)));
        if (size > 1.2) this.near.push({ x: px, z: pz, r: size * 0.45, material: 'stone' });
      }
      this.rocks.forEach((m, v) => { m.count = counts[v]; m.instanceMatrix.needsUpdate = true; });
    }
  }

  update(dt, focus, wind) {
    this.time += dt; this.timeU.value = this.time; this.wind.value = wind;
    this.centerU.value.copy(this.center);
    if ((focus.x - this.center.x) ** 2 + (focus.z - this.center.z) ** 2 > 18 * 18) { this.center.set(focus.x, 0, focus.z); this.refresh(this.center); }
  }

  // Tree trunks and big rocks the traveller and vehicles bump into.
  collide(x, z, r) {
    for (const o of this.near) {
      const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), min = r + o.r;
      if (d < min && d > 1e-6) return { nx: dx / d, nz: dz / d, depth: min - d, material: o.material || 'tree' };
    }
    return null;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    this.imp?.forEach(i => { i.rt.dispose(); i.geo.dispose(); i.mat.dispose(); });
    this.variants?.forEach(v => v.parts.forEach(p => p.geo.dispose()));
    this.grass?.geometry.dispose(); this.grass?.material.dispose();
  }
}

function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const A = a.attributes[k], B = b.attributes[k];
    g.setAttribute(k, new THREE.Float32BufferAttribute([...A.array, ...B.array], A.itemSize));
  }
  const off = a.attributes.position.count;
  g.setIndex([...a.index.array, ...b.index.array.map(i => i + off)]);
  return g;
}
