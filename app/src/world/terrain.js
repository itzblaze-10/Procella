// Real-world terrain around a lat/lon, streamed as the player moves.
// Elevation: AWS Terrain Tiles (terrarium PNG, SRTM/GMTED-derived, open, CORS).
// Ground colour: Sentinel-2 cloudless 2020 mosaic by EOX (10 m, real imagery), with NASA GIBS Blue Marble as fallback.
// Close-up grain: CC0 ground textures (Poly Haven) blended by what the satellite pixel shows. No generated or AI terrain.
import * as THREE from 'three';

const Z = 12;                     // elevation zoom: about 38 m per pixel at the equator
const IMG_Z = 8;                  // GIBS Blue Marble max level (fallback colour)
const SEG = 128;                  // mesh segments per tile edge
const RADIUS = 2;                 // tiles kept around the player (5 x 5)
const GRID = 128;                 // CPU copy of the imagery per tile, for surfaces and vegetation
const ELEV = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const SAT = (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${z}/${y}/${x}.jpg`;
const BLUE_MARBLE = (month, z, x, y) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-${String(month).padStart(2, '0')}-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;

const lon2tx = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const tx2lon = (x, z) => x / 2 ** z * 360 - 180;
const ty2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };

function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('tile ' + url)); im.src = url; });
}
// EOX throttles bursts: at most 6 imagery requests in flight, nearest tiles first, three tries each.
const queue = []; let active = 0;
function pump() {
  while (active < 6 && queue.length) {
    queue.sort((a, b) => a.pri - b.pri); const job = queue.shift(); active++;
    loadImage(job.url).then(job.res, err => { if (job.tries++ < 2) setTimeout(() => queue.push(job) && pump(), 900 * job.tries); else job.rej(err); })
      .finally(() => { active--; pump(); });
  }
}
const queued = (url, pri) => new Promise((res, rej) => { queue.push({ url, pri, res, rej, tries: 0 }); pump(); });

function pixels(img, w = img.width, h = img.height) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

// ---------- ground detail textures (CC0, Poly Haven), loaded once ----------
const TEX = { grass: 'aerial_grass_rock', dirt: 'dry_ground_01', rock: 'aerial_rocks_02', sand: 'coast_sand_01', snow: 'snow_02', mud: 'brown_mud_02', forest: 'forest_ground_04' };
let DETAIL = null;
export async function loadGroundTextures() {
  if (DETAIL) return DETAIL;
  const L = new THREE.TextureLoader(), out = {};
  await Promise.all(Object.entries(TEX).flatMap(([k, n]) => ['diff', 'nor_gl'].map(async s => {
    const t = await L.loadAsync(new URL(`../../assets/tex/${n}_${s}.jpg`, import.meta.url).href);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (s === 'diff') {
      t.colorSpace = THREE.SRGBColorSpace;
      const d = pixels(t.image, 16, 16), m = [0, 1, 2].map(k => { let v = 0; for (let i = k; i < d.length; i += 4) v += new THREE.Color().setRGB(d[i] / 255, 0, 0, THREE.SRGBColorSpace).r; return v / 256; }), c = new THREE.Color(...m);
      out[k + 'Mean'] = new THREE.Vector3(c.r, c.g, c.b); // the texture's average, so it modulates the satellite colour without shifting it
    }
    out[k + (s === 'diff' ? '' : 'N')] = t;
  })));
  return (DETAIL = out);
}

// Satellite colour carries the place; the textures add grain chosen by what the pixel looks like.
function groundMaterial(map, uniforms) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.97, metalness: 0, vertexColors: !map });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = position; vN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; varying vec3 vN;
      uniform sampler2D tGrass, tDirt, tRock, tSand, tSnow, tMud, tForest, tRockN, tDirtN, tGrassN;
      uniform vec3 mGrass, mDirt, mRock, mSand, mSnow, mMud, mForest;
      uniform float uSnow, uWet, uDetail, uRain;
      float wRock, wGreen;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        // satellite mosaics are contrast-stretched for display: bring them back to real ground albedo (about 0.1 to 0.35)
        vec3 sat = diffuseColor.rgb;
        float slope = 1.0 - normalize(vN).y;
        vec2 uv = vW.xz / 4.0, uv2 = vW.xz / 37.0;
        float lum = dot(sat, vec3(0.299, 0.587, 0.114));
        wGreen = clamp((sat.g - max(sat.r, sat.b * 1.1)) * 30.0 + 0.35, 0.0, 1.0);
        float dark = 1.0 - smoothstep(0.02, 0.06, lum);              // dense canopy reads very dark from orbit
        float sandy = clamp((sat.r - sat.b) * 5.0 - 0.15, 0.0, 1.0) * smoothstep(0.12, 0.3, lum) * (1.0 - wGreen);
        float shore = 1.0 - smoothstep(0.4, 2.5, vW.y);
        wRock = smoothstep(0.32, 0.6, slope);
        vec3 det = texture2D(tDirt, uv).rgb / mDirt;
        det = mix(det, texture2D(tGrass, uv).rgb / mGrass, wGreen);
        det = mix(det, texture2D(tForest, uv).rgb / mForest, dark * wGreen);
        det = mix(det, texture2D(tSand, uv).rgb / mSand, max(sandy * 0.7, shore));
        det = mix(det, texture2D(tMud, uv * 0.7).rgb / mMud, uWet * (1.0 - sandy) * (1.0 - wGreen * 0.6) * 0.8);
        det = mix(det, texture2D(tRock, uv * 0.5).rgb / mRock, wRock);
        det *= 0.82 + 0.36 * (texture2D(tDirt, uv2).r / mDirt.r - 0.5) + 0.18;  // breaks up tiling
        float k = uDetail * (1.0 - smoothstep(250.0, 2200.0, length(vW - cameraPosition)));
        vec3 col = (max(mix(vec3(lum), sat, 1.3), 0.0) * 0.42 + vec3(0.03, 0.032, 0.022)) * mix(vec3(1.0), clamp(det, 0.0, 2.5), k);
        col *= 1.0 - 0.28 * uWet * (1.0 - sandy);                    // wet ground is darker
        float sn = clamp(uSnow * (1.0 - wRock * 0.6) + smoothstep(4300.0, 5200.0, vW.y), 0.0, 1.0);
        col = mix(col, texture2D(tSnow, uv).rgb * 0.92, sn);
        diffuseColor.rgb = col;
      }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n      roughnessFactor *= 1.0 - uRain * 0.4 * (1.0 - wGreen * 0.6); // rain-slick ground picks up sky reflections')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec2 uv = vW.xz / 4.0;
        vec3 nd = mix(texture2D(tDirtN, uv).xyz, texture2D(tGrassN, uv).xyz, wGreen);
        nd = mix(nd, texture2D(tRockN, uv * 0.5).xyz, wRock) * 2.0 - 1.0;
        float k = uDetail * (1.0 - smoothstep(60.0, 600.0, length(vW - cameraPosition)));
        normal = normalize(normal + (viewMatrix * vec4(nd.x, 0.0, -nd.y, 0.0)).xyz * 0.9 * k); // terrain is near-horizontal: world x/z stand in for the tangent frame
      }`);
  };
  m.customProgramCacheKey = () => 'procella-ground';
  return m;
}

