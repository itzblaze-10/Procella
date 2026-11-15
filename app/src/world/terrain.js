// Real-world terrain around a lat/lon, streamed as the player moves.
// Elevation: AWS Terrain Tiles (terrarium PNG, SRTM/GMTED-derived, open, CORS). Imagery: NASA GIBS
// MODIS Blue Marble Next Generation monthly composite (cloud-free). No generated or AI terrain.
import * as THREE from 'three';

const Z = 12;                     // elevation zoom: about 38 m per pixel at the equator
const IMG_Z = 8;                  // GIBS Blue Marble max level
const SEG = 96;                   // mesh segments per tile edge
const RADIUS = 2;                 // tiles kept around the player (5 x 5)
const ELEV = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const BLUE_MARBLE = (month, z, x, y) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-${String(month).padStart(2, '0')}-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;

const lon2tx = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const tx2lon = (x, z) => x / 2 ** z * 360 - 180;
const ty2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };

function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('tile ' + url)); im.src = url; });
}
function pixels(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height).data;
}

// Fine ground grain (soil, grass tufts) multiplied over the NASA colour, so the surface reads at walking scale.
function detailTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = 228 + Math.random() * 27; img.data.set([v, v, v * 0.97, 255], i * 4); }
  g.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(900, 900); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}

