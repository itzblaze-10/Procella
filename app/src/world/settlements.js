// Places where people live and work, set close to the spawn point on flat dry land (or at the shore).
// Each holds NPCs with a story and a beacon so the player can find them.
import * as THREE from 'three';
import { createNPC } from '../people/index.js';

const M = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });
const MAT = { wall: M(0xd9cbb0), wall2: M(0xb88a64), roof: M(0x8a3b2a), roof2: M(0x4a5a6a), metal: M(0x8a949e), dark: M(0x3a3f45), wood: M(0x7a5634), crop: M(0x6f9a3a), dry: M(0xb59a52) };
const BOX = new THREE.BoxGeometry(1, 1, 1), CONE = new THREE.ConeGeometry(0.75, 1, 4), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
function part(geo, mat, x, y, z, sx, sy, sz, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; return m; }
function house(g, x, z, s, alt) {
  g.add(part(BOX, alt ? MAT.wall2 : MAT.wall, x, 2 * s, z, 7 * s, 4 * s, 6 * s));
  const r = part(CONE, alt ? MAT.roof2 : MAT.roof, x, 5.2 * s, z, 7.5 * s, 2.6 * s, 6.5 * s, Math.PI / 4); g.add(r);
}

const KINDS = {
  village: { roles: ['teacher', 'nurse', 'vendor'], label: 'Village', build(g, wet) { for (let i = 0; i < 9; i++) house(g, (i % 3) * 16 - 16 + (i * 7) % 5, Math.floor(i / 3) * 15 - 15, 0.9 + (i % 3) * 0.12, i % 2); g.add(part(BOX, MAT.wood, 0, 0.6, 26, 10, 1.2, 4)); } },
  farm: { roles: ['farmer', 'herder'], label: 'Farm', build(g, wet) {
    house(g, -12, -8, 1.1, 0); g.add(part(BOX, MAT.wood, 10, 3.5, -10, 12, 7, 9)); g.add(part(CONE, MAT.roof2, 10, 8, -10, 13, 3, 10, Math.PI / 4));
    // field colour follows the measured soil wetness: green when wet, straw when dry
    const crop = MAT.crop.clone(); crop.color.lerpColors(MAT.dry.color, MAT.crop.color, Math.min(1, Math.max(0, (wet - 0.25) / 0.5)));
    for (let r = 0; r < 6; r++) g.add(part(BOX, crop, -30 + r * 12, 0.35, 30, 10, 0.7, 34));
  } },
  industry: { roles: ['factory', 'builder'], label: 'Works', build(g) {
    g.add(part(BOX, MAT.metal, 0, 6, 0, 36, 12, 22)); g.add(part(BOX, MAT.dark, 0, 12.5, 0, 36, 1, 22));
    for (const x of [-10, 4]) g.add(part(CYL, MAT.dark, x, 18, -6, 2.4, 24, 2.4));
    g.add(part(BOX, MAT.wall, 26, 3, 14, 10, 6, 8)); g.add(part(CYL, MAT.metal, -26, 5, 12, 6, 10, 6));
  } },
  harbour: { roles: ['fisher', 'vendor'], label: 'Harbour', build(g) {
    g.add(part(BOX, MAT.wood, 0, 0.5, 18, 4, 1, 30)); house(g, -14, -6, 0.9, 1); house(g, 12, -10, 0.8, 0);
    g.add(part(BOX, MAT.roof, 0, 0.8, 30, 3, 1, 8, 0.3));
  } },
};

export class Settlements {
  constructor(scene) { this.scene = scene; this.sites = []; this.npcs = []; this.group = new THREE.Group(); scene.add(this.group); this.t = 0; }

