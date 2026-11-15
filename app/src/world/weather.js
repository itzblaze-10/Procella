// Weather driven by NASA values for the chosen place, year and month. Each effect can be switched off.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Weather {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.on = { rain: true, wind: true, cloud: true, haze: true, mist: true, sun: true, soil: true, temp: true };
    this.v = {}; this.t = 0; this.gust = 0;
    scene.fog = new THREE.Fog(0xb9c8d6, 600, 26000);
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a5340, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2); this.sun.position.set(-3000, 6000, 2500);
    scene.add(this.hemi, this.sun, this.sun.target);
    this.sky = new THREE.Color(0x8fb4d8); scene.background = this.sky.clone();

    // precipitation: short line segments recycled in a box around the camera
    const N = 9000, p = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 160, y = Math.random() * 90, z = (Math.random() - 0.5) * 160; p.set([x, y, z, x, y - 1.2, z], i * 6); }
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xaecbe8, transparent: true, opacity: 0.55 }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    // wind: drifting streaks
    const W = 600, w = new Float32Array(W * 6);
    for (let i = 0; i < W; i++) { const x = (Math.random() - 0.5) * 200, y = Math.random() * 40, z = (Math.random() - 0.5) * 200; w.set([x, y, z, x + 4, y, z], i * 6); }
    this.windGeo = new THREE.BufferGeometry(); this.windGeo.setAttribute('position', new THREE.BufferAttribute(w, 3));
    this.wind = new THREE.LineSegments(this.windGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    this.wind.frustumCulled = false; scene.add(this.wind);
    // cloud deck: flattened instanced puffs high above
    const cg = new THREE.IcosahedronGeometry(1, 1);
    this.clouds = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9, flatShading: true }), 220);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 220; i++) {
      const s = 300 + Math.random() * 700; m.compose(new THREE.Vector3((Math.random() - 0.5) * 30000, 2200 + Math.random() * 900, (Math.random() - 0.5) * 30000), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.35, s * 0.8));
      this.clouds.setMatrixAt(i, m);
    }
    this.clouds.frustumCulled = false; scene.add(this.clouds);
  }

  // values: snapshot of NASA variables for the month (see power.snapshot); normal: climatology for comparison
  set(values, terrain) { this.v = values || {}; this.terrain = terrain; this.apply(); }

  // Plain-language state of each effect, for the HUD.
  describe() {
    const v = this.v, r = v.PRECTOTCORR ?? 0, t = v.T2M ?? 15;
    return {
      rain: r < 0.3 ? 'Dry month' : (t < 1 ? 'Snow' : r < 2 ? 'Light rain' : r < 6 ? 'Rain' : 'Heavy rain') + ` · ${r.toFixed(1)} mm/day`,
      wind: v.WS10M == null ? '–' : `${v.WS10M.toFixed(1)} m/s` + (v.WS10M > 6 ? ' · gusty' : v.WS10M > 3.5 ? ' · breezy' : ' · calm'),
      cloud: v.CLOUD_AMT == null ? '–' : `${v.CLOUD_AMT.toFixed(0)} % cover`,
      haze: v.AOD_55 == null ? 'No data before 2001' : `AOD ${v.AOD_55.toFixed(2)}` + (v.AOD_55 > 0.6 ? ' · thick haze' : v.AOD_55 > 0.3 ? ' · hazy' : ' · clear'),
      mist: v.RH2M == null ? '–' : `${v.RH2M.toFixed(0)} % humidity`,
      sun: v.ALLSKY_SFC_SW_DWN == null ? '–' : `${v.ALLSKY_SFC_SW_DWN.toFixed(1)} MJ/m²/day`,
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
    const cloud = on.cloud ? clamp((v.CLOUD_AMT ?? 30) / 100, 0, 1) : 0;
    this.clouds.material.opacity = 0.25 + 0.7 * cloud; this.clouds.count = Math.round(220 * cloud);
    const haze = on.haze ? clamp((v.AOD_55 ?? 0.15) / 1.2, 0, 1) : 0, mist = on.mist ? clamp(((v.RH2M ?? 50) - 60) / 40, 0, 1) : 0;
    const sunF = on.sun ? clamp((v.ALLSKY_SFC_SW_DWN ?? 18) / 25, 0.25, 1.15) : 1;
    this.sun.intensity = 2.4 * sunF * (1 - 0.5 * cloud); this.hemi.intensity = 0.7 + 0.4 * cloud;
    const base = new THREE.Color(0x8fb4d8).lerp(new THREE.Color(0x9aa3ad), cloud * 0.8).lerp(new THREE.Color(0xc9b991), haze * 0.6);
    this.scene.background.copy(base); this.scene.fog.color.copy(base);
    this.scene.fog.near = 400 - 300 * mist; this.scene.fog.far = 26000 * (1 - 0.75 * haze) * (1 - 0.5 * mist) * (1 - 0.4 * this.rainRate);
    this.terrain?.setWetness(on.soil ? clamp(v.GWETROOT ?? 0.4, 0, 1) : 0.4);
  }

  update(dt, camera) {
    this.t += dt; const cp = camera.position;
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
    this.wind.material.opacity = Math.min(0.5, wind / 25);
    if (this.wind.visible) for (let i = 0; i < wp.count / 2; i++) {
      let x = wp.getX(i * 2) + wind * dt * 3, y = wp.getY(i * 2), z = wp.getZ(i * 2);
      if (x > cp.x + 100) x -= 200; if (x < cp.x - 100) x += 200; if (z > cp.z + 100) z -= 200; if (z < cp.z - 100) z += 200;
      if (y < cp.y - 30 || y > cp.y + 30) y = cp.y + (Math.random() - 0.5) * 50;
      wp.setXYZ(i * 2, x, y, z); wp.setXYZ(i * 2 + 1, x + 2 + wind * 0.3, y, z);
    }
    wp.needsUpdate = true;
    this.clouds.position.set(cp.x, Math.max(0, this.terrain?.heightAt(cp.x, cp.z) ?? 0) - 600, cp.z); this.clouds.position.x += (this.t * wind * 4) % 3000;
    this.sun.target.position.copy(cp); this.sun.position.set(cp.x - 3000, cp.y + 6000, cp.z + 2500);
  }

  toggle(name) { this.on[name] = !this.on[name]; this.apply(); return this.on[name]; }
}
