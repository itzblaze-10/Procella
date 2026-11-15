// Vehicle physics from real figures: tyre-model cars with an engine and gearbox, a lift/drag/thrust aeroplane,
// a tilt-to-move helicopter, and displacement boats. Yaw 0 faces north (-z); compass heading = -yaw.
import * as THREE from 'three';
import { particles } from './parts.js';

const G = 9.81, KMH = 3.6, RHO = 1.225, clamp = THREE.MathUtils.clamp;
const fwd = yaw => [-Math.sin(yaw), -Math.cos(yaw)];       // [x, z]; right vector is [-fz, fx]
const key = (k, ...codes) => codes.some(c => k[c]);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const H = (t, x, z) => { const h = +t.heightAt(x, z); return Number.isFinite(h) ? h : 0; }; // trust boundary
const lerpT = (tab, x) => { // piecewise-linear table [[x, y], ...]
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, b] = tab[i - 1], [c, d] = tab[i]; return b + (d - b) * (x - a) / (c - a); }
  return tab[tab.length - 1][1];
};

// Surfaces: [peak grip mu, rolling resistance Crr, looseness 0..1]. Typical published ranges for car tyres.
const SURF = {
  road: [1.0, 0.013, 0], rock: [0.8, 0.02, 0.15], grass: [0.6, 0.045, 0.4], dirt: [0.68, 0.035, 0.65],
  mud: [0.38, 0.08, 1], sand: [0.6, 0.16, 0.9], snow: [0.3, 0.05, 0.8], water: [0.45, 0.3, 1],
};
// Validated environment read (env is optional; the terrain itself knows surface and wetness when env is absent).
function ground(env, t, x, z) {
  let s = env?.surfaceAt ? env.surfaceAt(x, z) : t.surfaceAt ? t.surfaceAt(x, z) : H(t, x, z) < 0.3 ? 'water' : 'grass';
  if (!SURF[s]) s = 'grass';
  return s;
}
const wetOf = (env, t) => clamp(+(env?.wet ?? t.wet ?? 0) || 0, 0, 1);
const rainOf = env => clamp(+(env?.rain ?? 0) || 0, 0, 1);
function hit(env, x, z, r) { // validated collider query
  if (!env?.collide) return null;
  const c = env.collide(x, z, r);
  if (!c || ![c.nx, c.nz, c.depth].every(Number.isFinite) || c.depth <= 0) return null;
  const l = Math.hypot(c.nx, c.nz) || 1;
  return { nx: c.nx / l, nz: c.nz / l, depth: Math.min(c.depth, 5), material: c.material || 'stone' };
}

function findSpot(x, z, ok) { // spiral search for a valid start
  for (let r = 0; r <= 4000; r += 25) for (let a = 0; a < 16; a++) {
    const px = x + r * Math.cos(a * Math.PI / 8), pz = z + r * Math.sin(a * Math.PI / 8);
    if (ok(px, pz)) return [px, pz];
    if (!r) break;
  }
  return [x, z];
}

function animate(m, s, dt) {
  for (const w of m.wheels) { w.spin.rotation.x -= s.wheelU / w.r * dt; if (w.front) w.steer.rotation.y = s.steer; }
  for (const p of m.props) p.rotation.z += (8 + 230 * s.rpm) * dt;   // 2,700 rpm prop = 283 rad/s
  for (const r of m.rotors) r.rotation.z += (r.userData.rate || 38) * s.rpm * dt; // Bell 47 main rotor ~370 rpm
  for (const r of m.spinners) r.rotation.y += 2.5 * dt;
  for (const w of m.wake) { w.material.opacity = Math.min(0.6, Math.abs(s.u) / 14); w.scale.z = w.scale.x * (1 + Math.abs(s.u) * 0.6); }
}

// Shared shell: state, NaN guard, pose, dirt, particles, events, telemetry, place.
// step(s, dt, keys, terrain, env) runs the physics; settle() sets the start height.
function rig(m, step, spot, settle, extra = {}) {
  const o = m.root, s = {
    yaw: 0, pitch: 0, roll: 0, u: 0, v: 0, vy: 0, r: 0, thr: 0, steer: 0, speed: 0, gy: 0, t: 0, wheelU: 0,
    ground: true, status: 'Parked', rpm: 0, gear: 0, slip: 0, surface: 'grass', air: 0, stall: false,
  };
  const safe = new THREE.Vector3(), events = [], fx = particles(extra.particles || 700);
  s.emit = fx.emit;
  s.event = e => { if (events.length < 48) events.push(e); };
  const pose = () => { o.rotation.set(s.pitch, s.yaw, s.roll, 'YXZ'); safe.copy(o.position); };
  return {
    events, fx: fx.points,
    update(dt, keys, terrain, env) {
      dt = Math.min(dt, 0.05);
      if (!(dt > 0) || !terrain) return;
      s.t += dt;
      const n = Math.ceil(dt / 0.01);
      for (let i = 0; i < n; i++) step(s, dt / n, keys || {}, terrain, env);
      if (![o.position.x, o.position.y, o.position.z, s.yaw, s.pitch, s.roll, s.u, s.v, s.vy, s.r, s.thr, s.steer, s.rpm].every(Number.isFinite)) {
        o.position.copy(safe);
        Object.assign(s, { u: 0, v: 0, vy: 0, r: 0, pitch: 0, roll: 0, thr: 0, steer: 0, rpm: 0, yaw: Number.isFinite(s.yaw) ? s.yaw : 0 });
        s.vel?.set(0, 0, 0);
      }
      pose(); animate(m, s, dt);
      if (o.parent && fx.points.parent !== o.parent) o.parent.add(fx.points);
      fx.update(dt, (x, z) => Math.max(H(terrain, x, z), 0));
      o.updateMatrixWorld(); m.rootInv.value.copy(o.matrixWorld).invert();
    },
    telemetry: () => ({
      speedKmh: Math.abs(s.speed) * KMH, altitudeM: o.position.y, aglM: Math.max(0, o.position.y - s.gy),
      headingDeg: ((-s.yaw * 180 / Math.PI) % 360 + 360) % 360, throttle: s.thr, status: s.status,
      rpm: clamp(s.rpm, 0, 1), gear: s.gear, slip: clamp(s.slip, 0, 1), surface: s.surface, ground: s.ground,
      airspeedKmh: s.air * KMH, stall: s.stall,
    }),
    place(x, z, terrain, heading = 0) { // heading: compass radians (0 north, PI/2 east)
      Object.assign(s, { u: 0, v: 0, vy: 0, r: 0, thr: 0, pitch: 0, roll: 0, steer: 0, speed: 0, yaw: -heading || 0, ground: true, status: 'Parked', gear: 1, slip: 0 });
      s.vel?.set(0, 0, 0);
      [x, z] = findSpot(x, z, (a, b) => spot(terrain, a, b, s.yaw));
      o.position.set(x, 0, z); settle(s, terrain); pose();
      o.updateMatrixWorld(); m.rootInv.value.copy(o.matrixWorld).invert();
    },
  };
}

