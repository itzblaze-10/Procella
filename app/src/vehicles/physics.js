// Arcade physics for land, fixed-wing, rotary and water vehicles. Yaw 0 faces north (-z); compass heading = -yaw.
import * as THREE from 'three';

const G = 9.81, KMH = 3.6, clamp = THREE.MathUtils.clamp;
const fwd = yaw => [-Math.sin(yaw), -Math.cos(yaw)];       // [x, z]; right vector is [-fz, fx]
const key = (k, ...codes) => codes.some(c => k[c]);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const H = (t, x, z) => { const h = +t.heightAt(x, z); return Number.isFinite(h) ? h : 0; }; // trust boundary

function findSpot(x, z, ok) { // spiral search for a valid start
  for (let r = 0; r <= 4000; r += 25) for (let a = 0; a < 16; a++) {
    const px = x + r * Math.cos(a * Math.PI / 8), pz = z + r * Math.sin(a * Math.PI / 8);
    if (ok(px, pz)) return [px, pz];
    if (!r) break;
  }
  return [x, z];
}

function animate(m, s, dt) {
  for (const w of m.wheels) { w.spin.rotation.x -= s.u / w.r * dt; if (w.front) w.steer.rotation.y = s.steer; }
  for (const p of m.props) p.rotation.z += (6 + 60 * s.thr) * dt;
  for (const r of m.rotors) r.rotation.z += 45 * s.thr * dt;
  for (const r of m.spinners) r.rotation.y += 2.5 * dt;
  for (const w of m.wake) { w.material.opacity = Math.min(0.7, Math.abs(s.u) / 12); w.scale.z = w.scale.x * (1 + Math.abs(s.u) * 0.6); }
  m.smoke?.(dt, s.u);
}

// Shared shell: state, NaN guard, pose, telemetry, place. step() runs the physics, settle() sets the start height.
function rig(m, step, spot, settle) {
  const o = m.root, s = { yaw: 0, pitch: 0, roll: 0, u: 0, v: 0, vy: 0, thr: 0, steer: 0, squash: 0, speed: 0, gy: 0, t: 0, ground: true, status: 'Parked' };
  const safe = new THREE.Vector3();
  const pose = () => { o.rotation.set(s.pitch, s.yaw, s.roll, 'YXZ'); safe.copy(o.position); };
  return {
    update(dt, keys, terrain) {
      dt = Math.min(dt, 0.05);
      if (!(dt > 0) || !terrain) return;
      s.t += dt;
      step(s, dt, keys || {}, terrain);
      if (![o.position.x, o.position.y, o.position.z, s.yaw, s.pitch, s.roll, s.u, s.v, s.vy, s.thr, s.steer].every(Number.isFinite)) {
        o.position.copy(safe);
        Object.assign(s, { u: 0, v: 0, vy: 0, pitch: 0, roll: 0, thr: 0, steer: 0, yaw: Number.isFinite(s.yaw) ? s.yaw : 0 });
      }
      pose(); animate(m, s, dt);
    },
    telemetry: () => ({
      speedKmh: Math.abs(s.speed) * KMH, altitudeM: o.position.y, aglM: Math.max(0, o.position.y - s.gy),
      headingDeg: ((-s.yaw * 180 / Math.PI) % 360 + 360) % 360, throttle: s.thr, status: s.status,
    }),
    place(x, z, terrain, heading = 0) { // heading: compass radians (0 north, PI/2 east)
      Object.assign(s, { u: 0, v: 0, vy: 0, thr: 0, pitch: 0, roll: 0, steer: 0, squash: 0, speed: 0, yaw: -heading || 0, ground: true, status: 'Parked' });
      [x, z] = findSpot(x, z, (a, b) => spot(terrain, a, b, s.yaw));
      o.position.set(x, 0, z); settle(s, terrain); pose();
    },
  };
}