export class Terrain {
  constructor(scene, lat, lon, month = 6) {
    this.scene = scene; this.lat0 = lat; this.lon0 = lon; this.month = month;
    this.mLat = 111320; this.mLon = 111320 * Math.cos(lat * Math.PI / 180);
    this.tiles = new Map(); this.images = new Map(); this.pending = 0;
    this.group = new THREE.Group(); scene.add(this.group);
    this.imagery = true; this.wetness = 0; // 0..1 from soil data, darkens ground
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: detailTexture() });
    this.treeGeo = new THREE.ConeGeometry(3.2, 10, 6); this.treeGeo.translate(0, 7, 0);
    this.trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 2.5, 5); this.trunkGeo.translate(0, 1.25, 0);
    this.treeMat = new THREE.MeshStandardMaterial({ color: 0x2f5d31, flatShading: true, roughness: 1 });
    this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22, flatShading: true });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000), new THREE.MeshStandardMaterial({ color: 0x1d4f6e, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 }));
    this.water.rotation.x = -Math.PI / 2; scene.add(this.water);
  }

  toLocal(lat, lon) { return { x: (lon - this.lon0) * this.mLon, z: -(lat - this.lat0) * this.mLat }; }
  toLatLon(x, z) { return { lat: this.lat0 - z / this.mLat, lon: this.lon0 + x / this.mLon }; }

  // Height of the rendered surface itself (same triangles as the mesh), so wheels and feet sit on what you see.
  heightAt(x, z) {
    const { lat, lon } = this.toLatLon(x, z);
    const fx = lon2tx(lon, Z), fy = lat2ty(lat, Z), tx = Math.floor(fx), ty = Math.floor(fy);
    const t = this.tiles.get(`${tx}/${ty}`);
    if (!t || !t.grid) return this.lastH ?? 0;
    const gx = (fx - tx) * SEG, gy = (fy - ty) * SEG, i = Math.min(SEG - 1, gx | 0), j = Math.min(SEG - 1, gy | 0), u = gx - i, v = gy - j, W = SEG + 1, g = t.grid;
    const ha = g[j * W + i], hb = g[(j + 1) * W + i], hc = g[(j + 1) * W + i + 1], hd = g[j * W + i + 1];
    return (this.lastH = u + v <= 1 ? ha + (hd - ha) * u + (hb - ha) * v : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v));
  }
  isWater(x, z) { return this.heightAt(x, z) < 0.5; }
  slopeAt(x, z) { const d = 20; return Math.hypot(this.heightAt(x + d, z) - this.heightAt(x - d, z), this.heightAt(x, z + d) - this.heightAt(x, z - d)) / (2 * d); }

  // Load the 5 x 5 block around (x, z). Resolves when every tile is in.
  async update(x, z) {
    const { lat, lon } = this.toLatLon(x, z);
    const cx = Math.floor(lon2tx(lon, Z)), cy = Math.floor(lat2ty(lat, Z)), want = new Set(), jobs = [];
    for (let dy = -RADIUS; dy <= RADIUS; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const k = `${cx + dx}/${cy + dy}`; want.add(k);
      if (!this.tiles.has(k)) { this.tiles.set(k, {}); jobs.push(this.build(cx + dx, cy + dy, k)); }
    }
    for (const [k, t] of this.tiles) if (!want.has(k) && t.mesh && Math.abs(+k.split('/')[0] - cx) > RADIUS + 1) this.drop(k, t);
    this.water.position.set(x, 0, z);
    await Promise.allSettled(jobs);
  }

  drop(k, t) {
    for (const m of [t.mesh, t.trees, t.trunks]) if (m) { this.group.remove(m); m.geometry?.dispose?.(); if (m.isInstancedMesh) m.dispose(); }
    t.mesh?.geometry.dispose(); this.tiles.delete(k);
  }

  async imageryFor(tx, ty) { // the Blue Marble z8 tile that contains this z12 tile, read once
    const f = 2 ** (Z - IMG_Z), ix = Math.floor(tx / f), iy = Math.floor(ty / f), k = `${ix}/${iy}`;
    if (!this.images.has(k)) this.images.set(k, loadImage(BLUE_MARBLE(this.month, IMG_Z, ix, iy)).then(pixels).catch(() => null));
    return { px: await this.images.get(k), f, ox: tx - ix * f, oy: ty - iy * f };
  }

  async build(tx, ty, k) {
    let img;
    try { img = await loadImage(ELEV(Z, tx, ty)); } catch { this.tiles.delete(k); return; }
    const d = pixels(img), h = new Float32Array(256 * 256);
    for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    const tile = this.tiles.get(k); if (!tile) return;
    const im = await this.imageryFor(tx, ty);

    const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), grid = new Float32Array(pos.count);
    const c = new THREE.Color(), trees = [];
    for (let j = 0, n = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++, n++) {
      const u = i / SEG, v = j / SEG, lat = ty2lat(ty + v, Z), lon = tx2lon(tx + u, Z), p = this.toLocal(lat, lon);
      const hy = h[Math.min(255, Math.round(v * 255)) * 256 + Math.min(255, Math.round(u * 255))];
      pos.setXYZ(n, p.x, hy, p.z); grid[n] = hy;
      if (im.px && this.imagery) { // sample Blue Marble colour for this vertex
        const sx = Math.min(255, ((im.ox + u) / im.f * 256) | 0), sy = Math.min(255, ((im.oy + v) / im.f * 256) | 0), q = (sy * 256 + sx) * 4;
        c.setRGB(im.px[q] / 255, im.px[q + 1] / 255, im.px[q + 2] / 255, THREE.SRGBColorSpace);
      } else c.set(hy > 2500 ? 0x8a8370 : 0x7c8a4e);
      if (hy < 0.5) c.set(0xc9b98a);                      // shore and sea bed: sand
      if (hy > 4300) c.lerp(new THREE.Color(0xf4f6f8), 0.7); // high ground: snow
      const n2 = Math.sin(p.x * 0.13) * Math.cos(p.z * 0.11) * 0.06; c.offsetHSL(0, 0, n2);
      col.set([c.r, c.g, c.b], n * 3);
      // trees where the imagery is green, the ground is above water and not too steep
      if (im.px && hy > 1 && hy < 3800 && c.g > c.r * 1.08 && c.g > c.b * 1.05 && (n * 2654435761 % 7) === 0) trees.push([p.x, hy, p.z]);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.material); mesh.receiveShadow = true; this.group.add(mesh); tile.mesh = mesh; tile.grid = grid;
    if (trees.length) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      const crown = new THREE.InstancedMesh(this.treeGeo, this.treeMat, trees.length), trunk = new THREE.InstancedMesh(this.trunkGeo, this.trunkMat, trees.length);
      trees.forEach(([x, y, z], i) => { const sc = 0.7 + ((i * 7919) % 10) / 15; s.set(sc, sc, sc); m.compose(new THREE.Vector3(x + (i % 5) * 7, y - 0.5, z + (i % 3) * 9), q, s); crown.setMatrixAt(i, m); trunk.setMatrixAt(i, m); });
      crown.castShadow = true; this.group.add(crown, trunk); tile.trees = crown; tile.trunks = trunk;
    }
  }

  setWind(sway) { this.treeMat.userData.sway = sway; }
  setWetness(w) { this.material.color.setScalar(1 - 0.25 * w); }

  // Nearest point (searching outward) that satisfies a test, for spawning boats on water or people on land.
  findNear(x, z, test, step = 150, max = 9000) {
    if (test(x, z)) return { x, z };
    for (let r = step; r <= max; r += step) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
      if (test(px, pz)) return { x: px, z: pz };
    }
    return null;
  }

  dispose() { for (const [k, t] of this.tiles) this.drop(k, t); this.scene.remove(this.group, this.water); }
}