// Dirt: mud and wet ground cake it on, water washes it off, rain rinses slowly.
function soil(m, s, dt, surf, wet, rain, speed, inWater) {
  const d = m.dirt;
  let rate = 0;
  if (inWater) rate = -0.35;
  else if (s.ground && speed > 1) {
    const f = Math.min(1.6, speed / 10);
    rate = f * ({ mud: 0.014, dirt: 0.001 + 0.008 * wet, grass: 0.003 * wet, sand: 0.0005, snow: -0.004 }[surf] || 0) * (1 + rain);
  }
  rate -= 0.003 * rain;
  d.value = clamp(d.value + rate * dt, 0, 1);
}

// Spray from a contact point at world (x, y, z), moving at world velocity (vx, vz), on a surface.
function spray(s, surf, wet, x, y, z, vx, vz, power, dt) {
  if (power <= 0.02) return;
  const R = Math.random, rate = power * 60 * dt;
  const n = Math.floor(rate) + (R() < rate % 1 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const kx = -vx * 0.25 + (R() - 0.5) * 2, kz = -vz * 0.25 + (R() - 0.5) * 2;
    if (surf === 'mud' || ((surf === 'dirt' || surf === 'grass') && wet > 0.5)) { // clods, thrown up off the tread
      const c = 0.12 + R() * 0.1;
      s.emit(x, y + 0.1, z, kx, 1.5 + R() * 3.5 * power, kz, 1.4, 0.07 + R() * 0.09, [c, c * 0.75, c * 0.5, 1], 9.81);
    } else if (surf === 'dirt' || surf === 'sand' || surf === 'grass') { // dust plume
      const c = surf === 'sand' ? [0.75, 0.66, 0.5] : surf === 'grass' ? [0.5, 0.45, 0.33] : [0.6, 0.5, 0.38];
      s.emit(x, y + 0.2, z, kx * 0.5, 0.4 + R() * 0.8, kz * 0.5, 2.2 + R() * 1.5, 0.5, [...c, 0.32], 0.15, 1.6, 0.9);
    } else if (surf === 'snow') {
      s.emit(x, y + 0.15, z, kx, 1 + R() * 2.5, kz, 1.4, 0.15 + R() * 0.15, [0.95, 0.97, 1, 0.75], 6, 0.4, 0.6);
    } else if (surf === 'water') {
      s.emit(x, y + 0.1, z, kx * 1.3, 1.5 + R() * 3 * power, kz * 1.3, 1.1, 0.12 + R() * 0.12, [0.88, 0.93, 0.97, 0.7], 9.81, 0.5, 0.3);
    } else if (surf === 'road' && s.slip > 0.4) { // tyre smoke
      s.emit(x, y + 0.2, z, kx * 0.3, 0.6, kz * 0.3, 2, 0.4, [0.82, 0.82, 0.82, 0.25], 0.1, 1.4, 1);
    }
  }
}

/* Land: a two-axle tyre model (slip angles, friction circle, weight transfer), an engine torque table
   and an automatic gearbox. P = {
     mass kg, wb wheelbase m, track m, hcg CG height m, CdA m^2, torque [[rpm, Nm]...], idle, redline,
     gears [], final, eta drivetrain efficiency, drive 'awd'|'fwd'|'rwd', loose (grip on loose ground x),
     road (grip on tarmac x), crr (rolling resistance on soft ground x), travel suspension m, rollK, pitchK rad per m/s^2,
     half body half length, width, steerMax rad, bias static rear weight fraction, rearGrip (wider rear tyres x), esc stability control } */
