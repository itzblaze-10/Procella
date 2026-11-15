// A NASA-imaged globe: GIBS WMS layers fetched live as equirectangular images.
import * as THREE from 'three';

const WMS = (layer, time, fmt) => `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&LAYERS=${layer}&TIME=${time}&FORMAT=${fmt}${fmt === 'image/png' ? '&TRANSPARENT=true' : ''}`;

export const GLOBE_LAYERS = {
  bluemarble: { label: 'MODIS Blue Marble (monthly composite)', layer: 'BlueMarble_NextGeneration', fmt: 'image/jpeg', time: m => `2004-${String(m).padStart(2, '0')}-01`, base: true },
  truecolor: { label: 'MODIS Terra true colour (daily)', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', fmt: 'image/jpeg', time: (m, d) => d, base: true },
  imerg: { label: 'GPM IMERG rain rate (daily)', layer: 'IMERG_Precipitation_Rate', fmt: 'image/png', time: (m, d) => d },
  airs: { label: 'AIRS surface air temperature (day)', layer: 'AIRS_L3_Surface_Air_Temperature_Daily_Day', fmt: 'image/png', time: (m, d) => d },
};

export const R = 100;
export function latLonToVec(lat, lon, r = R) {
  const phi = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
}
export function vecToLatLon(v) {
  const n = v.clone().normalize(); let lon = Math.atan2(n.z, -n.x) / (Math.PI * 2) * 360 - 180;
  if (lon < -180) lon += 360;
  return { lat: 90 - Math.acos(n.y) * 180 / Math.PI, lon };
}

export class Globe {
  constructor() {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0a111c);
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 5000); this.dist = 330; this.yaw = -1.2; this.pitch = 0.35; this.autoSpin = true;
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55); this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.scene.add(this.sun);
    this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin('anonymous');
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ color: 0x1b2a40, roughness: 0.9 }));
    this.overlay = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 96, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }));
    this.overlay.visible = false;
    // atmosphere: a limb glow that brightens toward the edge of the disc (Fresnel), like photos from orbit
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 64, 32), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(0x5ba2ff) } }, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 c; varying vec3 vN; void main() { float i = pow(clamp(0.72 + dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0); gl_FragColor = vec4(c * i * 1.1, i); }',
    }));
    this.rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.002, 96, 64), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(0x7fb8ff) } }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.5); gl_FragColor = vec4(c * f * 0.9, f); }',
    }));
    this.root = new THREE.Group(); this.root.add(this.earth, this.overlay, this.rim, this.atmo); this.scene.add(this.root);
    // NASA Black Marble (VIIRS) city lights glow on the night side only
    this.sunView = { value: new THREE.Vector3(0, 0, 1) };
    this.earth.material.onBeforeCompile = sh => {
      sh.uniforms.uSun = this.sunView;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSun;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep(0.12, -0.25, dot(normalize(vNormal), uSun));');
    };
    this.loader.loadAsync(WMS('VIIRS_Black_Marble', '2016-01-01', 'image/jpeg')).then(t => { t.colorSpace = THREE.SRGBColorSpace; Object.assign(this.earth.material, { emissiveMap: t, emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 1.6 }); this.earth.material.needsUpdate = true; }).catch(() => {});
    // the satellites behind the data, on inclined orbits (stylised scale)
    this.sats = new THREE.Group(); this.scene.add(this.sats);
    const body = new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 0.7, roughness: 0.35 }), panel = new THREE.MeshStandardMaterial({ color: 0x1f3a6b, metalness: 0.5, roughness: 0.3, emissive: 0x0a1630 });
    this.satList = [['TERRA', 0.17, 1.1, 0], ['AQUA', 0.15, 1.6, 2.1], ['GPM', 0.21, 0.65, 4.2]].map(([name, speed, incl, phase], i) => {
      const g = new THREE.Group(), r = R * (1.28 + i * 0.07);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 3.4), body));
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 2.2), panel); p.position.x = sx * 4.2; g.add(p); }
      const orbit = new THREE.Group(); orbit.rotation.set(incl, i * 1.3, 0); orbit.add(g); this.sats.add(orbit);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 4, 160), new THREE.MeshBasicMaterial({ color: 0x5ba2ff, transparent: true, opacity: 0.09 })); ring.rotation.x = Math.PI / 2; orbit.add(ring);
      return { name, speed, r, phase, g };
    });
    this.sats.visible = false; this.screenSats = [];
    this.markers = new THREE.Group(); this.root.add(this.markers);
    const stars = new Float32Array(3000); for (let i = 0; i < 3000; i++) stars[i] = (Math.random() - 0.5) * 3000;
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xa3b3c8, size: 1.5 })));
    this.pin = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6, 8), new THREE.MeshBasicMaterial({ color: 0xf2b84b })); this.pin.visible = false; this.root.add(this.pin);
    this.ray = new THREE.Raycaster(); this.month = 8;
  }

  async setBase(key, month = this.month, date = '2025-07-15') {
    const L = GLOBE_LAYERS[key];
    const tex = await this.loader.loadAsync(WMS(L.layer, L.time(month, date), L.fmt)); tex.colorSpace = THREE.SRGBColorSpace;
    this.earth.material.map?.dispose(); this.earth.material.map = tex; this.earth.material.color.set(0xffffff); this.earth.material.needsUpdate = true;
  }
  async setOverlay(key, date = '2025-07-15') {
    if (!key) { this.overlay.visible = false; return; }
    const L = GLOBE_LAYERS[key], tex = await this.loader.loadAsync(WMS(L.layer, L.time(this.month, date), L.fmt)); tex.colorSpace = THREE.SRGBColorSpace;
    this.overlay.material.map?.dispose(); this.overlay.material.map = tex; this.overlay.material.needsUpdate = true; this.overlay.visible = true;
  }

  setPin(lat, lon) { const p = latLonToVec(lat, lon, R + 3); this.pin.position.copy(p); this.pin.lookAt(p.clone().multiplyScalar(2)); this.pin.rotateX(-Math.PI / 2); this.pin.visible = true; }
  focus(lat, lon) { const v = latLonToVec(lat, lon); this.yaw = Math.atan2(v.x, v.z); this.pitch = Math.asin(v.y / R); this.autoSpin = false; }

  pick(ndcX, ndcY) {
    this.ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = this.ray.intersectObjects([...this.markers.children, this.earth], false)[0];
    if (!hit) return null;
    return hit.object === this.earth ? { ...vecToLatLon(hit.point.clone().applyMatrix4(this.root.matrixWorld.clone().invert())) } : { marker: hit.object };
  }

  // Lab beacons: spikes whose height shows the size of the trend, colour its direction, solidity its verdict.
  setMarkers(items) { // [{lat, lon, height (0..1), color, verdict, data}]
    this.markers.clear();
    for (const it of items) {
      const h = 4 + 26 * it.height, geo = new THREE.CylinderGeometry(0.9, 0.9, h, 8); geo.translate(0, h / 2, 0);
      const mat = new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: it.verdict === 'detected' ? 0.95 : it.verdict === 'null' ? 0.45 : 0.2, wireframe: it.verdict === 'short' });
      const m = new THREE.Mesh(geo, mat), p = latLonToVec(it.lat, it.lon, R);
      m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize()); m.userData = it.data; this.markers.add(m);
    }
  }

  drag(dx, dy) { this.yaw -= dx * 0.005; this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + dy * 0.005)); this.autoSpin = false; }
  zoom(d) { this.dist = Math.max(140, Math.min(600, this.dist * (1 + d * 0.001))); }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  // Home screen framing: globe pushed right, a fixed sun so a night side shows, satellites in orbit.
  setCinema(on, w = innerWidth, h = innerHeight) {
    this.cinema = on; this.sats.visible = on;
    if (on && w > 820) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else this.camera.clearViewOffset();
    if (on) { this.dist = 370; if (!this.framed) { const v = latLonToVec(18, 72); this.yaw = Math.atan2(v.x, v.z); this.pitch = 0.3; this.framed = true; } }
    this.ambient.intensity = on ? 0.12 : 0.55; this.sun.intensity = on ? 3 : 2.2;
  }
  update(dt) {
    this.t = (this.t || 0) + dt;
    if (this.autoSpin) this.yaw -= dt * (this.cinema ? 0.035 : 0.05);
    this.root.rotation.set(0, 0, 0);
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, Math.sin(this.pitch) * this.dist, Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    this.camera.lookAt(0, 0, 0);
    this.sun.position.copy(this.camera.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cinema ? -0.85 : 0.6).add(new THREE.Vector3(0, 120, 0)); // light follows the view
    this.camera.updateMatrixWorld(); this.sunView.value.copy(this.sun.position).normalize().transformDirection(this.camera.matrixWorldInverse);
    if (this.cinema) this.screenSats = this.satList.map(s => {
      const a = this.t * s.speed + s.phase; s.g.position.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r); s.g.rotation.y = -a;
      const p = s.g.getWorldPosition(new THREE.Vector3()), front = p.clone().sub(this.camera.position).length() < this.camera.position.length(); p.project(this.camera);
      return { name: s.name, x: (p.x + 1) / 2, y: (1 - p.y) / 2, front };
    });
  }
}
