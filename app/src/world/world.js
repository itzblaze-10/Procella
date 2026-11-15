// One play session at a real place and time: NASA data, terrain, weather, people, vehicles, camera.
import * as THREE from 'three';
import { Terrain } from './terrain.js';
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
    this.country = a.country || '';
    s('Loading real elevation and NASA Blue Marble imagery…');
    this.terrain = new Terrain(this.scene, lat, lon, month === 13 ? 7 : month);
    await this.terrain.update(0, 0);
    this.weather = new Weather(this.scene, this.renderer); this.weather.set(this.values, this.terrain);
    if (mode !== 'future') fetchImergMonth(lat, lon, year, month).then(r => { this.imerg = r; this.hooks.refresh?.(); }).catch(() => { this.imerg = null; });
    s('Finding where people live and work nearby…');
    let spawn = this.terrain.findNear(0, 0, (x, z) => this.terrain.heightAt(x, z) > 1 && this.terrain.slopeAt(x, z) < 0.2, 100, 8000) || { x: 0, z: 0 };
    this.settlements = new Settlements(this.scene);
    this.settlements.build(this.terrain, spawn.x, spawn.z, this.values.GWETROOT ?? 0.4, this.placeName);
    const near = this.settlements.sites[0]; // start a short walk from the first site
    if (near) spawn = this.terrain.findNear(near.x + 120, near.z + 120, (x, z) => this.terrain.heightAt(x, z) > 1 && this.terrain.slopeAt(x, z) < 0.2, 40, 2000) || spawn;
    this.player = createCharacter(this.o.characterId); this.scene.add(this.player.object);
    this.player.object.position.set(spawn.x, this.terrain.heightAt(spawn.x, spawn.z), spawn.z);
    if (this.o.vehicle) this.spawnVehicle(this.o.vehicle.kind, this.o.vehicle.color, this.o.vehicle.decal, true);
    this.hooks.progress.enterWorld(mode, year, lat, lon);
    this.lastStream = this.player.object.position.clone();
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
    this.deleteVehicle();
    const meta = VEHICLES.find(v => v.kind === kind), p = this.player.object.position, t = this.terrain;
    let spot;
    if (meta.class === 'water') spot = t.findNear(p.x, p.z, (x, z) => t.heightAt(x, z) < -2, 150, 12000);
    else spot = t.findNear(p.x + 7, p.z - 12, (x, z) => t.heightAt(x, z) > 0.5 && t.slopeAt(x, z) < (meta.class === 'air' ? 0.06 : 0.3), 30, 4000);
    if (!spot) { this.hooks.toast(meta.class === 'water' ? 'No open water within 12 km of here. Try a coastal destination for boats.' : 'No flat ground nearby to park this.'); return false; }
    const v = createVehicle(kind, { color, decal });
    v.place(spot.x, spot.z, t, 0); this.scene.add(v.object); this.vehicle = v; this.vehicleMeta = meta;
    if (meta.class === 'water' || !nearPlayer) { // walk the traveller to it
      const ex = v.object.localToWorld(v.exitOffset.clone()); const land = t.findNear(ex.x, ex.z, (x, z) => t.heightAt(x, z) > 0.5, 20, 3000) || ex;
      this.player.object.position.set(land.x, t.heightAt(land.x, land.z), land.z);
    }
    this.hooks.toast(`${meta.name} ready. Press F to get in.`); return true;
  }
  deleteVehicle() {
    if (!this.vehicle) return;
    if (this.driving) this.toggleDrive();
    this.scene.remove(this.vehicle.object); this.vehicle.dispose(); this.vehicle = null;
  }
  toggleDrive() {
    if (!this.vehicle) return;
    if (this.driving) { // step out beside the door, on land if possible
      const ex = this.vehicle.object.localToWorld(this.vehicle.exitOffset.clone());
      const land = this.terrain.isWater(ex.x, ex.z) ? (this.terrain.findNear(ex.x, ex.z, (x, z) => !this.terrain.isWater(x, z), 10, 400) || null) : ex;
      if (!land) { this.hooks.toast('Too far from shore to step out. Sail closer to land.'); return; }
      if (this.vehicle.telemetry().aglM > 3) { this.hooks.toast('Land first.'); return; }
      this.driving = false; this.player.object.visible = true;
      this.player.object.position.set(land.x, this.terrain.heightAt(land.x, land.z), land.z);
    } else {
      if (this.vehicle.object.position.distanceTo(this.player.object.position) > 14) { this.hooks.toast('Walk up to the vehicle first.'); return; }
      this.driving = true; this.player.object.visible = false; this.camDist = this.vehicle.cameraOffset.length();
    }
  }

  nearestNPC() { return this.player.object.visible ? this.settlements.nearest(this.player.object.position, 6) : null; }

  update(dt, keys) {
    const t = this.terrain, prog = this.hooks.progress;
    if (this.driving && this.vehicle) {
      const before = this.vehicle.object.position.clone(), wasStatus = this.vehicle.telemetry().status;
      this.vehicle.update(dt, keys, t);
      const tel = this.vehicle.telemetry(), d = this.vehicle.object.position.distanceTo(before), cls = this.vehicleMeta.class;
      this.dist.total += d; if (cls === 'land') this.dist.land += d; if (cls === 'water') this.dist.water += d;
      if (this.dist.land > 2000) prog.earn('drive'); if (this.dist.water > 1000) prog.earn('sail'); if (this.dist.total > 20000) prog.earn('distance');
      if (cls === 'air' && tel.aglM > 500) prog.earn('fly');
      if (this.vehicle.kind === 'seaplane' && wasStatus === 'On water' && tel.status === 'Airborne') prog.earn('waterTakeoff');
      this.player.object.position.copy(this.vehicle.object.position);
    } else this.walk(dt, keys);
    this.settlements.update(dt, this.player.object.position);
    // stream terrain as the traveller moves
    const f = this.focus.position;
    if (f.distanceTo(this.lastStream) > 1500 && !this.streaming) {
      this.streaming = true; this.lastStream = f.clone(); t.update(f.x, f.z).finally(() => { this.streaming = false; });
    }
    this.updateCamera(dt);
    this.weather.update(dt, this.camera);
  }

  walk(dt, keys) {
    const p = this.player.object, t = this.terrain;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const speed = (keys.ShiftLeft || keys.ShiftRight ? 6 : 2.2) * (fwd || side ? 1 : 0);
    if (speed) {
      const ang = this.camYaw + Math.atan2(-side, fwd), nx = p.position.x - Math.sin(ang) * speed * dt, nz = p.position.z - Math.cos(ang) * speed * dt;
      if (t.heightAt(nx, nz) > -1) { this.dist.total += speed * dt; p.position.x = nx; p.position.z = nz; }
      p.rotation.y = ang;
    }
    this.vy = (this.vy || 0) - 20 * dt; if (keys.Space && this.onGround) { this.vy = 6; this.onGround = false; }
    const ground = Math.max(t.heightAt(p.position.x, p.position.z), -1); p.position.y += this.vy * dt;
    if (p.position.y <= ground) { p.position.y = ground; this.vy = 0; this.onGround = true; }
    this.player.update(dt, speed);
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
    const want = base.clone().add(off), g = this.terrain.heightAt(want.x, want.z) + 1.5;
    if (want.y < g) want.y = g;
    this.camera.position.lerp(want, 1 - Math.exp(-dt * 8)); this.camera.lookAt(base);
  }

  orbit(dx, dy) { this.camYaw -= dx * 0.005; this.camPitch = Math.max(-0.2, Math.min(1.2, this.camPitch + dy * 0.004)); }
  zoom(d) { this.camDist = Math.max(3, Math.min(this.driving ? 400 : 30, this.camDist * (1 + d * 0.001))); }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  dispose() { this.terrain?.dispose(); this.settlements?.dispose(); this.player?.dispose(); this.vehicle?.dispose(); this.scene.clear(); }
}