export function land(m, P) {
  const o = m.root, a = P.wb * P.bias, bb = P.wb - a, Iz = P.mass * (P.wb * P.wb + P.width * P.width) / 12 * 1.6;
  const ratio = g => (g < 0 ? P.gears[0] : P.gears[g - 1]) * P.final, wr = m.wheels[2]?.r || 0.35;
  const torque = rpm => lerpT(P.torque, rpm);
  const sample = (s, t) => {
    const [fx, fz] = fwd(s.yaw), b = P.track / 2, x = o.position.x, z = o.position.z;
    const h = (f, r) => H(t, x + fx * f - fz * r, z + fz * f + fx * r);
    const fl = h(P.wb / 2, -b), fr = h(P.wb / 2, b), rl = h(-P.wb / 2, -b), rr = h(-P.wb / 2, b);
    return { fl, fr, rl, rr, y: Math.max((fl + fr + rl + rr) / 4, H(t, x, z) - 0.15), pitch: Math.atan2(fl + fr - rl - rr, 2 * P.wb), roll: Math.atan2(fr + rr - fl - rl, 2 * P.track) };
  };
  let shift = 0, clutch = 0, wasWater = false, bodyP = 0, bodyPv = 0, bodyR = 0, bodyRv = 0, ax = 0, ay = 0, gq = null;
  const step = (s, dt, k, t, env) => {
    const thIn = key(k, 'KeyW', 'ArrowUp'), brIn = key(k, 'KeyS', 'ArrowDown'), hb = !!k.Space;
    const st = key(k, 'KeyA', 'ArrowLeft') - key(k, 'KeyD', 'ArrowRight');
    const surf = s.surface = ground(env, t, o.position.x, o.position.z), wet = wetOf(env, t), rain = rainOf(env);
    const [mu0, crr0, L] = SURF[surf];
    const looseMul = 1 + (P.loose - 1) * L + (P.road - 1) * (1 - L);
    const mu = mu0 * looseMul * (1 - 0.25 * wet * L) * (1 - 0.15 * rain * (1 - L));
    const crr = crr0 * (L > 0.3 ? P.crr : 1);

    // gearbox: reverse when stopped and braking; automatic shifts with a short torque gap
    if (brIn && s.u < 0.5 && s.gear > 0 && !thIn) s.gear = -1;
    if (thIn && s.gear < 0 && s.u > -0.5) s.gear = 1;
    const reversing = s.gear < 0, want = reversing ? brIn : thIn;
    s.thr = damp(s.thr, want ? 1 : 0, 8, dt);
    const wheelRpm = Math.abs(s.u) / wr * 60 / (2 * Math.PI), eRpm = wheelRpm * ratio(s.gear);
    if (shift > 0) shift -= dt;
    else if (s.gear > 0 && s.ground) {
      if (eRpm > P.redline * 0.96 && s.gear < P.gears.length) { s.gear++; shift = P.shiftT || 0.3; s.event({ type: 'gear', gear: s.gear }); }
      else if (s.gear > 1 && eRpm * ratio(s.gear - 1) / ratio(s.gear) < P.redline * 0.7 && eRpm < P.redline * 0.42) { s.gear--; shift = 0.2; s.event({ type: 'gear', gear: s.gear }); }
    }
    // clutch slips below the launch rpm, so the engine never stalls
    const launch = P.idle + (P.redline * 0.5 - P.idle) * s.thr;
    clutch = eRpm < launch ? 1 : 0;
    const rpm = clamp(Math.max(eRpm, clutch ? launch : 0, P.idle), 0, P.redline * 1.02);
    s.rpm = damp(s.rpm, (shift > 0 ? rpm * 0.8 : rpm) / P.redline, 14, dt);
    let Fdrive = shift > 0 || rpm >= P.redline * 1.01 ? 0 : s.thr * torque(rpm) * ratio(s.gear) * P.eta / wr * (reversing ? -1 : 1);

    // loads with longitudinal weight transfer (ax from the last step)
    const W = P.mass * G * Math.cos(s.pitch), dN = P.mass * ax * P.hcg / P.wb;
    const Nf = clamp(W * (1 - P.bias) - dN, 0.1 * W, 0.9 * W), Nr = W - Nf;
    const driven = P.drive === 'awd' ? W : P.drive === 'fwd' ? Nf : Nr;
    const fwdLim = mu * driven;
    s.slip = 0;
    if (Math.abs(Fdrive) > fwdLim) { s.slip = Math.min(1, (Math.abs(Fdrive) / fwdLim - 1) * 1.5); Fdrive = Math.sign(Fdrive) * fwdLim * (1 - 0.2 * s.slip); }
    // brakes: footbrake on all four (ABS keeps it at the grip limit), handbrake locks the rears
    const dir = Math.sign(s.u) || 0;
    let Fbrake = 0, rearLock = 0;
    if (brIn && !reversing && s.u > 0.1) Fbrake = mu * W * 0.97;
    if (thIn && reversing && s.u < -0.1) Fbrake = mu * W * 0.97;
    if (hb) { Fbrake = Math.max(Fbrake, mu * Nr * 0.9); rearLock = Math.abs(s.u) > 1 ? 1 : 0; if (rearLock) s.slip = Math.max(s.slip, 0.8); }
    const Froll = crr * W * dir * Math.min(1, Math.abs(s.u) * 2), Faero = 0.5 * RHO * P.CdA * s.u * Math.abs(s.u);
    const Fslope = P.mass * G * Math.sin(s.pitch);

    // lateral: slip angles on a bicycle model; front steer wheel angle shrinks with speed for control
    s.steer = damp(s.steer, st * P.steerMax / (1 + (s.u / 22) ** 2), 6, dt);
    let Fyf = 0, Fyr = 0;
    if (s.ground) {
      const us = Math.max(Math.abs(s.u), 2), vf = s.v - s.r * a, vr = s.v + s.r * bb;
      const cs = Math.cos(s.steer), sn = Math.sin(s.steer);
      const af = Math.atan2(vf * cs + s.u * sn, us), ar = Math.atan2(vr, us);
      const useF = Math.min(0.95, Math.abs(Fdrive) * (P.drive === 'rwd' ? 0 : P.drive === 'fwd' ? 1 : 0.5) / (mu * Nf + 1));
      const useR = rearLock ? 0.85 : Math.min(0.95, Math.abs(Fdrive) * (P.drive === 'fwd' ? 0 : P.drive === 'rwd' ? 1 : 0.5) / (mu * Nr + 1));
      // friction circle, softened (game aid) so full throttle in a bend drifts instead of spinning
      const muR = mu * (P.rearGrip || 1), capF = mu * Nf * Math.sqrt(1 - 0.6 * useF * useF), capR = muR * Nr * Math.sqrt(1 - 0.6 * useR * useR);
      Fyf = -capF * Math.tanh(14 * af * (mu * Nf) / (capF + 1) / mu);   // cornering stiffness ~14 N/rad per N of load
      Fyr = -capR * Math.tanh(14 * ar * (muR * Nr) / (capR + 1) / muR);
      s.slip = Math.max(s.slip, clamp((Math.abs(ar) - 0.08) * 5, 0, 1), clamp((Math.abs(af) - 0.12) * 4, 0, 1) * 0.7);
    }
    // integrate in the body frame (u forward, v right, r yaw rate, left positive)
    if (s.ground) {
      const Fx = Fdrive - Froll - Faero - Fslope + Fyf * Math.sin(s.steer);
      const du = Fx / P.mass - s.v * s.r;
      const brakeDv = Fbrake / P.mass * dt;
      s.u += du * dt;
      if (Math.abs(s.u) <= brakeDv && Fbrake > 0) s.u = 0; else s.u -= Math.sign(s.u) * brakeDv;
      if (!thIn && !brIn && Math.abs(s.u) < 0.15 && Math.abs(Fslope) < mu * W * 0.6) s.u = 0; // parked: tyres hold on a hill
      ax = damp(ax, du - (Fbrake / P.mass) * dir, 10, dt);
      const lat = (Fyf * Math.cos(s.steer) + Fyr) / P.mass - G * Math.sin(s.roll);
      s.v += (lat + s.u * s.r) * dt;
      ay = damp(ay, lat, 10, dt);
      s.r += (-a * Fyf * Math.cos(s.steer) + bb * Fyr) / Iz * dt;
      if (P.esc && !hb) { // stability control: trims yaw rate beyond what the steering asks for
        const rk = Math.abs(s.u * Math.tan(s.steer) / P.wb) * 1.15 + 0.05;
        s.r -= (s.r - clamp(s.r, -rk, rk)) * Math.min(1, 6 * dt);
      }
      if (Math.abs(s.u) < 0.5 && Math.abs(s.v) < 0.5) { s.v = damp(s.v, 0, 10, dt); s.r = damp(s.r, 0, 10, dt); }
    } else { s.r *= Math.exp(-0.5 * dt); ax = damp(ax, 0, 4, dt); ay = damp(ay, 0, 4, dt); s.u -= Faero / P.mass * dt; }
    s.yaw += s.r * dt;

    const [fx, fz] = fwd(s.yaw);
    let vx = fx * s.u - fz * s.v, vz = fz * s.u + fx * s.v;
    const d = Math.sign(s.u) * P.half, nx = o.position.x + vx * dt, nz = o.position.z + vz * dt;
    if (s.u && H(t, nx + fx * d, nz + fz * d) < -1) { // deep water ahead: stop at the shore
      if (Math.abs(s.u) > 3) s.event({ type: 'splash', v: Math.abs(s.u) });
      s.u = 0; s.v *= 0.5; vx = vz = 0;
    } else { o.position.x = nx; o.position.z = nz; }
    // buildings and trees: two circles along the body
    for (const off of [P.wb * 0.45, -P.wb * 0.45]) {
      const c = hit(env, o.position.x + fx * off, o.position.z + fz * off, P.width * 0.55);
      if (!c) continue;
      o.position.x += c.nx * c.depth; o.position.z += c.nz * c.depth;
      const vn = vx * c.nx + vz * c.nz;
      if (vn < 0) {
        vx -= 1.25 * vn * c.nx; vz -= 1.25 * vn * c.nz;
        s.u = vx * fx + vz * fz; s.v = -vx * fz + vz * fx; s.r += 0.15 * vn * Math.sign(off) * (c.nx * fz - c.nz * fx);
        if (-vn > 1.5) s.event({ type: 'crash', v: -vn, material: c.material });
      }
    }

    // vertical: carry the terrain's vertical rate so crests launch jumps
    const g = gq = sample(s, t);
    s.vy -= G * dt;
    let y = o.position.y + s.vy * dt;
    if (y <= g.y) {
      if (!s.ground && s.vy < -2) s.event({ type: 'land', v: -s.vy });
      if (!s.ground && s.vy < -4) bodyPv -= s.vy * 0.05;
      s.vy = clamp((g.y - o.position.y) / dt, -20, 9);
      y = g.y;
    }
    o.position.y = y; s.ground = y - g.y < 0.12; s.gy = g.y;
    s.pitch = damp(s.pitch, s.ground ? g.pitch : s.pitch - 0.02, s.ground ? 12 : 1, dt);
    s.roll = damp(s.roll, s.ground ? g.roll : s.roll * 0.98, s.ground ? 12 : 1, dt);

    // sprung body: damped springs driven by weight transfer (squat, dive, lean out of the turn)
    bodyPv += (-(bodyP - clamp(ax * P.pitchK, -0.08, 0.08)) * 90 - bodyPv * 11) * dt; bodyP += bodyPv * dt;
    bodyRv += (-(bodyR - clamp(ay * P.rollK, -0.12, 0.12)) * 70 - bodyRv * 9) * dt; bodyR += bodyRv * dt;
    m.body.rotation.set(bodyP, 0, bodyR);

    s.speed = Math.hypot(s.u, s.v); s.wheelU = rearLock && s.ground ? 0 : s.u * (1 + s.slip * 0.5 * Math.sign(Fdrive));
    const inWater = surf === 'water' || H(t, o.position.x, o.position.z) < 0.2;
    if (inWater && !wasWater && s.speed > 2) s.event({ type: 'splash', v: s.speed });
    wasWater = inWater;
    s.status = !s.ground ? 'Airborne' : s.speed < 0.3 ? 'Parked' : s.slip > 0.75 ? 'Sliding' : reversing ? 'Reversing' : 'Driving';
    soil(m, s, dt, surf, wet, rain, s.speed, inWater);
    if (s.ground && s.speed > 1.5) for (const w of m.wheels) if (!w.front || P.drive !== 'rwd') {
      const wx = o.position.x + fx * -w.z - fz * w.x, wz = o.position.z + fz * -w.z + fx * w.x;
      spray(s, surf, wet, wx, o.position.y, wz, vx, vz, Math.min(1.5, s.speed / 14 + s.slip) * (L + (surf === 'road' ? 1 : 0)) * (w.front ? 0.6 : 1), dt);
    }
  };
  // suspension: each wheel follows its own patch of ground within its travel
  const after = s => {
    if (!gq) return;
    const e = ((gq.fl + gq.rr) - (gq.fr + gq.rl)) / 4; // twist of the four contact points out of their best plane
    for (const w of m.wheels) {
      const diag = (w.x < 0) === (w.z < 0) ? 1 : -1;
      const tgt = s.ground ? clamp(e * diag, -P.travel, P.travel) : -P.travel;
      w.steer.position.y = damp(w.steer.position.y, w.y0 + tgt, 18, 0.016);
    }
  };
  const settle = (s, t) => { const g = sample(s, t); o.position.y = s.gy = g.y; s.pitch = g.pitch; s.roll = g.roll; s.gear = 1; };
  const r = rig(m, (s, dt, k, t, env) => { step(s, dt, k, t, env); after(s); }, (t, x, z) => H(t, x, z) >= 0.5, settle);
  return r;
}

