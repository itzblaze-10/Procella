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
  { kind: 'cessna', name: 'High-Wing Trainer', class: 'air', colors: ['#f2f0ea', '#b3202a', '#1f4e8c', '#e3a21a'], decals: AIR, blurb: 'Cessna 172-type four-seat trainer. Rotates at 55 kt (102 km/h), stalls at 48 kt (89 km/h), cruises at 226 km/h.' },
  { kind: 'helicopter', name: 'Explorer Helicopter', class: 'air', colors: ['#c8102e', '#f2f0ea', '#1d3557', '#f2b705'], decals: AIR, blurb: 'Bubble cabin and skids. Hovers hands-off, lands anywhere flat.' },
  { kind: 'seaplane', name: 'Float Plane', class: 'air', colors: ['#f2f0ea', '#e86a1a', '#2a7f62', '#3b4b8a'], decals: AIR, blurb: 'High wing on twin floats. Takes off from lakes and the sea.' },
  { kind: 'riverboat', name: 'Savanna Boat', class: 'water', colors: ['#2f5d3a', '#8a5a2b', '#f0ece0', '#2d4f6c'], decals: SEA, blurb: 'Flat-bottomed safari boat with a canvas canopy and an outboard. Nimble in rivers.' },
  { kind: 'steamliner', name: 'Sailing Steam Liner', class: 'water', colors: ['#151a20', '#f1ede2', '#1f3b5a', '#3c4a3a'], decals: SEA, blurb: 'Fifty metres of steam and sail. Slow, wide turns, smoke from the funnel.' },
  { kind: 'yacht', name: 'Explorer Yacht', class: 'water', colors: ['#f7f7f5', '#1b2c48', '#8a9199', '#3a3f45'], decals: SEA, blurb: 'Flybridge, radar mast and a tender on the stern. Fastest on the water.' },
];

const HELP = {
  land: ['W: throttle', 'S: brake, then reverse', 'A/D or Left/Right: steer', 'Space: handbrake (slide)'],
  plane: ['W/S: throttle up/down', 'Down/Up: pull up / nose down', 'Left/Right: bank', 'A/D: rudder, nose wheel', 'Space: wheel brakes'],
  heli: ['Space/Shift: collective up/down', 'W/S: tilt forward/back', 'Left/Right: strafe', 'A/D: yaw'],
  water: ['W/S: throttle, reverse', 'A/D: steer'],
};