export class Terrain {
  constructor(scene, lat, lon, month = 6) {
    this.scene = scene; this.lat0 = lat; this.lon0 = lon; this.month = month;
    this.mLat = 111320; this.mLon = 111320 * Math.cos(lat * Math.PI / 180);
    this.tiles = new Map(); this.images = new Map();
    this.group = new THREE.Group(); scene.add(this.group);
    const D = DETAIL;
    this.uniforms = {
      uSnow: { value: 0 }, uWet: { value: 0.3 }, uRain: { value: 0 }, uDetail: { value: D ? 1 : 0 },
      ...Object.fromEntries(Object.keys(TEX).flatMap(k => {
        const K = k[0].toUpperCase() + k.slice(1);
        return [['t' + K, { value: D?.[k] }], ['m' + K, { value: D?.[k + 'Mean'] || new THREE.Vector3(1, 1, 1) }], ['t' + K + 'N', { value: D?.[k + 'N'] }]];
      })),
    };
    // water: animated normal map over a sky-reflecting surface
    const wn = new THREE.TextureLoader().load(new URL('../../assets/tex/waternormals.jpg', import.meta.url).href);
    wn.wrapS = wn.wrapT = THREE.RepeatWrapping; wn.repeat.set(900, 900);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshStandardMaterial({ color: 0x0f3a52, roughness: 0.06, metalness: 0.0, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.9 }));
    this.water.rotation.x = -Math.PI / 2; this.water.receiveShadow = true; scene.add(this.water);
  }

  toLocal(lat, lon) { return { x: (lon - this.lon0) * this.mLon, z: -(lat - this.lat0) * this.mLat }; }
  toLatLon(x, z) { return { lat: this.lat0 - z / this.mLat, lon: this.lon0 + x / this.mLon }; }
  tileAt(x, z) { const { lat, lon } = this.toLatLon(x, z), fx = lon2tx(lon, Z), fy = lat2ty(lat, Z), tx = Math.floor(fx), ty = Math.floor(fy); return { t: this.tiles.get(`${tx}/${ty}`), u: fx - tx, v: fy - ty }; }

  // Height of the rendered surface itself (same triangles as the mesh), so wheels and feet sit on what you see.
  heightAt(x, z) {
    const { t, u: fu, v: fv } = this.tileAt(x, z);
    if (!t || !t.grid) return this.lastH ?? 0;
    const gx = fu * SEG, gy = fv * SEG, i = Math.min(SEG - 1, gx | 0), j = Math.min(SEG - 1, gy | 0), u = gx - i, v = gy - j, W = SEG + 1, g = t.grid;
    const ha = g[j * W + i], hb = g[(j + 1) * W + i], hc = g[(j + 1) * W + i + 1], hd = g[j * W + i + 1];
    return (this.lastH = u + v <= 1 ? ha + (hd - ha) * u + (hb - ha) * v : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v));
  }
  isWater(x, z) { return this.heightAt(x, z) < 0.5; }
  slopeAt(x, z, d = 20) { return Math.hypot(this.heightAt(x + d, z) - this.heightAt(x - d, z), this.heightAt(x, z + d) - this.heightAt(x, z - d)) / (2 * d); }

  // Satellite colour (0..255) under a point, or null before the imagery is in.
  satAt(x, z) {
    const { t, u, v } = this.tileAt(x, z);
    if (!t?.sat) return null;
    const q = (Math.min(GRID - 1, v * GRID | 0) * GRID + Math.min(GRID - 1, u * GRID | 0)) * 4;
    return [t.sat[q], t.sat[q + 1], t.sat[q + 2]];
  }
  // What you are standing or driving on, read from height, slope, the satellite pixel and the month's NASA values.
  surfaceAt(x, z) {
    const h = this.heightAt(x, z);
    if (h < 0.3) return 'water';
    if (this.snow > 0.5 || h > 4800) return 'snow';
    if (this.slopeAt(x, z, 4) > 0.6) return 'rock';
    const c = this.satAt(x, z); if (!c) return 'dirt';
    const [r, g, b] = c, lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const beach = h < 2.5 && [[25, 0], [-25, 0], [0, 25], [0, -25]].some(([dx, dz]) => this.heightAt(x + dx, z + dz) < 0.3);
    if (beach || (r - b > 45 && lum > 140)) return 'sand';
    if (lum > 110 && Math.max(r, g, b) - Math.min(r, g, b) < 50) return 'road'; // pale and unsaturated: built-up ground, paving
    const green = g > r * 1.02 && g > b * 1.05;
    if (!green && this.wet > 0.6 && lum < 120) return 'mud';                     // dark bare soil in a wet month
    return green ? 'grass' : 'dirt';
  }
  // 0..1 how green the imagery is (vegetation cover proxy)
  greenAt(x, z) { const c = this.satAt(x, z); return c ? Math.max(0, Math.min(1, (c[1] - Math.max(c[0], c[2] * 1.1)) / 25 + 0.2)) : 0; }

  // Load the 5 x 5 block around (x, z). Resolves when every tile is in.
  async update(x, z) {
    const { lat, lon } = this.toLatLon(x, z);
    const cx = Math.floor(lon2tx(lon, Z)), cy = Math.floor(lat2ty(lat, Z)), want = new Set(), jobs = [];
    this.cx = cx; this.cy = cy;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const k = `${cx + dx}/${cy + dy}`, near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1; want.add(k);
      if (!this.tiles.has(k)) { this.tiles.set(k, {}); jobs.push(this.build(cx + dx, cy + dy, k, near ? 14 : 13)); }
      else if (near && this.tiles.get(k).imgZ === 13) jobs.push(this.texture(cx + dx, cy + dy, this.tiles.get(k), 14)); // sharpen tiles you approach
    }
    for (const [k, t] of this.tiles) if (!want.has(k) && t.mesh && (Math.abs(+k.split('/')[0] - cx) > RADIUS + 1 || Math.abs(+k.split('/')[1] - cy) > RADIUS + 1)) this.drop(k, t);
    this.water.position.set(x, 0, z);
    await Promise.allSettled(jobs);
  }

  drop(k, t) {
    this.group.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.map?.dispose(); t.mesh.material.dispose();
    this.tiles.delete(k); this.onDrop?.(k);
  }

  async imageryFor(tx, ty) { // the Blue Marble z8 tile that contains this z12 tile, read once (fallback colour)
    const f = 2 ** (Z - IMG_Z), ix = Math.floor(tx / f), iy = Math.floor(ty / f), k = `${ix}/${iy}`;
    if (!this.images.has(k)) this.images.set(k, loadImage(BLUE_MARBLE(this.month, IMG_Z, ix, iy)).then(i => pixels(i)).catch(() => null));
    return { px: await this.images.get(k), f, ox: tx - ix * f, oy: ty - iy * f };
  }

  // Sentinel-2 mosaic stitched into one canvas per elevation tile: 512 px (z13) far away, 1024 px (z14) nearby.
  async texture(tx, ty, tile, iz) {
    if (tile.busy) return; tile.busy = true;
    const n = 2 ** (iz - Z), c = document.createElement('canvas'); c.width = c.height = 256 * n;
    const g = c.getContext('2d', { willReadFrequently: true }); let ok = 0;
    const pri = (tx - this.cx) ** 2 + (ty - this.cy) ** 2;
    await Promise.all(Array.from({ length: n * n }, (_, i) => queued(SAT(iz, tx * n + i % n, ty * n + (i / n | 0)), pri)
      .then(im => { g.drawImage(im, (i % n) * 256, (i / n | 0) * 256); ok++; }).catch(() => {})));
    tile.busy = false;
    if (!ok || !tile.mesh) return;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const old = tile.mesh.material; tile.mesh.material = groundMaterial(tex, this.uniforms); old.map?.dispose(); old.dispose();
    tile.imgZ = iz; tile.sat = pixels(c, GRID, GRID);
    this.onTile?.(`${tx}/${ty}`, tile, this);
  }

  async build(tx, ty, k, iz) {
    let img;
    try { img = await loadImage(ELEV(Z, tx, ty)); } catch { this.tiles.delete(k); return; }
    const d = pixels(img), h = new Float32Array(256 * 256);
    for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    const tile = this.tiles.get(k); if (!tile) return;
    const bm = await this.imageryFor(tx, ty);
    const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), grid = new Float32Array(pos.count), c = new THREE.Color();
    for (let j = 0, n = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++, n++) {
      const u = i / SEG, v = j / SEG, p = this.toLocal(ty2lat(ty + v, Z), tx2lon(tx + u, Z));
      // bilinear read of the 256 x 256 elevation grid
      const fx = u * 255, fy = v * 255, x0 = Math.min(254, fx | 0), y0 = Math.min(254, fy | 0), ax = fx - x0, ay = fy - y0;
      const hy = (h[y0 * 256 + x0] * (1 - ax) + h[y0 * 256 + x0 + 1] * ax) * (1 - ay) + (h[(y0 + 1) * 256 + x0] * (1 - ax) + h[(y0 + 1) * 256 + x0 + 1] * ax) * ay;
      pos.setXYZ(n, p.x, hy, p.z); grid[n] = hy;
      if (bm.px) { const sx = Math.min(255, ((bm.ox + u) / bm.f * 256) | 0), sy = Math.min(255, ((bm.oy + v) / bm.f * 256) | 0), q = (sy * 256 + sx) * 4; c.setRGB(bm.px[q] / 255, bm.px[q + 1] / 255, bm.px[q + 2] / 255, THREE.SRGBColorSpace); }
      else c.set(0x7c8a4e);
      col.set([c.r, c.g, c.b], n * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, groundMaterial(null, this.uniforms)); mesh.receiveShadow = true; this.group.add(mesh); tile.mesh = mesh; tile.grid = grid;
    if (bm.px) { // coarse NASA Blue Marble colour stands in until the Sentinel-2 mosaic arrives
      tile.sat = new Uint8ClampedArray(GRID * GRID * 4);
      for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) { const sx = Math.min(255, ((bm.ox + i / GRID) / bm.f * 256) | 0), sy = Math.min(255, ((bm.oy + j / GRID) / bm.f * 256) | 0), q = (sy * 256 + sx) * 4; tile.sat.set([bm.px[q], bm.px[q + 1], bm.px[q + 2], 255], (j * GRID + i) * 4); }
      this.onTile?.(k, tile, this);
    }
    const sharp = this.texture(tx, ty, tile, iz);
    if (tx === this.cx && ty === this.cy) await sharp; // the rest sharpens while you play
  }

  // Surroundings follow the data: wet soil darkens the ground, sub-zero months whiten it, wind roughens the water.
  setSurface({ wet = 0.4, snow = 0, wind = 2 }) {
    this.wet = wet; this.snow = snow;
    this.uniforms.uWet.value = Math.max(0, (wet - 0.3) / 0.7); this.uniforms.uSnow.value = snow;
    const m = this.water.material; m.roughness = Math.min(0.5, 0.04 + wind / 40); m.normalScale.setScalar(0.3 + Math.min(1.2, wind / 8));
  }
  update2(dt, wind = 2) { const n = this.water.material.normalMap; n.offset.x += dt * 0.004 * (1 + wind * 0.2); n.offset.y += dt * 0.0025; }

  // Nearest point (searching outward) that satisfies a test, for spawning boats on water or people on land.
  findNear(x, z, test, step = 150, max = 9000) {
    if (test(x, z)) return { x, z };
    for (let r = step; r <= max; r += step) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
      if (test(px, pz)) return { x: px, z: pz };
    }
    return null;
  }

  dispose() { for (const [k, t] of this.tiles) if (t.mesh) this.drop(k, t); this.scene.remove(this.group, this.water); }
}