/* Fixed wing (Cessna 172, DHC-2 Beaver on floats): lift, drag and thrust from published figures.
   P = { mass kg, S wing area m^2, span m, stall km/h (sets CLmax), vy best-climb m/s, climb m/s, vmax km/h,
         vne km/h, cd0, e Oswald, cl0 lift at zero body angle, tail max rotation angle, floats, gearH } */
export function plane(m, P) {
  const o = m.root, W = P.mass * G, Vs = P.stall / KMH, AR = P.span * P.span / P.S, kI = 1 / (Math.PI * P.e * AR);
  const CLa = 2 * Math.PI * AR / (AR + 2), CLmax = 2 * W / (RHO * P.S * Vs * Vs), aStall = (CLmax - P.cl0) / CLa;
  const drag = (V, CL) => 0.5 * RHO * V * V * P.S * (P.cd0 + kI * CL * CL);
  const level = V => W / (0.5 * RHO * V * V * P.S);
  // thrust falls linearly with airspeed; the line is fitted so full power gives the published climb at Vy and the published top speed
  const Vm = P.vmax / KMH, Ty = drag(P.vy, level(P.vy)) + W * P.climb / P.vy, Tm = drag(Vm, level(Vm));
  const slope = (Ty - Tm) / (Vm - P.vy), T0 = Ty + slope * P.vy;
  const thrust = V => Math.max(0, T0 - slope * V);
  const vel = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), up = new THREE.Vector3(), nose = new THREE.Vector3(), Ld = new THREE.Vector3();
  const floor = (t, x, z) => { const h = H(t, x, z); return h < 0.5 ? Math.max(h, P.floats ? -0.25 : 0) : h; };
  let gp = 0, wasAir = false;
  const step = (s, dt, k, t, env) => {
    s.vel = vel;
    const x = o.position.x, z = o.position.z, wet = H(t, x, z) < 0.3, surf = s.surface = wet ? 'water' : ground(env, t, x, z);
    s.thr = clamp(s.thr + (key(k, 'KeyW') - key(k, 'KeyS')) * 0.5 * dt, 0, 1);
    s.rpm = damp(s.rpm, 0.25 + 0.75 * s.thr, 3, dt);
    const pIn = key(k, 'ArrowDown') - key(k, 'ArrowUp'), rIn = key(k, 'ArrowLeft') - key(k, 'ArrowRight'), yIn = key(k, 'KeyA') - key(k, 'KeyD');
    const V = vel.length(), qd = 0.5 * RHO * V * V, auth = clamp(V / (Vs * 1.2), 0, 1);
    const [fx, fz] = fwd(s.yaw);
    if (s.ground) {
      // rotate for take-off once the elevator has air over it; the nose wheel / floats come back down otherwise
      gp = pIn > 0 && V > 0.7 * Vs ? Math.min(P.tail, gp + 0.12 * dt) : damp(gp, 0, 2, dt);
      s.aoa = gp;
    } else {
      s.aoa = clamp((s.aoa ?? 0) + (pIn * 0.3 * auth - (pIn ? 0 : s.aoa * 0.04)) * dt, -0.2, 0.45);
      if (s.stall) s.aoa -= 0.5 * dt; // the nose drops at the stall
      s.roll += (rIn ? rIn * 1.1 * auth : -s.roll * 0.5) * dt; // hands-off: rolls level (game aid)
      s.roll = clamp(s.roll, -1.15, 1.15);
    }
    // attitude: nose along the flight path plus angle of attack; heading follows the horizontal velocity (coordinated)
    const gamma = V > 1 ? Math.asin(clamp(vel.y / V, -1, 1)) : 0;
    s.gd = s.ground ? 0 : damp(s.gd || 0, (gamma - (s.gp ?? gamma)) / dt, 4, dt); s.gp = gamma;
    // pitch damping: the tail sees the flight path bending, which damps the phugoid (speed/height swing)
    const aoa = s.aoa - (s.ground ? 0 : clamp(1.5 * s.gd, -0.1, 0.1));
    s.stall = !s.ground && aoa > aStall;
    const CL = aoa <= aStall ? P.cl0 + CLa * aoa : Math.max(CLmax * 0.65, CLmax - 3 * (aoa - aStall));
    s.pitch = s.ground ? damp(s.pitch, gp + Math.atan2(floor(t, x + fx * 2, z + fz * 2) - floor(t, x - fx * 2, z - fz * 2), 4), 8, dt) : gamma + s.aoa * Math.cos(s.roll);
    q.setFromEuler(e.set(s.pitch, s.yaw, s.roll, 'YXZ'));
    up.set(0, 1, 0).applyQuaternion(q); nose.set(0, 0, -1).applyQuaternion(q);
    const acc = new THREE.Vector3(0, -G, 0).addScaledVector(nose, thrust(V) * s.thr / P.mass);
    if (V > 0.5) {
      const d = vel.clone().divideScalar(V);
      Ld.copy(up).addScaledVector(d, -up.dot(d)).normalize();
      acc.addScaledVector(Ld, qd * P.S * CL / P.mass);
      acc.addScaledVector(d, -(drag(V, CL) + (s.stall ? qd * P.S * 0.08 : 0)) / P.mass);
      if (!s.ground) vel.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yIn * 0.12 * auth * dt); // rudder
    }
    vel.addScaledVector(acc, dt);
    if (s.ground) {
      // tyres or floats: no sideways slip, rolling or hydrodynamic drag, steering, brakes
      let u = vel.x * fx + vel.z * fz;
      const lift = qd * P.S * CL, N = Math.max(0, W - lift);
      const mu = wet ? (P.floats ? 0.03 + 0.12 * Math.exp(-(((Math.abs(u) - 9) / 5) ** 2)) : 0.6) : P.floats ? 0.15 : 0.01 + SURF[surf][1] + (k.Space ? 0.45 : 0);
      const du = mu * N / P.mass * dt;
      u = Math.abs(u) <= du ? 0 : u - Math.sign(u) * du;
      if (s.thr < 0.05 && Math.abs(u) < 0.6) u = 0;
      vel.x = fx * u; vel.z = fz * u;
      s.yaw += yIn * (wet ? 0.35 : 0.6) * clamp(Math.abs(u) / 3, 0, 1) * dt; // nose wheel / water rudder
      s.roll = damp(s.roll, 0, 6, dt);
      if (wet && Math.abs(u) > 4) spray(s, 'water', 0, x + fz * 1.5, 0, z - fx * 1.5, vel.x, vel.z, Math.abs(u) / 25, dt);
      else if (!wet && SURF[surf][2] > 0.5 && s.thr > 0.3) spray(s, surf, wetOf(env, t), x - fx * 3, H(t, x, z), z - fz * 3, -fx * 15, -fz * 15, s.thr * 0.6, dt);
    } else if (Math.hypot(vel.x, vel.z) > 3) s.yaw = Math.atan2(-vel.x, -vel.z);
    o.position.addScaledVector(vel, dt);
    // terrain and colliders: crash-proof clamp
    const f = floor(t, o.position.x, o.position.z);
    if (o.position.y <= f) {
      o.position.y = f;
      if (vel.y < -0.3 && wasAir) {
        const hard = -vel.y > (P.floats ? 3.5 : 3) || Math.abs(s.roll) > 0.35 || s.pitch < -0.15;
        s.event(hard ? { type: 'crash', v: -vel.y + vel.length() * 0.2, material: wet ? 'water' : 'stone' } : wet ? { type: 'splash', v: -vel.y } : { type: 'land', v: -vel.y });
        if (hard) vel.multiplyScalar(0.3);
        gp = Math.max(0, Math.min(P.tail, s.pitch));
      }
      vel.y = Math.max(0, vel.y);
    }
    if (o.position.y - f < 15) {
      const c = hit(env, o.position.x, o.position.z, P.span * 0.3);
      if (c) {
        o.position.x += c.nx * c.depth; o.position.z += c.nz * c.depth;
        const vn = vel.x * c.nx + vel.z * c.nz;
        if (vn < 0) { s.event({ type: 'crash', v: -vn, material: c.material }); vel.multiplyScalar(0.25); vel.x -= vn * c.nx; vel.z -= vn * c.nz; }
      }
    }
    s.ground = o.position.y - f < 0.05 && vel.y < 0.5; wasAir = !s.ground;
    s.gy = Math.max(f, 0); s.speed = s.air = vel.length(); s.u = Math.hypot(vel.x, vel.z); s.wheelU = s.ground ? s.u : 0;
    const afloat = s.ground && wet;
    m.body.position.y = afloat ? 0.05 * Math.sin(s.t * 1.6) : 0;
    s.status = s.ground ? (afloat ? 'On water' : s.u < 0.5 ? 'Parked' : 'Taxiing') : s.stall ? 'Stalling' : P.vne && s.air > P.vne / KMH ? 'Overspeed' : 'Airborne';
    soil(m, s, dt, surf, wetOf(env, t), rainOf(env), s.u, wet || !s.ground && rainOf(env) > 0.5);
  };
  const r = rig(m, step, (t, x, z) => P.floats || H(t, x, z) >= 0.5, (s, t) => { o.position.y = s.gy = floor(t, o.position.x, o.position.z); vel.set(0, 0, 0); gp = 0; s.aoa = 0; });
  r.aero = { CLmax, aStall, T0, slope };
  return r;
}