// Real figures where published; "tuned" marks values chosen to hit the published performance.
const CFG = {
  // LC76 V8: 151 kW at 3,400 rpm, 430 Nm at 1,200-3,200 rpm, about 2,300 kg kerb, 5-speed manual (ratios approximate),
  // spec-sheet top speed 160 km/h, 0-100 about 12 s (tuned to it).
  offroad: [m => land(m, { mass: 2380, wb: 2.73, track: 1.555, hcg: 0.85, CdA: 1.75, torque: [[700, 230], [1200, 430], [3200, 430], [3400, 424], [3800, 300]],
    idle: 700, redline: 3800, gears: [4.313, 2.33, 1.436, 1.0, 0.838], final: 3.909, eta: 0.85, drive: 'awd', loose: 1.15, road: 0.92, crr: 0.6,
    travel: 0.14, rollK: 0.012, pitchK: 0.009, half: 2.65, width: 1.87, steerMax: 0.55, shiftT: 0.45, bias: 0.45, esc: true }), 'land', [0, 3.3, 9.2], [-1.5, 0, -0.1]],
  // Corolla 2.0 (M20A): 126 kW (169 hp) at 6,600 rpm, 205 Nm (151 lb-ft) at 4,400-4,800 rpm, about 1,380 kg, 6-speed manual
  // (ratios approximate), top speed about 210 km/h (131 mph listed), 0-100 about 9 s.
  sedan: [m => land(m, { mass: 1450, wb: 2.7, track: 1.53, hcg: 0.52, CdA: 0.66, torque: [[800, 140], [4400, 205], [4800, 205], [6600, 182], [6800, 165]],
    idle: 750, redline: 6800, gears: [3.54, 2.05, 1.33, 1.03, 0.82, 0.67], final: 4.06, eta: 0.88, drive: 'fwd', loose: 0.85, road: 1.0, crr: 1.3,
    travel: 0.08, rollK: 0.006, pitchK: 0.005, half: 2.33, width: 1.78, steerMax: 0.58, shiftT: 0.3, bias: 0.38, esc: true }), 'land', [0, 2.6, 8.2], [-1.45, 0, -0.1]],
  // Manx-type buggy: ~600 kg with driver, VW 4-speed (3.80/2.06/1.26/0.89, 4.125 final); tuned 2.0 L air-cooled flat-four sized
  // for the brief's ~7 s 0-100.
  buggy: [m => land(m, { mass: 680, wb: 2.03, track: 1.42, hcg: 0.5, CdA: 1.1, torque: [[900, 100], [3200, 158], [4800, 153], [5800, 135]],
    idle: 900, redline: 5800, gears: [3.8, 2.06, 1.26, 0.89], final: 4.125, eta: 0.9, drive: 'rwd', loose: 1.1, road: 0.95, crr: 0.5,
    travel: 0.17, rollK: 0.009, pitchK: 0.008, half: 1.8, width: 1.5, steerMax: 0.62, shiftT: 0.3, bias: 0.6, rearGrip: 1.25 }), 'land', [0, 2.4, 6.6], [-1.3, 0, 0]],
  // Cessna 172S: MTOW 1,111 kg, wing 16.2 m^2, VS 48 kt (89 km/h), Vy 74 kt (38 m/s) at 730 ft/min (3.7 m/s; brief 3.6),
  // max 126 kt (233 km/h), VNE 163 kt (302 km/h). Rotates at about 55 kt.
  cessna: [m => plane(m, { mass: 1111, S: 16.2, span: 11.0, stall: 89, vy: 38, climb: 3.6, vmax: 233, vne: 302, cd0: 0.032, e: 0.75, cl0: 0.3, tail: 0.21, floats: false }), 'plane', [0, 4, 15], [-1.5, 0, -1.6]],
  // Bell 47G-3B: max 169 km/h (105 mph), cruise ~135-140 km/h, climb 860 ft/min (4.4 m/s).
  helicopter: [m => heli(m, { top: 169, climb: 4.4 }), 'heli', [0, 5, 16], [-1.8, 0, -0.5]],
  // DHC-2 Beaver: MTOW 2,313 kg, wing 23.2 m^2, span 14.64 m, stall ~97 km/h (brief), max 255 km/h (158 mph, landplane),
  // climb 1,020 ft/min (5.2 m/s, landplane); cruise about 230 km/h falls out of the model.
  seaplane: [m => plane(m, { mass: 2313, S: 23.2, span: 14.64, stall: 97, vy: 41, climb: 5.2, vmax: 255, cd0: 0.042, e: 0.75, cl0: 0.35, tail: 0.3, floats: true }), 'plane', [0, 6, 19], [-2.3, 0, -1.5]],
  // Boats: top speeds per the brief (river boat 40, steamship 28 = 15 kt, yacht 50 km/h); t90 = seconds to reach 90% of top (inertia).
  riverboat: [m => boat(m, { top: 40, t90: 12, radius: 14, yawT: 0.5, draft: 0.35, half: 4.5, beam: 2.6, lift: 0.07, heel: 0.1, roll: 0.03, bob: 1, low: 0.5, spray: 1 }), 'water', [0, 4.5, 13], [-2.0, 0, 0]],
  steamliner: [m => boat(m, { top: 28, t90: 150, radius: 220, yawT: 10, draft: 2.5, half: 25, beam: 8, lift: 0, heel: -0.05, roll: 0.012, bob: 0.4, low: 0, spray: 1.2 }), 'water', [0, 26, 80], [-5.5, 0, 0]],
  yacht: [m => boat(m, { top: 50, t90: 35, radius: 70, yawT: 2, draft: 1.8, half: 14, beam: 7, lift: 0.04, heel: 0.05, roll: 0.02, bob: 0.7, low: 0.15, spray: 1.4 }), 'water', [0, 11, 38], [-4.5, 0, 0]],
};

export function createVehicle(kind, { color, decal } = {}) {
  const spec = VEHICLES.find(v => v.kind === kind);
  if (!spec) throw new Error(`Unknown vehicle kind: ${kind}`);
  const [phys, help, cam, exit] = CFG[kind];
  resetMats();
  const m = M[kind](color || spec.colors[0], typeof decal === 'number' ? spec.decals[decal] : decal); // the picker passes an index
  const p = phys(m);
  return {
    kind, class: spec.class, object: m.root,
    ...p,
    // 0..1 mud on the body (rises on mud and wet ground, washes off in water and rain); settable for tests and saves
    get dirt() { return m.dirt.value; }, set dirt(x) { m.dirt.value = Math.min(1, Math.max(0, +x || 0)); },
    controlsHelp: HELP[help],
    cameraOffset: new THREE.Vector3(...cam),
    exitOffset: new THREE.Vector3(...exit),
    dispose() {
      m.root.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(x => { x.map?.dispose(); x.dispose(); }); });
      m.root.removeFromParent();
      p.fx.removeFromParent(); p.fx.geometry.dispose(); p.fx.material.dispose();
    },
  };
}
