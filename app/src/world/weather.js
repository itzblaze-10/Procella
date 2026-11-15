// Sky, sun and weather driven by NASA values for the chosen place, year and month. Each effect can be switched off.
// The sun sits where it really is: solar declination for the month and the place's latitude, at the local solar time.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const D2R = Math.PI / 180;

// Direction to the sun in world axes (x east, y up, z south) for latitude, day of year and solar hour.
export function sunDirection(lat, doy, hour) {
  const d = 23.44 * D2R * Math.sin(2 * Math.PI * (284 + doy) / 365), H = (hour - 12) * 15 * D2R, p = lat * D2R;
  const east = -Math.cos(d) * Math.sin(H), north = Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(H), up = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H);
  return new THREE.Vector3(east, up, -north).normalize();
}

export class Weather {
  constructor(scene, renderer, lat = 0, month = 7) {
    this.scene = scene; this.renderer = renderer; this.lat = lat; this.doy = [0, 15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month] || 196;
    this.hour = 9.5; this.timeScale = 20; // one in-game hour every three real minutes
    this.on = { rain: true, wind: true, cloud: true, haze: true, mist: true, sun: true, soil: true, temp: true };
    this.v = {}; this.t = 0; this.gust = 0; this.envAge = 99;
    scene.fog = new THREE.Fog(0xb9c8d6, 600, 26000);
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a5340, 0.6);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 1200 });
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.4;
    scene.add(this.hemi, this.sun, this.sun.target);
    // physical sky (Preetham model), also baked into the environment map so paint, glass and water reflect it
    this.sky = new Sky(); this.sky.scale.setScalar(20000); scene.add(this.sky);
    this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);
    this.envSky.material.uniforms.showSunDisc.value = 0; // the disc would swamp the bounce light; the sun lamp covers it
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.background = null;
    // stars for nights
    const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y); v.multiplyScalar(15000); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false })); this.stars.frustumCulled = false; scene.add(this.stars);

    // precipitation: short line segments recycled in a box around the camera
    const N = 9000, p = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 160, y = Math.random() * 90, z = (Math.random() - 0.5) * 160; p.set([x, y, z, x, y - 1.2, z], i * 6); }
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xaecbe8, transparent: true, opacity: 0.4 }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    // wind: drifting streaks
    const W = 600, w = new Float32Array(W * 6);
    for (let i = 0; i < W; i++) { const x = (Math.random() - 0.5) * 200, y = Math.random() * 40, z = (Math.random() - 0.5) * 200; w.set([x, y, z, x + 4, y, z], i * 6); }
    this.windGeo = new THREE.BufferGeometry(); this.windGeo.setAttribute('position', new THREE.BufferAttribute(w, 3));
    this.wind = new THREE.LineSegments(this.windGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    this.wind.frustumCulled = false; scene.add(this.wind);
  }

  // values: snapshot of NASA variables for the month (see power.snapshot)
  set(values, terrain) { this.v = values || {}; this.terrain = terrain; this.apply(); }

  clock() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} solar time`; }
  shiftTime(hours) { this.hour = ((this.hour + hours) % 24 + 24) % 24; this.envAge = 99; this.apply(); }

  // Plain-language state of each effect, for the HUD.
  describe() {
    const v = this.v, r = v.PRECTOTCORR ?? 0, t = v.T2M ?? 15;
    return {
      rain: r < 0.3 ? 'Dry month' : (t < 1 ? 'Snow' : r < 2 ? 'Light rain' : r < 6 ? 'Rain' : 'Heavy rain') + ` · ${r.toFixed(1)} mm/day`,
      wind: v.WS10M == null ? '–' : `${v.WS10M.toFixed(1)} m/s` + (v.WS10M > 6 ? ' · gusty' : v.WS10M > 3.5 ? ' · breezy' : ' · calm'),
      cloud: v.CLOUD_AMT == null ? '–' : `${v.CLOUD_AMT.toFixed(0)} % cover`,
      haze: v.AOD_55 == null ? 'No data before 2001' : `AOD ${v.AOD_55.toFixed(2)}` + (v.AOD_55 > 0.6 ? ' · thick haze' : v.AOD_55 > 0.3 ? ' · hazy' : ' · clear'),
      mist: v.RH2M == null ? '–' : `${v.RH2M.toFixed(0)} % humidity`,
      sun: v.ALLSKY_SFC_SW_DWN == null ? '–' : `${v.ALLSKY_SFC_SW_DWN.toFixed(1)} MJ/m²/day · ${this.clock()}`,
      soil: v.GWETROOT == null ? '–' : `wetness ${v.GWETROOT.toFixed(2)}`,
      temp: v.T2M == null ? '–' : `${v.T2M.toFixed(1)} °C (high ${v.T2M_MAX?.toFixed(1)}, low ${v.T2M_MIN?.toFixed(1)})`,
    };
  }

  apply() {
    const v = this.v, on = this.on;
    this.rainRate = on.rain ? clamp((v.PRECTOTCORR ?? 0) / 10, 0, 1) : 0;
    this.snow = on.temp && (v.T2M ?? 10) < 1;
    this.rain.material.color.set(this.snow ? 0xffffff : 0xaecbe8);
    this.windSpeed = on.wind ? (v.WS10M ?? 2) : 0;
    this.cloud = on.cloud ? clamp((v.CLOUD_AMT ?? 30) / 100, 0, 1) : 0;
    this.haze = on.haze ? clamp((v.AOD_55 ?? 0.15) / 1.2, 0, 1) : 0; this.mist = on.mist ? clamp(((v.RH2M ?? 50) - 60) / 40, 0, 1) : 0;
    // the record's surface sunlight scales how bright the sun gets through cloud and aerosol
    this.sunF = on.sun ? clamp((v.ALLSKY_SFC_SW_DWN ?? 18) / 22, 0.15, 1.15) : 1;
    this.lightSky();
    if (this.terrain) this.terrain.uniforms.uRain.value = this.rainRate > 0.1 && !this.snow ? Math.min(1, this.rainRate * 1.5) : 0;
    this.terrain?.setSurface({ wet: on.soil ? clamp(v.GWETROOT ?? 0.4, 0, 1) : 0.4, snow: on.temp ? clamp((1 - (v.T2M ?? 10)) / 8, 0, 1) : 0, wind: this.windSpeed });
  }

  lightSky() {
    const dir = this.dir = sunDirection(this.lat, this.doy, this.hour), el = dir.y; // sin of solar elevation
    const day = clamp((el + 0.05) / 0.25, 0, 1), dusk = clamp(1 - Math.abs(el - 0.04) / 0.14, 0, 1);
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms;
      u.sunPosition.value.copy(dir); u.turbidity.value = Math.min(9, 2 + this.haze * 8 + this.cloud * 3); u.cloudCoverage.value = 0.1 + this.cloud * 0.85; u.cloudDensity.value = 0.3 + this.cloud * 0.6; u.rayleigh.value = Math.max(0.2, 1.2 + this.haze * 1.5 - this.cloud * 1.1);
      u.mieCoefficient.value = 0.004 + this.haze * 0.02; u.mieDirectionalG.value = 0.8;
    }
    const cloudDim = 1 - 0.55 * this.cloud;
    this.sun.intensity = 3.2 * this.sunF * cloudDim * day;
    this.sun.color.setHSL(0.09, 0.5 + 0.5 * dusk, 0.62 + 0.3 * (1 - dusk));
    this.hemi.intensity = 0.1 + 0.5 * day * (0.8 + 0.4 * this.cloud);
    this.hemi.color.setHSL(0.58, 0.4, 0.55 + 0.3 * day);
    this.stars.material.opacity = clamp(-el * 6, 0, 1) * (1 - this.cloud);
    // fog takes the horizon colour so distant land melts into the sky
    const fog = new THREE.Color(0x0a0f18).lerp(new THREE.Color(0xa9bdd0), day).lerp(new THREE.Color(0xd99a6a), dusk * 0.6)
      .lerp(new THREE.Color(0x9aa0a6).multiplyScalar(0.3 + 0.7 * day), this.cloud * 0.6).lerp(new THREE.Color(0xc9b991).multiplyScalar(0.3 + 0.7 * day), this.haze * 0.5);
    this.scene.fog.color.copy(fog);
    this.scene.fog.near = 500 - 350 * this.mist; this.scene.fog.far = 30000 * (1 - 0.75 * this.haze) * (1 - 0.6 * this.mist) * (1 - 0.5 * this.rainRate) * (1 - 0.3 * this.cloud);
    this.renderer.toneMappingExposure = 0.5 + 0.35 * day;
    this.scene.environmentIntensity = 0.015 + 0.075 * day; // the Preetham sky is in large physical units: this scales it to bounce light
    this.daylight = day;
  }

  // Re-bake the sky into the environment map now and then (sun moves slowly).
  bakeEnv() {
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 2000);
    this.envRT?.dispose(); this.envRT = rt; this.scene.environment = rt.texture; this.envAge = 0;
  }

  update(dt, camera, focus) {
    this.t += dt; const cp = camera.position, f = focus || cp; this.sky.material.uniforms.time.value = this.t;
    this.hour = (this.hour + dt * this.timeScale / 3600) % 24; this.envAge += dt;
    if (this.envAge > 6) { this.lightSky(); this.bakeEnv(); }
    this.gust = this.windSpeed > 6 ? Math.max(0, Math.sin(this.t * 0.7) * Math.sin(this.t * 1.9)) : 0;
    const wind = this.windSpeed * (1 + this.gust);
    // precipitation
    const rp = this.rainGeo.attributes.position, active = Math.round(rp.count / 2 * this.rainRate), fall = this.snow ? 2.5 : 22;
    this.rain.visible = active > 0; this.rainGeo.setDrawRange(0, active * 2);
    for (let i = 0; i < active; i++) {
      let y = rp.getY(i * 2) - fall * dt, x = rp.getX(i * 2) + wind * dt * (this.snow ? 0.6 : 0.15);
      if (y < cp.y - 40) y += 90; if (x > cp.x + 80) x -= 160; if (x < cp.x - 80) x += 160;
      let z = rp.getZ(i * 2); if (z > cp.z + 80) z -= 160; if (z < cp.z - 80) z += 160;
      const sx = this.snow ? Math.sin(this.t + i) * 0.3 : 0;
      rp.setXYZ(i * 2, x + sx, y, z); rp.setXYZ(i * 2 + 1, x + sx + wind * 0.02, y - (this.snow ? 0.15 : 1.2), z);
    }
    rp.needsUpdate = true;
    // wind streaks blow east at the measured speed
    const wp = this.windGeo.attributes.position; this.wind.visible = wind > 2.5;
    this.wind.material.opacity = Math.min(0.35, wind / 30);
    if (this.wind.visible) for (let i = 0; i < wp.count / 2; i++) {
      let x = wp.getX(i * 2) + wind * dt * 3, y = wp.getY(i * 2), z = wp.getZ(i * 2);
      if (x > cp.x + 100) x -= 200; if (x < cp.x - 100) x += 200; if (z > cp.z + 100) z -= 200; if (z < cp.z - 100) z += 200;
      if (y < cp.y - 30 || y > cp.y + 30) y = cp.y + (Math.random() - 0.5) * 50;
      wp.setXYZ(i * 2, x, y, z); wp.setXYZ(i * 2 + 1, x + 2 + wind * 0.3, y, z);
    }
    wp.needsUpdate = true;
    this.sky.position.copy(cp); this.stars.position.copy(cp);
    // the shadow camera follows whoever is in focus; the light sits along the true sun direction
    this.sun.target.position.copy(f); this.sun.position.copy(f).addScaledVector(this.dir.y > 0 ? this.dir : new THREE.Vector3(0, 1, 0), 500);
  }

  toggle(name) { this.on[name] = !this.on[name]; this.apply(); return this.on[name]; }
  dispose() { this.envRT?.dispose(); this.pmrem.dispose(); }
}