/* Helicopter (Bell 47G): the rotor disc tilts to move, like the real thing; tilt sets acceleration g*tan(tilt)
   against quadratic drag, sized so full forward cyclic tops out at the published 169 km/h. P = { top km/h, climb m/s } */
export function heli(m, P) {
  const o = m.root, vmax = P.top / KMH, tiltMax = 0.24, lin = 0.04, kq = (G * Math.tan(tiltMax) - lin * vmax) / (vmax * vmax);
  const vel = new THREE.Vector3();
  let tf = 0, tl = 0, wasAir = false;
  const step = (s, dt, k, t, env) => {
    s.vel = vel;
    const col = key(k, 'Space') - key(k, 'ShiftLeft', 'ShiftRight'), cyc = key(k, 'KeyW') - key(k, 'KeyS');
    const lat = key(k, 'ArrowRight') - key(k, 'ArrowLeft'), yIn = key(k, 'KeyA') - key(k, 'KeyD');
    const x = o.position.x, z = o.position.z, f = Math.max(H(t, x, z), 0), wet = H(t, x, z) < 0.3;
    s.rpm = damp(s.rpm, s.ground && col <= 0 && s.rpm < 0.95 ? 0.35 : 1, 0.6, dt); // rotor spools up when you pull collective
    s.thr = damp(s.thr, s.ground ? 0.2 : 0.55 + 0.35 * col + 0.1 * Math.abs(cyc), 3, dt);
    const [fx, fz] = fwd(s.yaw), u = vel.x * fx + vel.z * fz, v = -vel.x * fz + vel.z * fx;
    // cyclic: commanded disc tilt; hands off, it tilts against the drift to settle into a hover (game aid)
    tf = damp(tf, s.ground ? 0 : cyc ? cyc * tiltMax : clamp(-u * 0.04, -tiltMax, tiltMax), 2.5, dt);
    tl = damp(tl, s.ground ? 0 : lat ? lat * tiltMax * 0.8 : clamp(-v * 0.05, -tiltMax, tiltMax), 2.5, dt);
    const lift = s.rpm > 0.9 ? 1 : 0, au = G * Math.tan(tf) * lift, av = G * Math.tan(tl) * lift;
    vel.x += (fx * au - fz * av) * dt; vel.z += (fz * au + fx * av) * dt;
    const hs = Math.hypot(vel.x, vel.z);
    if (hs > 0) { const dv = (lin * hs + kq * hs * hs) * dt; const sc = Math.max(0, hs - dv) / hs; vel.x *= sc; vel.z *= sc; }
    const vyT = s.rpm > 0.9 ? (col > 0 ? P.climb : col < 0 ? -5 : 0) : -G;
    vel.y = damp(vel.y, vyT, s.rpm > 0.9 ? 1.6 : 0.5, dt);
    s.r = damp(s.r, yIn * 0.9, 3, dt); s.yaw += s.r * dt;
    s.pitch = damp(s.pitch, -tf * 0.9, 4, dt); s.roll = damp(s.roll, -tl * 0.9, 4, dt);
    o.position.addScaledVector(vel, dt);
    const fl = Math.max(H(t, o.position.x, o.position.z), 0);
    if (o.position.y <= fl) {
      o.position.y = fl;
      if (wasAir && vel.y < -0.5) s.event(-vel.y > 4 || hs > 12 ? { type: 'crash', v: -vel.y + hs * 0.3, material: wet ? 'water' : 'stone' } : { type: wet ? 'splash' : 'land', v: -vel.y });
      vel.y = Math.max(0, vel.y); vel.x *= Math.exp(-6 * dt); vel.z *= Math.exp(-6 * dt);
    }
    const c = o.position.y - fl < 12 && hit(env, o.position.x, o.position.z, 5.6);
    if (c) { o.position.x += c.nx * c.depth; o.position.z += c.nz * c.depth; const vn = vel.x * c.nx + vel.z * c.nz; if (vn < 0) { s.event({ type: 'crash', v: -vn, material: c.material }); vel.multiplyScalar(0.3); } }
    s.ground = o.position.y - fl < 0.05; wasAir = !s.ground; s.gy = fl;
    s.u = hs; s.speed = s.air = vel.length();
    s.surface = wet ? 'water' : ground(env, t, x, z);
    s.status = s.ground ? (hs < 0.5 ? 'Parked' : 'Taxiing') : hs < 2 ? 'Hovering' : 'Airborne';
    // downwash: dust, snow or spray ringing out under the rotor when low
    const agl = o.position.y - fl;
    if (s.rpm > 0.8 && agl < 12) {
      const sw = s.surface, pw = (1 - agl / 12) * (SURF[sw][2] + (sw === 'water' ? 0.5 : 0));
      for (let i = 0; i < pw * 40 * dt; i++) {
        const a = Math.random() * 6.283, rr = 2 + Math.random() * 3, px = o.position.x + Math.cos(a) * rr, pz = o.position.z + Math.sin(a) * rr;
        spray(s, sw === 'mud' ? 'dirt' : sw, 0, px, fl, pz, -Math.cos(a) * 30, -Math.sin(a) * 30, 0.6, 0.05);
      }
    }
    soil(m, s, dt, s.surface, wetOf(env, t), rainOf(env), hs, wet);
  };
  return rig(m, step, (t, x, z) => H(t, x, z) >= 0.5, (s, t) => { o.position.y = s.gy = Math.max(H(t, o.position.x, o.position.z), 0); vel.set(0, 0, 0); s.rpm = 0; });
}