// Land: P = { top km/h, accel, wb wheelbase, track, half length, slope (hill penalty 0..1), grav, lift (crest launch) }
export function land(m, P) {
  const o = m.root, vmax = P.top / KMH;
  const sample = (s, t) => {
    const [fx, fz] = fwd(s.yaw), a = P.wb / 2, b = P.track / 2, x = o.position.x, z = o.position.z;
    const h = (f, r) => H(t, x + fx * f - fz * r, z + fz * f + fx * r);
    const fl = h(a, -b), fr = h(a, b), rl = h(-a, -b), rr = h(-a, b);
    return { y: Math.max((fl + fr + rl + rr) / 4, H(t, x, z)), pitch: Math.atan2(fl + fr - rl - rr, 2 * P.wb), roll: Math.atan2(fr + rr - fl - rl, 2 * P.track) };
  };
  const step = (s, dt, k, t) => {
    const th = key(k, 'KeyW', 'ArrowUp') - key(k, 'KeyS', 'ArrowDown'), st = key(k, 'KeyA', 'ArrowLeft') - key(k, 'KeyD', 'ArrowRight');
    s.thr = Math.max(0, th);
    if (s.ground) {
      if (k.Space) s.u -= Math.sign(s.u) * Math.min(Math.abs(s.u), 14 * dt);
      else if (th > 0) s.u += s.u < 0 ? 10 * dt : P.accel * (1 - s.u / vmax) * dt;
      else if (th < 0) s.u -= s.u > 0 ? 10 * dt : P.accel * 0.6 * (1 + s.u / 7) * dt; // reverse tops out at 25 km/h
      else s.u -= Math.sign(s.u) * Math.min(Math.abs(s.u), (0.5 + 0.01 * s.u * s.u) * dt);
      s.u -= G * Math.sin(s.pitch) * P.slope * dt;
      if (!th && Math.abs(s.u) < 0.3) s.u = 0;
    }
    s.steer = damp(s.steer, st * 0.6 / (1 + Math.abs(s.u) / 8), 8, dt);
    if (s.ground) { const lim = 14 / Math.max(Math.abs(s.u), 1); s.yaw += clamp(s.u / P.wb * Math.tan(s.steer), -lim, lim) * dt; }
    const [fx, fz] = fwd(s.yaw), d = Math.sign(s.u) * P.half;
    const nx = o.position.x + fx * s.u * dt, nz = o.position.z + fz * s.u * dt;
    if (s.u && H(t, nx + fx * d, nz + fz * d) < -1) s.u = 0; // deep water ahead: stop at the shore
    else { o.position.x = nx; o.position.z = nz; }
    const g = sample(s, t);
    s.vy -= G * P.grav * dt;
    let y = o.position.y + s.vy * dt;
    if (y <= g.y) { // on the ground: carry the terrain's vertical rate so crests launch jumps
      if (!s.ground && s.vy < -3) s.squash = Math.min(0.15, -s.vy * 0.015);
      s.vy = clamp((g.y - o.position.y) / dt, -20, 12) * P.lift;
      y = g.y;
    }
    o.position.y = y; s.ground = y - g.y < 0.25; s.gy = g.y;
    s.pitch = damp(s.pitch, s.ground ? g.pitch : -0.05, s.ground ? 10 : 1, dt);
    s.roll = damp(s.roll, s.ground ? g.roll : 0, s.ground ? 10 : 1, dt);
    s.squash = damp(s.squash, 0, 6, dt); m.body.position.y = -s.squash;
    s.speed = s.u;
    s.status = !s.ground ? 'Airborne' : Math.abs(s.u) < 0.3 ? 'Parked' : 'Driving';
  };
  const settle = (s, t) => { const g = sample(s, t); o.position.y = s.gy = g.y; s.pitch = g.pitch; s.roll = g.roll; };
  return rig(m, step, (t, x, z) => H(t, x, z) >= 0.5, settle);
}

