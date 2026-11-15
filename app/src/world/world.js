// One play session at a real place and time: NASA data, terrain, weather, people, vehicles, camera.
import * as THREE from 'three';
import { Terrain, loadGroundTextures } from './terrain.js';
import { Vegetation, biomeFor } from './vegetation.js';
import { Weather } from './weather.js';
import { Settlements } from './settlements.js';
import { fetchPoint, fetchImergMonth, snapshot, climatology, reverse, VAR_IDS, bound } from '../data/power.js';
import { trend } from '../data/stats.js';
import { createCharacter } from '../people/index.js';
import { createVehicle, VEHICLES } from '../vehicles/index.js';

const UP = new THREE.Vector3(0, 1, 0);

export class World {
  constructor(renderer, opts, hooks) {
    this.renderer = renderer; this.o = opts; this.hooks = hooks; // hooks: status(msg), progress (Progress), toast(msg)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 60000);
    this.camYaw = 0; this.camPitch = 0.25; this.camDist = 9; this.dist = { land: 0, water: 0, total: 0 };
    this.stepT = 0; this.lastStep = 0;
  }

  async start() {
    const { lat, lon, year, month, mode } = this.o, s = this.hooks.status;
    s('Calling NASA POWER for 45 years of MERRA-2 and CERES data at this point…');
    this.pt = await fetchPoint(lat, lon);
    this.values = mode === 'future' ? this.futureValues() : snapshot(this.pt, year, month);
    s('Naming the place from OpenStreetMap…');
    const rv = await reverse(lat, lon);
    const a = rv?.address || {};
    this.placeName = a.village || a.town || a.city || a.county || a.state_district || a.state || rv?.name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    this.country = a.country || ''; this.cc = a.country_code || '';
    s('Loading real elevation and Sentinel-2 imagery…');
    await loadGroundTextures().catch(() => null); // close-up grain is optional
    this.terrain = new Terrain(this.scene, lat, lon, month === 13 ? 7 : month);
    await this.terrain.update(0, 0);
    this.weather = new Weather(this.scene, this.renderer, lat, month === 13 ? 7 : month); this.weather.set(this.values, this.terrain); this.weather.bakeEnv();
    if (mode !== 'future') fetchImergMonth(lat, lon, year, month).then(r => { this.imerg = r; this.hooks.refresh?.(); }).catch(() => { this.imerg = null; });
    await this.loadCity(lat, lon);
    s(this.city ? `Building ${this.city.data.name} from OpenStreetMap…` : 'Finding where people live and work nearby…');
    const open = (x, z) => this.terrain.heightAt(x, z) > 1 && this.terrain.slopeAt(x, z) < 0.2 && !this.city?.blocked(x, z) && !this.landmarkHit(x, z, 2);
    const street = (x, z) => this.city.surfaceAt(x, z) === 'road' && !this.city.collide(x, z, 4) && !this.landmarkHit(x, z, 4); // in a city you arrive on a real street
    let spawn = (this.city && this.terrain.findNear(0, 0, street, 8, 1500)) || this.terrain.findNear(0, 0, open, this.city ? 15 : 100, 8000) || { x: 0, z: 0 };
    const mean = id => { const v = this.pt.annual[id].values; return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
    this.tMean = mean('T2M') ?? 15; this.rainMean = mean('PRECTOTCORR') ?? 2;
    this.settlements = new Settlements(this.scene);
    this.settlements.build(this.terrain, spawn.x, spawn.z, this.values.GWETROOT ?? 0.4, this.placeName, { tMean: this.tMean, aod: this.values.AOD_55, city: this.city ? { blocked: (x, z) => !!this.city.collide(x, z, 2) || this.city.surfaceAt(x, z) === 'water' || !!this.landmarkHit(x, z, 2) } : null });
    s('Growing the vegetation this climate supports…');
    this.biome = biomeFor(this.tMean, this.rainMean);
    this.veg = new Vegetation(this.scene, this.renderer, this.terrain, this.biome);
    if (this.o.quality === 'low') { this.veg.cap = 20; this.veg.grassDensity = 0.4; }
    this.veg.blocked = (x, z) => this.settlements.blocked(x, z) || !!this.city?.blocked(x, z) || !!this.landmarkHit(x, z, 3);
    try { await this.veg.init(); } catch (e) { console.warn('vegetation', e); }
    this.terrain.onTile = (k, tile) => this.veg.addTile(k, tile); this.terrain.onDrop = k => this.veg.dropTile(k);
    for (const [k, tile] of this.terrain.tiles) if (tile.sat) this.veg.addTile(k, tile);
    // what vehicles and feet need to know about the ground and the solid things on it
    this.env = {
      surfaceAt: (x, z) => this.settlements.deckAt(x, z) != null ? 'wood' : this.city?.surfaceAt(x, z) || this.terrain.surfaceAt(x, z),
      collide: (x, z, r, y) => this.city?.collide(x, z, r, y) || this.landmarkHit(x, z, r, y) || this.settlements.collide(x, z, r, y) || this.veg.collide(x, z, r),
    };
    this.solid = (x, z, r, y) => this.city?.collide(x, z, r, y) || this.landmarkHit(x, z, r, y) || this.settlements.collide(x, z, r, y); // buildings only, for the camera
    Object.defineProperties(this.env, { wet: { get: () => this.values.GWETROOT ?? 0.4 }, rain: { get: () => this.weather.rainRate } });
    const near = this.settlements.sites[0]; // start a short walk from the first site
    if (near) spawn = this.terrain.findNear(near.x + (this.city ? 25 : 120), near.z + (this.city ? 25 : 120), this.city ? street : open, this.city ? 5 : 40, 2000) || spawn;
    this.player = createCharacter(this.o.characterId); this.scene.add(this.player.object);
    this.player.onStep = () => this.footstep();
    this.player.object.position.set(spawn.x, this.terrain.heightAt(spawn.x, spawn.z), spawn.z);
    if (this.o.vehicle) this.spawnVehicle(this.o.vehicle.kind, this.o.vehicle.color, this.o.vehicle.decal, true);
    this.hooks.progress.enterWorld(mode, year, lat, lon);
    this.lastStream = this.player.object.position.clone();
  }

  // A famous city near the pin: real OpenStreetMap footprints plus modelled landmarks (see app/CITIES.md).
  async loadCity(lat, lon) {
    this.landmarks = [];
    try {
      const C = await import('./city.js'), idx = await C.loadIndex(), entry = C.cityNear(idx, lat, lon, 4);
      let L = []; try { L = (await import('./landmarks.js')).landmarksNear(lat, lon, 8); } catch (e) { console.warn('landmarks', e); }
      for (const l of L) { // place each landmark at its real coordinates, front to its real heading
        const g = l.build(), p = this.terrain.toLocal(l.lat, l.lon), ry = -(l.heading || 0) * Math.PI / 180, c = Math.cos(ry), s = Math.sin(ry);
        g.position.set(p.x, this.terrain.heightAt(p.x, p.z), p.z); g.rotation.y = ry; this.scene.add(g);
        const cols = (l.colliders || []).map(k => ({ ...k, x: p.x + k.x * c + k.z * s, z: p.z - k.x * s + k.z * c, ry: (k.ry || 0) + ry }));
        this.landmarks.push({ ...l, group: g, x: p.x, z: p.z, cols });
      }
      if (entry) {
        this.hooks.status(`Loading ${entry.name} from OpenStreetMap…`);
        const data = await C.loadCity(entry.slug);
        this.city = new C.City(this.scene, this.terrain, data, L.filter(l => l.city === entry.slug)); await this.city.build();
      }
    } catch (e) { console.warn('city', e); this.city = null; }
  }
  // Landmark colliders (circles and boxes, world coordinates).
  landmarkHit(x, z, r, y = -Infinity) {
    for (const l of this.landmarks) for (const k of l.cols) {
      if (k.top != null && y > l.group.position.y + k.top) continue;
      if (k.type === 'circle') { const dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz); if (d < r + k.r && d > 1e-6) return { nx: dx / d, nz: dz / d, depth: r + k.r - d, material: 'stone' }; }
      else {
        const c = Math.cos(k.ry), s = Math.sin(k.ry), dx = x - k.x, dz = z - k.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
        const cx = Math.max(-k.hw, Math.min(k.hw, lx)), cz = Math.max(-k.hd, Math.min(k.hd, lz)), ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
        if (d >= r) continue;
        let nx = 1, nz = 0, depth = r;
        if (d > 1e-6) { nx = ox / d; nz = oz / d; depth = r - d; } else { const px = k.hw - Math.abs(lx), pz = k.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; depth = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; depth = pz + r; } }
        return { nx: nx * c + nz * s, nz: -nx * s + nz * c, depth, material: 'stone' };
      }
    }
    return null;
  }

  // Future Zone: each month's normal shifted by the variable's 45-year Sen trend to the chosen year.
  futureValues() {
    const out = {}, m = this.o.month === 13 ? 7 : this.o.month;
    for (const id of VAR_IDS) {
      const se = this.pt.annual[id]; if (!se.values.length) continue;
      const tr = trend(se), base = climatology(this.pt, id, m), mid = se.years[Math.floor(se.years.length / 2)];
      const b = bound(id, base + (tr.verdict === 'short' ? 0 : tr.slope * (this.o.futureYear - mid)));
      out[id] = b.value; if (b.capped) (this.capped ||= []).push(id);
    }
    return out;
  }

  get focus() { return this.vehicle && this.driving ? this.vehicle.object : this.player.object; }

  spawnVehicle(kind, color, decal, nearPlayer = false) {
    const meta = VEHICLES.find(v => v.kind === kind), p = this.player.object.position, t = this.terrain;
    let spot;
    if (meta.class === 'water') spot = t.findNear(p.x, p.z, (x, z) => t.heightAt(x, z) < -2, 150, 12000);
    else spot = t.findNear(p.x + 7, p.z - 12, (x, z) => t.heightAt(x, z) > 0.5 && t.slopeAt(x, z) < (meta.class === 'air' ? 0.06 : 0.3) && !this.env.collide(x, z, meta.class === 'air' ? 12 : 4), meta.class === 'air' ? 30 : 6, 4000);
    if (!spot) { this.hooks.toast(meta.class === 'water' ? 'No open water within 12 km of here. Try a coastal destination for boats.' : 'No flat ground nearby to park this.'); return false; }
    this.deleteVehicle(); // only once a valid spot exists, so a failed boat spawn keeps the car you had
    const v = createVehicle(kind, { color, decal });
    v.place(spot.x, spot.z, t, 0); this.scene.add(v.object); if (v.fx) this.scene.add(v.fx); this.vehicle = v; this.vehicleMeta = meta;
    if (meta.class === 'water' || !nearPlayer) { // walk the traveller to it
      const ex = v.object.localToWorld(v.exitOffset.clone()); const land = t.findNear(ex.x, ex.z, (x, z) => t.heightAt(x, z) > 0.5, 20, 3000) || ex;
      this.player.object.position.set(land.x, t.heightAt(land.x, land.z), land.z);
    }
    this.hooks.toast(`${meta.name} ready. Press F to get in.`); return true;
  }
  deleteVehicle() {
    if (!this.vehicle) return;
    if (this.driving) this.toggleDrive();
    this.scene.remove(this.vehicle.object); if (this.vehicle.fx) this.scene.remove(this.vehicle.fx); this.vehicle.dispose(); this.vehicle = null;
  }
  toggleDrive() {
    if (!this.vehicle) return;
    if (this.driving) { // step out beside the door, on land if possible
      const ex = this.vehicle.object.localToWorld(this.vehicle.exitOffset.clone());
      const land = this.terrain.isWater(ex.x, ex.z) ? (this.terrain.findNear(ex.x, ex.z, (x, z) => !this.terrain.isWater(x, z), 10, 400) || null) : ex;
      if (!land) { this.hooks.toast('Too far from shore to step out. Sail closer to land.'); return; }
      if (this.vehicle.telemetry().aglM > 3) { this.hooks.toast('Land first.'); return; }
      this.driving = false; this.player.object.visible = true; this.hooks.sound?.door(true);
      this.player.object.position.set(land.x, this.terrain.heightAt(land.x, land.z), land.z);
    } else {
      if (this.vehicle.object.position.distanceTo(this.player.object.position) > 14) { this.hooks.toast('Walk up to the vehicle first.'); return; }
      this.driving = true; this.player.object.visible = false; this.camDist = this.vehicle.cameraOffset.length() * (this.vehicleMeta.class === 'land' ? 0.8 : 1); // a lower, closer chase cam on the road
      this.hooks.sound?.door(false); setTimeout(() => this.driving && this.hooks.sound?.engineStart(this.vehicle.kind), 500);
    }
  }

  nearestNPC() { return this.player.object.visible ? this.settlements.nearest(this.player.object.position, 6) : null; }

  update(dt, keys) {
    const t = this.terrain, prog = this.hooks.progress;
    if (this.driving && this.vehicle) {
      const before = this.vehicle.object.position.clone(), wasStatus = this.vehicle.telemetry().status;
      this.vehicle.update(dt, keys, t, this.env);
      const tel = this.vehicle.telemetry(), d = this.vehicle.object.position.distanceTo(before), cls = this.vehicleMeta.class;
      this.dist.total += d; if (cls === 'land') this.dist.land += d; if (cls === 'water') this.dist.water += d;
      if (this.dist.land > 2000) prog.earn('drive'); if (this.dist.water > 1000) prog.earn('sail'); if (this.dist.total > 20000) prog.earn('distance');
      if (cls === 'air' && tel.aglM > 500) prog.earn('fly');
      if (this.vehicle.kind === 'seaplane' && wasStatus === 'On water' && tel.status === 'Airborne') prog.earn('waterTakeoff');
      this.player.object.position.copy(this.vehicle.object.position);
    } else this.walk(dt, keys);
    this.settlements.update(dt, this.player.object.position);
    this.veg.update(dt, this.focus.position, this.weather.windSpeed * (1 + this.weather.gust));
    this.settlements.setNight(1 - this.weather.daylight); this.city?.setNight(1 - this.weather.daylight); this.city?.update(dt, this.camera); this.terrain.update2(dt, this.weather.windSpeed);
    this.sound(dt);
    // stream terrain as the traveller moves
    const f = this.focus.position;
    if (f.distanceTo(this.lastStream) > 1500 && !this.streaming) {
      this.streaming = true; this.lastStream = f.clone(); t.update(f.x, f.z).finally(() => { this.streaming = false; });
    }
    this.updateCamera(dt);
    this.weather.update(dt, this.camera, this.focus.position);
  }

  walk(dt, keys) {
    const p = this.player.object, t = this.terrain;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const wade = t.heightAt(p.position.x, p.position.z) < 0.3;
    // walking pace 1.4 m/s and a jog of 3.8 m/s are typical adult speeds; wading slows both
    const speed = (keys.ShiftLeft || keys.ShiftRight ? 3.8 : 1.4) * (fwd || side ? 1 : 0) * (wade ? 0.55 : 1);
    if (speed) {
      const ang = this.camYaw + Math.atan2(-side, fwd);
      let nx = p.position.x - Math.sin(ang) * speed * dt, nz = p.position.z - Math.cos(ang) * speed * dt;
      const hit = this.env.collide(nx, nz, 0.35, p.position.y + 0.5);
      if (hit) { nx += hit.nx * hit.depth; nz += hit.nz * hit.depth; }
      if (t.heightAt(nx, nz) > -1.2 || this.settlements.deckAt(nx, nz) != null) { this.dist.total += speed * dt; p.position.x = nx; p.position.z = nz; }
      p.rotation.y = ang;
    }
    this.vy = (this.vy || 0) - 9.81 * dt; if (keys.Space && this.onGround) { this.vy = 4.2; this.onGround = false; }
    const deck = this.settlements.deckAt(p.position.x, p.position.z), ground = deck ?? Math.max(t.heightAt(p.position.x, p.position.z), -1.2); p.position.y += this.vy * dt;
    if (p.position.y <= ground) { if (!this.onGround && this.vy < -4) this.hooks.sound?.land(-this.vy, this.env.surfaceAt(p.position.x, p.position.z)); p.position.y = ground; this.vy = 0; this.onGround = true; }
    this.player.update(dt, speed);
    // footsteps from the animation if it reports them, else from walking cadence
    this.walkSpeed = speed; this.stepT += dt;
    if (speed && this.onGround && performance.now() - this.lastStep > 1200 && this.stepT > 1 / (1.2 + speed * 0.45)) this.footstep(true);
  }

  footstep(fallback = false) {
    if (!fallback) this.lastStep = performance.now();
    this.stepT = 0; const p = this.player.object.position;
    if (this.onGround !== false && this.player.object.visible) this.hooks.sound?.footstep(this.env.surfaceAt(p.x, p.z), this.walkSpeed > 2.5);
  }

  // Everything the sound engine needs, once per frame.
  sound(dt) {
    const S = this.hooks.sound; if (!S) return;
    const v = this.vehicle, w = this.weather, p = this.player.object.position;
    if (v?.events?.length) { for (const e of v.events) { if (e.type === 'land') S.land(e.v, this.env.surfaceAt(v.object.position.x, v.object.position.z)); else if (e.type === 'crash') S.crash(e.v, e.material); else if (e.type === 'splash') S.splash(e.v); else if (e.type === 'gear') S.gear(e.gear); } v.events.length = 0; }
    this.waterDistT = (this.waterDistT || 0) - dt;
    if (this.waterDistT <= 0) { // distance to the nearest sea or lake, checked twice a second
      this.waterDistT = 0.5; const f = this.focus.position, hit = this.terrain.findNear(f.x, f.z, (x, z) => this.terrain.heightAt(x, z) < 0, 60, 900);
      this.waterDist = hit ? Math.hypot(hit.x - f.x, hit.z - f.z) : 5000;
    }
    const tel = v?.telemetry();
    S.update(dt, {
      listener: this.camera,
      env: { wind: w.windSpeed, gust: w.gust, rain: w.rainRate, snow: w.snow, night: 1 - w.daylight, tempC: this.values.T2M ?? 15, vegetation: this.terrain.greenAt(this.focus.position.x, this.focus.position.z) * (this.biome.density ? 1 : 0), waterDist: this.waterDist,
        sites: this.settlements.sites.map(s => ({ kind: s.kind, x: s.x, y: this.terrain.heightAt(s.x, s.z), z: s.z })) },
      player: { x: p.x, y: p.y, z: p.z, speed: this.driving ? 0 : this.walkSpeed || 0, onFoot: !this.driving, surface: this.env.surfaceAt(p.x, p.z) },
      vehicle: v ? { kind: v.kind, class: v.class, x: v.object.position.x, y: v.object.position.y, z: v.object.position.z, inside: !!this.driving, ...tel } : null,
    });
  }

  updateCamera(dt) {
    const target = this.focus, base = target.position.clone();
    let off;
    if (this.driving && this.vehicle) {
      off = this.vehicle.cameraOffset.clone().normalize().multiplyScalar(this.camDist).applyAxisAngle(UP, this.camYaw);
      off.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(UP, new THREE.Euler().setFromQuaternion(target.quaternion, 'YXZ').y));
      base.y += 1.5;
    } else {
      off = new THREE.Vector3(0, 0, this.camDist).applyAxisAngle(new THREE.Vector3(1, 0, 0), -this.camPitch).applyAxisAngle(UP, this.camYaw);
      base.y += 1.6;
    }
    const want = base.clone().add(off);
    // keep the camera out of walls: march from the target towards the wanted spot and stop at the first solid
    if (this.solid) for (let i = 1, n = 16; i <= n; i++) {
      const p = base.clone().lerp(want, i / n);
      if (this.solid(p.x, p.z, 0.6, p.y)) { want.copy(base.clone().lerp(want, Math.max(0.05, (i - 1.5) / n))); break; }
    }
    const g = this.terrain.heightAt(want.x, want.z) + 1.5;
    if (want.y < g) want.y = g;
    this.camera.position.lerp(want, 1 - Math.exp(-dt * 8));
    // sense of speed: the view widens and, on the ground, shakes a little as speed builds
    const tel = this.driving && this.vehicle ? this.vehicle.telemetry() : null, kmh = tel ? tel.speedKmh : 0;
    const fov = 60 + Math.min(18, kmh / 11);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 3)); this.camera.updateProjectionMatrix(); }
    if (tel?.ground && this.vehicleMeta?.class === 'land' && kmh > 40) this.camera.position.y += (Math.random() - 0.5) * Math.min(0.08, kmh / 2500) * (tel.surface === 'road' ? 0.4 : 1);
    this.camera.lookAt(base);
  }

  orbit(dx, dy) { this.camYaw -= dx * 0.005; this.camPitch = Math.max(-0.2, Math.min(1.2, this.camPitch + dy * 0.004)); }
  zoom(d) { this.camDist = Math.max(3, Math.min(this.driving ? 400 : 30, this.camDist * (1 + d * 0.001))); }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  dispose() { this.hooks.sound?.leave?.(); this.city?.dispose(); this.landmarks?.forEach(l => { this.scene.remove(l.group); l.group.traverse(o => o.geometry?.dispose()); }); this.veg?.dispose(); this.weather?.dispose(); this.terrain?.dispose(); this.settlements?.dispose(); this.player?.dispose(); this.vehicle?.dispose(); this.scene.clear(); }
}