/* Boats: thrust against quadratic hull drag. P = { top km/h, t90 s to 90% of top speed (inertia), radius m min turning
   radius, yawT s rudder response, draft, half length, beam, lift bow rise rad, heel rad, bob, low low-speed turn (outboard/twin screws) } */
export function boat(m, P) {
  const o = m.root, vmax = P.top / KMH, A = 1.47 * vmax / P.t90, shore = 0.5 - 0.6 * P.draft; // deep hulls ground earlier
  const step = (s, dt, k, t, env) => {
    const th = key(k, 'KeyW', 'ArrowUp') - key(k, 'KeyS', 'ArrowDown'), st = key(k, 'KeyA', 'ArrowLeft') - key(k, 'KeyD', 'ArrowRight');
    s.thr = damp(s.thr, th, 1.5, dt); s.rpm = damp(s.rpm, 0.2 + 0.8 * Math.abs(s.thr), 2, dt);
    s.u += A * (1.05 * s.thr * (s.thr < 0 ? 0.45 : 1) - s.u * Math.abs(s.u) / (vmax * vmax) - 0.05 * s.u / vmax) * dt; // quadratic hull drag, small linear skin term so it comes to rest
    s.steer = damp(s.steer, st, 3, dt);
    const rT = s.steer * (Math.abs(s.u) / P.radius + P.low * Math.abs(s.thr)) * (s.u < -0.2 ? -1 : 1);
    s.r = damp(s.r, rT, 1 / P.yawT, dt); s.yaw += s.r * dt;
    s.v = damp(s.v, s.r * s.u * 0.08 * P.half / 5, 1.5, dt); // hull skids a little in a turn
    const [fx, fz] = fwd(s.yaw), d = (s.u < 0 ? -1 : 1) * P.half;
    const vx = fx * s.u - fz * s.v, vz = fz * s.u + fx * s.v, nx = o.position.x + vx * dt, nz = o.position.z + vz * dt;
    if (H(t, nx + fx * d, nz + fz * d) >= shore) { // shore ahead: run aground
      if (Math.abs(s.u) > 1.5) s.event({ type: 'crash', v: Math.abs(s.u), material: 'stone' });
      s.u = 0; s.v = 0;
    } else { o.position.x = nx; o.position.z = nz; }
    for (const off of [P.half * 0.6, 0, -P.half * 0.6]) {
      const c = hit(env, o.position.x + fx * off, o.position.z + fz * off, P.beam * 0.5);
      if (!c) continue;
      o.position.x += c.nx * c.depth; o.position.z += c.nz * c.depth;
      const vn = vx * c.nx + vz * c.nz;
      if (vn < 0) { if (-vn > 1) s.event({ type: 'crash', v: -vn, material: c.material }); s.u *= 0.3; }
    }
    const f = s.u / vmax, rain = rainOf(env);
    o.position.y = -P.draft + 0.12 * P.bob * (1 + rain) * Math.sin(s.t * 1.4);
    s.pitch = P.lift * f * Math.abs(f) + 0.015 * P.bob * (1 + rain) * Math.sin(s.t * 1.1);
    s.roll = P.roll * (1 + rain) * Math.sin(s.t * 0.8) + P.heel * s.steer * f * Math.abs(f);
    s.gy = 0; s.speed = s.u; s.surface = 'water'; s.ground = true; s.status = Math.abs(s.u) < 0.2 ? 'Moored' : 'On water';
    m.dirt.value = Math.max(0, m.dirt.value - 0.3 * dt);
    // bow spray and stern wash
    if (Math.abs(s.u) > 2) {
      const pw = Math.abs(f) * P.spray;
      for (const sd of [-1, 1]) spray(s, 'water', 0, o.position.x + fx * P.half * 0.75 - fz * sd * P.beam * 0.35, 0, o.position.z + fz * P.half * 0.75 + fx * sd * P.beam * 0.35, -fz * sd * 6 + vx * 0.6, fx * sd * 6 + vz * 0.6, pw, dt);
      spray(s, 'water', 0, o.position.x - fx * P.half, 0, o.position.z - fz * P.half, vx * 1.6, vz * 1.6, pw * 0.7, dt);
    }
    m.smoke?.(s, dt, o);
  };
  const spot = (t, x, z, yaw) => { const [fx, fz] = fwd(yaw); return [-1, 0, 1].every(i => H(t, x + fx * i * P.half, z + fz * i * P.half) < shore); };
  return rig(m, step, spot, () => { o.position.y = -P.draft; }, { particles: m.smoke ? 1400 : 700 });
}