// Fixed wing (Cessna, seaplane): P = { top, stall km/h, thrust m/s^2, floats }
export function plane(m, P) {
  const o = m.root, vmax = P.top / KMH, vst = P.stall / KMH, kd = P.thrust / (vmax * vmax);
  const floor = (t, x, z) => { const h = H(t, x, z); return h < 0.5 ? Math.max(h, P.floats ? -0.2 : 0) : h; };
  const step = (s, dt, k, t) => {
    const wet = H(t, o.position.x, o.position.z) < 0.5, beached = P.floats && s.ground && !wet;
    s.thr = clamp(s.thr + (key(k, 'KeyW') - key(k, 'KeyS')) * 0.6 * dt, 0, 1);
    const pIn = key(k, 'ArrowDown') - key(k, 'ArrowUp'), rIn = key(k, 'ArrowLeft') - key(k, 'ArrowRight'), yIn = key(k, 'KeyA') - key(k, 'KeyD');
    let drag = kd * s.u * s.u;
    if (s.ground) drag += beached ? 0.6 + 0.5 * s.u : wet ? (P.floats ? 0.2 + 0.0012 * s.u * s.u : 2 + 0.02 * s.u * s.u) : 0.15 + (k.Space ? 6 : 0);
    s.u = Math.max(0, s.u + (s.thr * P.thrust * (beached ? 0.25 : 1) - G * Math.sin(s.pitch) - drag) * dt);
    if (s.ground && s.thr < 0.05 && s.u < 1) s.u = 0; // parked: no rolling downhill
    const [fx, fz] = fwd(s.yaw);
    if (s.ground) {
      const slope = Math.atan2(floor(t, o.position.x + fx * 2, o.position.z + fz * 2) - floor(t, o.position.x - fx * 2, o.position.z - fz * 2), 4);
      s.pitch = pIn > 0 && s.u > vst ? s.pitch + 0.5 * dt : damp(s.pitch, slope, 4, dt); // rotate for take-off
      s.roll = damp(s.roll, 0, 5, dt);
      s.yaw += yIn * 0.7 * clamp(s.u / 4, 0, 1) * dt;      // nose wheel / water rudder
    } else {
      s.pitch += (pIn ? pIn * 0.7 * clamp(s.u / 30, 0, 1) : -s.pitch * 0.4) * dt;
      s.roll += (rIn ? rIn * 1.3 : -s.roll * 0.8) * dt;
      s.yaw += (G * Math.tan(s.roll) / Math.max(s.u, 15) + yIn * 0.35) * dt; // bank turns the heading
      if (s.u < vst) s.pitch = damp(s.pitch, -0.35, 2.5, dt); // stall: nose drops, overriding the stick
    }
    s.pitch = clamp(s.pitch, -0.7, 0.6); s.roll = clamp(s.roll, -1.1, 1.1);
    const lift = Math.min(G, G * (s.u / 30) ** 2) * Math.cos(s.roll); // ~ v^2, full lift from 108 km/h
    s.vy = (s.vy + (lift - G) * dt) * Math.exp(-dt);
    const [gx, gz] = fwd(s.yaw), cp = Math.cos(s.pitch);
    o.position.x += gx * cp * s.u * dt; o.position.z += gz * cp * s.u * dt;
    o.position.y += (Math.sin(s.pitch) * s.u + s.vy) * dt;
    const f = floor(t, o.position.x, o.position.z);
    if (o.position.y <= f) { o.position.y = f; s.vy = Math.max(0, s.vy); } // crash-proof clamp
    s.ground = o.position.y - f < 0.05; s.gy = Math.max(f, 0); s.speed = s.u;
    const afloat = s.ground && f < 0.5 && H(t, o.position.x, o.position.z) < 0.5;
    m.body.position.y = afloat && P.floats ? 0.06 * Math.sin(s.t * 1.6) : 0;
    s.status = s.ground ? (afloat ? 'On water' : s.u < 0.5 ? 'Parked' : 'Taxiing') : s.u < vst ? 'Stalling' : 'Airborne';
  };
  return rig(m, step, (t, x, z) => P.floats || H(t, x, z) >= 0.5, (s, t) => { o.position.y = s.gy = floor(t, o.position.x, o.position.z); });
}

