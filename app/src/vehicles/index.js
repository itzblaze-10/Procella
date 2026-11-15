// Vehicles: catalogue + factory. See app/CONTRACTS.md, section Vehicles.
import * as THREE from 'three';
import * as M from './models.js';
import { land, plane, heli, boat } from './physics.js';
import { resetMats } from './parts.js';

const LAND = ['None', 'Racing stripe', 'PROCELLA expedition', 'Rally number', 'Checker band'];
const AIR = ['None', 'Sunset bands', 'PROCELLA expedition', 'Registration VT-PRC', 'Checker band'];
const SEA = ['None', 'Boot stripe', 'PROCELLA expedition', 'Wave line', 'Sunset bands'];

export const VEHICLES = [
  { kind: 'offroad', name: 'Expedition 4x4', class: 'land', colors: ['#d9cfb4', '#4b5a3a', '#efefec', '#8c2a1e', '#2d3e50'], decals: LAND, blurb: 'Roof rack, jerrycans, snorkel and big tyres. Slow on tarmac, unstoppable on hills.' },
  { kind: 'sedan', name: 'Saloon', class: 'land', colors: ['#c0c3c7', '#1f2a44', '#8e1b1b', '#f2f2f0', '#232426'], decals: LAND, blurb: 'Four-door saloon. Fastest on the road, hates steep slopes.' },
  { kind: 'buggy', name: 'Dune Buggy', class: 'land', colors: ['#f2b500', '#e2521d', '#2f7d3a', '#1e5fa8'], decals: LAND, blurb: 'Open roll cage, exposed engine, wide tyres. Light enough to fly off crests.' },
  { kind: 'cessna', name: 'High-Wing Trainer', class: 'air', colors: ['#f2f0ea', '#b3202a', '#1f4e8c', '#e3a21a'], decals: AIR, blurb: 'Classic four-seat high-wing single prop. Take off above 110 km/h, stalls below 85.' },
  { kind: 'helicopter', name: 'Explorer Helicopter', class: 'air', colors: ['#c8102e', '#f2f0ea', '#1d3557', '#f2b705'], decals: AIR, blurb: 'Bubble cabin and skids. Hovers hands-off, lands anywhere flat.' },
  { kind: 'seaplane', name: 'Float Plane', class: 'air', colors: ['#f2f0ea', '#e86a1a', '#2a7f62', '#3b4b8a'], decals: AIR, blurb: 'High wing on twin floats. Takes off from lakes and the sea.' },
  { kind: 'riverboat', name: 'Savanna Boat', class: 'water', colors: ['#2f5d3a', '#8a5a2b', '#f0ece0', '#2d4f6c'], decals: SEA, blurb: 'Flat-bottomed safari boat with a canvas canopy and an outboard. Nimble in rivers.' },
  { kind: 'steamliner', name: 'Sailing Steam Liner', class: 'water', colors: ['#151a20', '#f1ede2', '#1f3b5a', '#3c4a3a'], decals: SEA, blurb: 'Fifty metres of steam and sail. Slow, wide turns, smoke from the funnel.' },
  { kind: 'yacht', name: 'Explorer Yacht', class: 'water', colors: ['#f7f7f5', '#1b2c48', '#8a9199', '#3a3f45'], decals: SEA, blurb: 'Flybridge, radar mast and a tender on the stern. Fastest on the water.' },
];

const HELP = {
  land: ['W/S or Up/Down: throttle, reverse', 'A/D or Left/Right: steer', 'Space: brake'],
  plane: ['W/S: throttle up/down', 'Down/Up: pull up / nose down', 'Left/Right: roll', 'A/D: rudder', 'Space: wheel brakes'],
  heli: ['Space/Shift: collective up/down', 'W/S: tilt forward/back', 'Left/Right: strafe', 'A/D: yaw'],
  water: ['W/S: throttle, reverse', 'A/D: steer'],
};

const CFG = {
  offroad: [m => land(m, { top: 120, accel: 5, wb: 2.85, track: 1.62, half: 2.45, slope: 0.4, grav: 1, lift: 1 }), 'land', [0, 3.4, 9], [-1.8, 0, -0.3]],
  sedan: [m => land(m, { top: 160, accel: 7, wb: 2.8, track: 1.56, half: 2.45, slope: 1, grav: 1, lift: 1 }), 'land', [0, 3, 8.5], [-1.7, 0, -0.3]],
  buggy: [m => land(m, { top: 140, accel: 8, wb: 2.3, track: 1.64, half: 1.9, slope: 0.8, grav: 0.8, lift: 1.15 }), 'land', [0, 3, 7.5], [-1.6, 0, 0]],
  cessna: [m => plane(m, { top: 230, stall: 85, thrust: 6, floats: false }), 'plane', [0, 4.5, 16], [-2, 0, -1]],
  helicopter: [m => heli(m, { top: 220 }), 'heli', [0, 5, 17], [-2.2, 0, -0.5]],
  seaplane: [m => plane(m, { top: 210, stall: 85, thrust: 6, floats: true }), 'plane', [0, 5.5, 16], [-2.4, 0, -1]],
  riverboat: [m => boat(m, { top: 45, accel: 3, turn: 0.7, draft: 0.35, half: 4.5, lift: 0.03, roll: 0.03, bob: 1 }), 'water', [0, 4.5, 13], [-2.8, 0, 0]],
  steamliner: [m => boat(m, { top: 35, accel: 0.8, turn: 0.07, draft: 2.5, half: 25, lift: 0.005, roll: 0.015, bob: 0.4 }), 'water', [0, 28, 85], [-6, 0, 0]],
  yacht: [m => boat(m, { top: 70, accel: 2.2, turn: 0.35, draft: 0.8, half: 8, lift: 0.09, roll: 0.025, bob: 0.8 }), 'water', [0, 7, 24], [-3.8, 0, 0]],
};

export function createVehicle(kind, { color, decal } = {}) {
  const spec = VEHICLES.find(v => v.kind === kind);
  if (!spec) throw new Error(`Unknown vehicle kind: ${kind}`);
  const [phys, help, cam, exit] = CFG[kind];
  resetMats();
  const m = M[kind](color || spec.colors[0], decal);
  return {
    kind, class: spec.class, object: m.root,
    ...phys(m),
    controlsHelp: HELP[help],
    cameraOffset: new THREE.Vector3(...cam),
    exitOffset: new THREE.Vector3(...exit),
    dispose() {
      m.root.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(x => { x.map?.dispose(); x.dispose(); }); });
      m.root.removeFromParent();
    },
  };
}