  // Place up to four sites within about 0.6 to 2.5 km of (x, z).
  build(terrain, x, z, soilWetness, placeName) {
    this.terrain = terrain;
    const flat = (px, pz) => terrain.heightAt(px, pz) > 2 && terrain.slopeAt(px, pz) < 0.12;
    const shore = (px, pz) => terrain.heightAt(px, pz) > 1 && terrain.heightAt(px, pz) < 12 && terrain.findNear(px, pz, (a, b) => terrain.heightAt(a, b) < 0, 60, 300);
    const plan = [['village', 0.4], ['farm', 2.1], ['industry', 4.0], ['harbour', 5.2]];
    let seed = Math.abs(Math.round(x * 13 + z * 7 + placeName.length * 101));
    for (const [kind, angle] of plan) {
      const test = kind === 'harbour' ? shore : flat;
      let spot = null;
      for (let d = 600; d <= 2600 && !spot; d += 400) spot = terrain.findNear(x + Math.cos(angle) * d, z + Math.sin(angle) * d, test, 120, 900);
      if (!spot) continue;
      const g = new THREE.Group(), y = terrain.heightAt(spot.x, spot.z);
      g.position.set(spot.x, y - 0.3, spot.z); KINDS[kind].build(g, soilWetness); this.group.add(g);
      const site = { kind, label: KINDS[kind].label, x: spot.x, z: spot.z, npcs: [] };
      KINDS[kind].roles.forEach((role, i) => {
        const p = createNPC(role, ++seed), a = i * 2.1 + angle, nx = spot.x + Math.cos(a) * (9 + i * 4), nz = spot.z + Math.sin(a) * (9 + i * 4) + 20;
        p.object.position.set(nx, terrain.heightAt(nx, nz), nz); p.object.rotation.y = Math.random() * Math.PI * 2;
        this.group.add(p.object);
        const npc = { person: p, role, seed, site, heard: false, home: { x: nx, z: nz }, phase: seed % 7, beacon: this.beacon(nx, terrain.heightAt(nx, nz), nz) };
        site.npcs.push(npc); this.npcs.push(npc);
      });
      this.sites.push(site);
    }
    return this.sites;
  }

  beacon(x, y, z) { // a tall light and a turning marker over each storyteller
    const g = new THREE.Group(); g.position.set(x, y, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 80, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.28, depthWrite: false }));
    beam.position.y = 42; const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0xf2b84b }));
    gem.position.y = 2.7; g.add(beam, gem); g.userData.gem = gem; g.userData.beam = beam; this.group.add(g); return g;
  }

  markHeard(npc) { npc.heard = true; npc.beacon.userData.gem.material = new THREE.MeshBasicMaterial({ color: 0x4fd1a5 }); npc.beacon.userData.beam.material.opacity = 0.08; }

  nearest(pos, max = 6) {
    let best = null, bd = max;
    for (const n of this.npcs) { const d = n.person.object.position.distanceTo(pos); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  update(dt, playerPos) {
    this.t += dt;
    for (const n of this.npcs) {
      const o = n.person.object, near = playerPos && o.position.distanceTo(playerPos) < 12;
      if (near) { // stop and face the traveller
        n.person.update(dt, 0); o.rotation.y = Math.atan2(-(playerPos.x - o.position.x), -(playerPos.z - o.position.z));
      } else { // stroll a small loop around their workplace
        n.phase += dt * 0.12; const x = n.home.x + Math.cos(n.phase) * 6, z = n.home.z + Math.sin(n.phase) * 6;
        o.rotation.y = Math.atan2(-(x - o.position.x), -(z - o.position.z));
        o.position.set(x, this.terrain.heightAt(x, z), z); n.person.update(dt, 0.72);
      }
      n.beacon.position.set(o.position.x, o.position.y, o.position.z);
      n.beacon.userData.gem.rotation.y += dt * 1.5; n.beacon.userData.gem.position.y = 2.7 + Math.sin(this.t * 2) * 0.15;
    }
  }

  dispose() { this.npcs.forEach(n => n.person.dispose()); this.scene.remove(this.group); this.sites = []; this.npcs = []; }
}