// Helicopter: P = { top }
export function heli(m, P) {
  const o = m.root, acc = 10, kd = acc / (P.top / KMH);
  const step = (s, dt, k, t) => {
    const col = key(k, 'Space') - key(k, 'ShiftLeft', 'ShiftRight'), cyc = key(k, 'KeyW') - key(k, 'KeyS');
    const lat = key(k, 'ArrowRight') - key(k, 'ArrowLeft'), yIn = key(k, 'KeyA') - key(k, 'KeyD');
    s.thr = damp(s.thr, s.ground && col <= 0 ? 0.3 : 0.65 + 0.35 * col, 1.5, dt); // rotor speed
    s.vy = damp(s.vy, col > 0 ? 8 : col < 0 ? -6 : 0, 2, dt);                    // no keys: hold altitude
    if (!s.ground) { s.u += cyc * acc * dt; s.v += lat * acc * 0.7 * dt; }
    s.u -= s.u * (cyc ? kd : 0.7) * dt; s.v -= s.v * (lat ? 0.25 : 0.8) * dt;     // auto-settle into hover
    const over = Math.hypot(s.u, s.v) / (P.top / KMH); if (over > 1) { s.u /= over; s.v /= over; }
    if (s.ground) { s.u = damp(s.u, 0, 5, dt); s.v = damp(s.v, 0, 5, dt); }
    s.yaw += yIn * 1.2 * dt;
    s.pitch = damp(s.pitch, s.ground ? 0 : -0.25 * cyc, 3, dt);
    s.roll = damp(s.roll, s.ground ? 0 : -0.3 * lat, 3, dt);
    const [fx, fz] = fwd(s.yaw);
    o.position.x += (fx * s.u - fz * s.v) * dt; o.position.z += (fz * s.u + fx * s.v) * dt; o.position.y += s.vy * dt;
    const f = Math.max(H(t, o.position.x, o.position.z), 0);
    if (o.position.y <= f) { o.position.y = f; s.vy = Math.max(0, s.vy); }
    s.ground = o.position.y - f < 0.05; s.gy = f;
    const hs = Math.hypot(s.u, s.v); s.speed = Math.hypot(hs, s.vy);
    s.status = s.ground ? (hs < 0.5 ? 'Parked' : 'Taxiing') : 'Airborne';
  };
  return rig(m, step, (t, x, z) => H(t, x, z) >= 0.5, (s, t) => { o.position.y = s.gy = Math.max(H(t, o.position.x, o.position.z), 0); });
}

// Boats: P = { top, accel, turn rad/s, draft, half length, lift (bow rise), roll, bob }
export function boat(m, P) {
  const o = m.root, vmax = P.top / KMH, shore = 0.5 - 0.6 * P.draft; // deep hulls ground earlier
  const step = (s, dt, k, t) => {
    const th = key(k, 'KeyW', 'ArrowUp') - key(k, 'KeyS', 'ArrowDown'), st = key(k, 'KeyA', 'ArrowLeft') - key(k, 'KeyD', 'ArrowRight');
    s.thr = damp(s.thr, Math.abs(th), 2, dt);
    s.u += (th > 0 ? P.accel * (1 - s.u / vmax) : th < 0 ? -P.accel * 0.6 * (1 + s.u / (0.3 * vmax)) : -s.u * 0.25) * dt;
    s.steer = damp(s.steer, st, 2, dt);
    s.yaw += s.steer * P.turn * clamp(Math.abs(s.u) / (0.25 * vmax), 0.2, 1) * (s.u < 0 ? -1 : 1) * dt;
    const [fx, fz] = fwd(s.yaw), d = (s.u < 0 ? -1 : 1) * P.half;
    const nx = o.position.x + fx * s.u * dt, nz = o.position.z + fz * s.u * dt;
    if (H(t, nx + fx * d, nz + fz * d) >= shore) s.u = 0; // shore ahead: stop
    else { o.position.x = nx; o.position.z = nz; }
    const f = s.u / vmax;
    o.position.y = -P.draft + 0.12 * P.bob * Math.sin(s.t * 1.4);
    s.pitch = P.lift * f + 0.015 * P.bob * Math.sin(s.t * 1.1);
    s.roll = P.roll * Math.sin(s.t * 0.8) + 0.08 * s.steer * f;
    s.gy = 0; s.speed = s.u; s.status = 'On water';
  };
  const spot = (t, x, z, yaw) => { const [fx, fz] = fwd(yaw); return [-1, 0, 1].every(i => H(t, x + fx * i * P.half, z + fz * i * P.half) < shore); };
  return rig(m, step, spot, () => { o.position.y = -P.draft; });
}
