// Procedural sound (Web Audio, no audio files). Menu: a wind-like drone, stamp knock, flap clicks and a
// sonified series (pitch follows the series' own min-to-max on D minor pentatonic).
// World (`sfx`): weather and place ambience, HRTF site loops, vehicle engines, footsteps, impacts and NPC
// speech. Long-lived nodes are built once and only modulated; one-shots are pre-rendered in JS and cached.
let ctx, SR, master, menu, drone, W, V, muted = false, live = false, acc = 0, shots = 0, foot = 1, last = {};
let crankUntil = 0, cutUntil = 0;
const bus = {}, banks = {};
const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic steps from D
const freq = step => 146.83 * 2 ** ((SCALE[step % 5] + 12 * Math.floor(step / 5)) / 12);
const R = Math.random, rr = (a, b) => a + R() * (b - a), cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pick = a => a[(R() * a.length) | 0], wn = () => R() * 2 - 1, TAU = 2 * Math.PI;

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new AudioContext(); SR = ctx.sampleRate;
  const comp = ctx.createDynamicsCompressor();
  // a gentle peak catcher: the spec's automatic make-up gain grows with how hard the threshold squeezes
  Object.entries({ threshold: -6, knee: 6, ratio: 4, attack: 0.004, release: 0.25 }).forEach(([k, v]) => comp[k].value = v);
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(comp).connect(ctx.destination);
  for (const b of ['amb', 'veh', 'fx', 'ui']) { bus[b] = G(b === 'ui' ? 1 : 0); bus[b].connect(master); }
  menu = G(1); menu.connect(master);
  // drone: filtered noise (wind) plus two soft sines a fifth apart
  const noise = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise.buffer = buf; noise.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const ng = ctx.createGain(); ng.gain.value = 0.05; noise.connect(lp).connect(ng).connect(menu); noise.start();
  drone = ctx.createGain(); drone.gain.value = 0.035; drone.connect(menu);
  for (const f of [73.42, 110]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(drone); o.start(); }
  setInterval(() => { if (ctx.state === 'running') lp.frequency.setTargetAtTime(300 + Math.random() * 500, ctx.currentTime, 2); }, 3000);
  document.addEventListener('visibilitychange', () => document.hidden ? ctx.suspend() : ctx.resume());
  globalThis.speechSynthesis?.getVoices(); // Chrome loads the voice list lazily on first call
}
export function setMuted(m) {
  muted = m; if (m) globalThis.speechSynthesis?.cancel();
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.1);
}

function blip(f, t, dur, type = 'sine', vol = 0.15) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus.ui); o.start(t); o.stop(t + dur + 0.05);
}
export function knock() { if (ctx) { blip(90, ctx.currentTime, 0.25, 'triangle', 0.4); blip(60, ctx.currentTime + 0.02, 0.3, 'sine', 0.3); } }
export function click() { if (ctx) blip(1800 + Math.random() * 400, ctx.currentTime, 0.03, 'square', 0.03); }
export function chime(resolved) { // Detected resolves the chord; Not detectable yet leaves it hanging
  if (!ctx) return; const t = ctx.currentTime;
  (resolved ? [0, 2, 4] : [0, 1, 3]).forEach((s, i) => blip(freq(s + 5), t + i * 0.08, 1.4, 'sine', 0.08));
}
// Play a series: one note per year over about 4 s; returns the duration.
export function sonify(values, onStep) {
  if (!ctx) return 0;
  const lo = Math.min(...values), hi = Math.max(...values), step = 4 / values.length, t0 = ctx.currentTime + 0.1;
  values.forEach((v, i) => blip(freq(Math.round((v - lo) / (hi - lo || 1) * 9)), t0 + i * step, step * 1.6, 'triangle', 0.07));
  values.forEach((_, i) => setTimeout(() => onStep?.(i), (0.1 + i * step) * 1000));
  return values.length * step;
}

// ---------- node helpers ----------
function G(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
function F(type, f, Q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; }
function osc(type, f) { const o = ctx.createOscillator(); if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type); o.frequency.value = f; o.start(); return o; }
function src(b, rate = 1) { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rate; s.start(0, R() * b.duration); return s; }
function panner(ref, roll = 1) {
  return new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, rolloffFactor: roll, maxDistance: 1e5 });
}
function setPos(n, x, y, z) { if (!Number.isFinite(x + y + z)) return; if (n.positionX) { n.positionX.value = x; n.positionY.value = y; n.positionZ.value = z; } else n.setPosition(x, y, z); }
function set(p, v, tau = 0.12) { // skip redundant automation events; update() calls this ~20 times a second per param
  if (!Number.isFinite(v) || p._v !== undefined && Math.abs(p._v - v) <= 1e-4 * (1 + Math.abs(v))) return;
  p._v = v; p.setTargetAtTime(v, ctx.currentTime, tau);
}

// ---------- JS DSP for pre-rendered buffers ----------
const arr = s => new Float32Array(Math.max(1, Math.ceil(s * SR)));
function add(dst, s, at = 0, g = 1) { const o = Math.floor(at * SR), L = dst.length; for (let i = 0; i < s.length; i++) dst[(o + i) % L] += s[i] * g; }
function mix(parts) {
  const o = new Float32Array(Math.ceil(Math.max(...parts.map(([a, at = 0]) => a.length + at * SR))));
  for (const [a, at, g] of parts) add(o, a, at, g); return o;
}
function toBuf(chs, peak = 0.9) {
  let pk = 1e-9; for (const c of chs) for (const v of c) pk = Math.max(pk, Math.abs(v));
  const b = ctx.createBuffer(chs.length, Math.max(...chs.map(c => c.length)), SR);
  chs.forEach((c, i) => { const d = b.getChannelData(i); for (let j = 0; j < c.length; j++) d[j] = c[j] * peak / pk; });
  return b;
}
function bank(key, gen, n = 4) { const b = banks[key] ||= []; if (b.length < n) { b.push(toBuf([].concat(gen()))); return b.at(-1); } return pick(b); }
function bq(type, f, q = 0.7) { // RBJ biquad; bp has 0 dB peak gain
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const run = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  run.set = (f, q) => {
    const w = TAU * Math.min(f, SR * 0.45) / SR, s = Math.sin(w), c = Math.cos(w), al = s / (2 * q), a0 = 1 + al;
    [b0, b1, b2] = type === 'bp' ? [al, 0, -al] : type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    b0 /= a0; b1 /= a0; b2 /= a0; a1 = -2 * c / a0; a2 = (1 - al) / a0;
  };
  run.set(f, q); return run;
}
function burst(d, { f = 1000, f2 = f, q = 1, type = 'bp', att = 0.002, dec = d / 4 } = {}) {
  const a = arr(d), fl = bq(type, f, q);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR; if (f2 !== f && i % 32 === 0) fl.set(f * (f2 / f) ** (t / d), q);
    a[i] = fl(wn()) * (t < att ? t / att : Math.exp((att - t) / dec));
  }
  return a;
}
const grains = (d, n, f, q = 1.2, len = 0.002) => {
  const a = arr(d + len); for (let k = 0; k < n; k++) add(a, burst(len, { f: f * rr(0.7, 1.4), q, att: 0.0002, dec: len / 3 }), R() * d, R() ** 2); return a;
};
function thump(f, dec, drop = 0.5) {
  const a = arr(dec * 6); let p = 0;
  for (let i = 0; i < a.length; i++) { const t = i / SR; p += f * (1 + drop * Math.exp(-t / dec)) / SR; a[i] = Math.sin(TAU * p) * Math.min(1, t / 0.002) * Math.exp(-t / dec); }
  return a;
}
function modes(fs, decs, amps) {
  const a = arr(Math.max(...decs) * 4);
  fs.forEach((f, k) => { for (let i = 0; i < a.length; i++) a[i] += amps[k] * Math.sin(TAU * f * i / SR) * Math.exp(-i / SR / decs[k]); });
  return a;
}
function bubble(f) { // Minnaert resonance, chirping upward as the bubble rises
  const a = arr(0.05); let p = 0;
  for (let i = 0; i < a.length; i++) { const t = i / SR; p += f * (1 + t * 30) / SR; a[i] = Math.sin(TAU * p) * Math.min(1, t / 0.001) * Math.exp(-t / 0.012); }
  return a;
}
function ring(a, fs, qs, g) { const r = fs.map((f, k) => bq('bp', f, qs[k])); return a.map(x => x * 0.3 + r.reduce((s, fl, k) => s + fl(x) * g[k], 0)); }
// Source-filter voice: saw glottal pulse at f0(x, t) through formant resonators fm(x) = [[Hz, Q, gain], ...].
function voiced(dur, f0, fm, amp, { breath = 0.05, rough = 0 } = {}) {
  const a = arr(dur), fs = fm(0).map(([f, q]) => bq('bp', f, q)), gs = fm(0).map(m => m[2]); let p = 0, tl = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR, x = t / dur;
    if (i % 64 === 0) fm(x).forEach(([f, q, g], k) => { fs[k].set(f, q); gs[k] = g; });
    p += f0(x, t) * (1 + rough * wn()) / SR; p -= Math.floor(p);
    tl += 0.35 * (1 - 2 * p + breath * wn() - tl);
    let y = 0; for (let k = 0; k < fs.length; k++) y += gs[k] * fs[k](tl);
    a[i] = y * amp(x, t);
  }
  return a;
}
// Whistled notes [start, dur, f0, f1, gain, vibHz, vibDepth]; soft = slow attack (owls, coos), else a sharp bird onset.
function tone(notes, h2 = 0.12, soft = false) {
  const a = arr(Math.max(...notes.map(n => n[0] + n[1])) + 0.05);
  for (const [t0, d, f0, f1, g = 1, vr = 0, vd = 0] of notes) {
    const o = Math.floor(t0 * SR), n = Math.floor(d * SR); let p = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n; p += f0 * (f1 / f0) ** x * (1 + vd * Math.sin(TAU * vr * i / SR)) / SR;
      const e = soft ? Math.sin(Math.PI * x) : Math.sin(Math.PI * Math.sqrt(x)) ** 2;
      a[o + i] += g * e * (Math.sin(TAU * p) + h2 * Math.sin(2 * TAU * p));
    }
  }
  return a;
}
function noiseBuf(gen, ch = 2, sec = 6) { // crossfaded tail into head so the loop is seamless
  const n = sec * SR, Fd = 4096, b = ctx.createBuffer(ch, n, SR);
  for (let c = 0; c < ch; c++) {
    const d = b.getChannelData(c), next = gen(); for (let i = 0; i < n; i++) d[i] = next();
    for (let i = 0; i < Fd; i++) { const x = i / Fd; d[i] = d[i] * x + next() * (1 - x); }
  }
  return b;
}
const pinkGen = () => { // Paul Kellet's pink filter
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = wn(); b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; return p * 0.11;
  };
};
const brownGen = () => { let v = 0; return () => (v = (v + 0.02 * wn()) / 1.02) * 3.5; };

// ---------- loop beds ----------
const evLoop = (sec, n, ev, ch = 1) => toBuf(Array.from({ length: ch }, () => { const a = arr(sec); for (let k = 0; k < n; k++) add(a, ev(k), R() * sec, 1); return a; }));
const rustleBuf = () => evLoop(6, 1400, () => burst(rr(0.002, 0.012), { f: rr(2500, 7000), q: 1.5, att: 0.0005, dec: 0.003 }).map(x => x * R() ** 3));
const dropsBuf = () => evLoop(4, 400, () => mix([[modes([rr(1500, 6000)], [rr(0.002, 0.007)], [1])], [burst(0.004, { f: 4000, q: 0.7, att: 0.0002, dec: 0.001 }), 0, 0.5]]).map(x => x * R() ** 2.5), 2);
const gravelBuf = () => evLoop(2, 1400, () => burst(rr(0.001, 0.003), { f: rr(1200, 4000), q: 1.2, att: 0.0002, dec: 0.0006 }).map(x => x * R() ** 2));
const lapBuf = () => evLoop(6, 20, () => mix([[burst(rr(0.12, 0.3), { f: rr(250, 500), f2: 160, q: 2, att: 0.02, dec: rr(0.04, 0.1) })], [burst(0.1, { f: 1200, q: 3, att: 0.01, dec: 0.03 }), 0.02, 0.3]]).map(x => x * rr(0.4, 1)));
function surfBuf() { // breaking wave: roar opens as the crest falls (~1.3 s), then a long fizzing wash
  return evLoop(11, 1, () => {
    const d = rr(7, 9), a = arr(d), lp = bq('lp', 300, 0.7), hp = bq('hp', 3000, 0.7), up = rr(1, 1.6);
    for (let i = 0; i < a.length; i++) {
      const t = i / SR, e = t < up ? (t / up) ** 2 : Math.exp(-(t - up) / 2.2);
      if (i % 64 === 0) lp.set(300 + 2600 * e, 0.7);
      a[i] = lp(wn()) * e + hp(wn()) * 0.25 * (t < up ? 0 : Math.exp(-(t - up) / 3.5)) * (0.6 + 0.4 * Math.sin(t * 23));
    }
    return a;
  }, 2);
}
function cricketBuf(k) { // Dolbear (1897): chirps/min = 4 (T_F - 50) + 40, so 148/min at 25 °C; playbackRate scales it
  const a = arr(60 / 148), f = 4500 * (1 + k * 0.04);
  for (let p = 0; p < 3; p++) for (let i = 0, n = Math.floor(0.012 * SR), o = Math.floor(p * 0.022 * SR); i < n; i++) a[o + i] = Math.sin(TAU * f * i / SR) * Math.sin(Math.PI * i / n) ** 2;
  return toBuf([a]);
}
const VOWELS = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410], [660, 1720, 2410]]; // Peterson & Barney (1952)
function babbleBuf() {
  const len = 6, a = arr(len);
  for (let v = 0; v < 4; v++) {
    const base = v < 3 ? rr(95, 135) : rr(180, 240), sc = base > 160 ? 1.15 : 1; let t = R();
    while (t < len) {
      const n = (3 + R() * 7) | 0;
      for (let k = 0; k < n; k++) {
        const d = rr(0.1, 0.24), Vw = pick(VOWELS), x0 = k / n;
        if (R() < 0.5) add(a, burst(0.04, { f: rr(2500, 6000), q: 1.5, att: 0.01, dec: 0.012 }), t, 0.25);
        add(a, voiced(d, x => base * (1.12 - 0.22 * (x0 + x / n)), () => Vw.map((f, i) => [f * sc, 6, [1, 0.6, 0.25][i]]), x => Math.sin(Math.PI * x) ** 0.7, { breath: 0.15 }), t, rr(0.5, 1));
        t += d + rr(0, 0.03);
      }
      t += rr(0.4, 1.6);
    }
  }
  return toBuf([a]);
}
function tractorBuf() { // 3-cylinder diesel at 800 rpm fires 800/120*3 = 20 times a second
  const a = arr(2.4);
  for (let k = 0; k < 48; k++) add(a, mix([[thump(rr(55, 70), 0.03, 0.3)], [burst(0.03, { f: 1800, att: 0.001, dec: 0.008 }), 0, 0.35]]), k / 20 + rr(0, 0.004), rr(0.7, 1));
  return toBuf([a]);
}
function impulse() { // generated outdoor-ish IR: 2.2 s noise tail that darkens as it decays
  const b = ctx.createBuffer(2, 2.2 * SR, SR);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let l = 0; for (let i = 0; i < d.length; i++) { const t = i / SR; l += (0.6 * Math.exp(-t * 2) + 0.05) * (wn() - l); d[i] = l * Math.exp(-t / 0.4); } }
  return b;
}

// ---------- calls of people, animals and places ----------
const SOUNDS = {
  bird() {
    const sp = (R() * 5) | 0, notes = [];
    if (sp === 0) { const n = (8 + R() * 14) | 0, f = rr(3500, 5500), r = rr(14, 22); for (let i = 0; i < n; i++) notes.push([i / r, 0.8 / r, f, f * 0.75, 1 - i / n * 0.5]); } // warbler trill
    else if (sp === 1) { let t = 0; for (let k = 0, n = 4 + R() * 5; k < n; k++) { const d = rr(0.08, 0.22), f = rr(1800, 3600); notes.push([t, d, f, f * rr(0.85, 1.2), rr(0.5, 1), 30, 0.01]); t += d + rr(0.02, 0.08); } } // thrush-like phrase
    else if (sp === 2) for (let k = 0, n = 2 + R() * 4; k < n; k++) notes.push([k * rr(0.12, 0.2), 0.05, rr(5000, 6500), rr(2800, 3600)]); // sparrow chirps
    else if (sp === 3) { const f = rr(800, 1000); for (let k = 0, n = 3 + R() * 3; k < n; k++) notes.push([k * 0.6, 0.38, f * (1 + k * 0.06), f * 1.5 * (1 + k * 0.06), 0.6 + k * 0.1]); } // koel "ku-oo", climbing
    else return tone([[0, 0.25, 520, 600, 0.7], [0.35, 0.5, 600, 480], [0.95, 0.3, 500, 480, 0.8]], 0.05, true); // dove coo
    return tone(notes);
  },
  owl: () => tone([[0, 0.35, 330, 310], [0.6, 0.16, 320, 300, 0.7], [0.8, 0.35, 330, 300], [1.4, 0.5, 320, 290], [2.1, 0.5, 320, 290, 0.8]], 0.04, true), // great horned "hoo h'hoo hoo hoo"
  bark() {
    const base = rr(380, 520), b = () => voiced(rr(0.13, 0.18), x => base * (1.15 - 0.4 * x), () => [[700, 3, 1], [1500, 4, 0.6], [2800, 5, 0.3]], x => Math.min(1, x * 25) * (1 - x) ** 1.5, { breath: 0.5, rough: 0.4 });
    return mix(Array.from({ length: 1 + (R() * 3) | 0 }, (_, k) => [b(), k * rr(0.22, 0.35)]));
  },
  rooster() {
    const syl = [[0.13, 500, 650], [0.09, 600, 650], [0.16, 650, 700], [0.8, 720, 520]], parts = []; let t = 0;
    for (const [d, f0, f1] of syl) { parts.push([voiced(d, x => f0 + (f1 - f0) * x * (2 - x), x => [[900 + 300 * x, 4, 1], [2100, 4, 0.6], [3300, 5, 0.3]], x => Math.min(1, x * 12) * Math.min(1, (1 - x) * 6), { breath: 0.2, rough: 0.3 }), t]); t += d + 0.03; }
    return mix(parts);
  },
  moo() {
    const d = rr(1.6, 2.4), base = rr(95, 130), op = x => Math.sin(Math.PI * cl(x * 1.4)) ** 0.5;
    return voiced(d, x => base * (0.85 + 0.35 * Math.sin(Math.PI * Math.min(1, x * 1.3))), x => [[250 + 450 * op(x), 5, 1], [800 + 400 * op(x), 6, 0.5], [2400, 6, 0.15]], x => Math.min(1, x / 0.15) * Math.min(1, (1 - x) / 0.25), { breath: 0.12, rough: 0.05 });
  },
  bleat() {
    const goat = R() < 0.4, base = goat ? rr(340, 420) : rr(230, 300), d = rr(0.55, 0.85), tr = rr(6, 8);
    return voiced(d, (x, t) => base * (1 + 0.06 * Math.sin(TAU * tr * t)), () => [[800, 5, 1], [1700, 6, 0.7], [2700, 6, 0.3]], (x, t) => Math.min(1, x * 10) * (1 - x) ** 0.7 * (0.75 + 0.25 * Math.sin(TAU * tr * t)), { breath: 0.2, rough: goat ? 0.25 : 0.1 });
  },
  clank() { const f = rr(180, 400); return mix([[modes([f, f * 2.76, f * 5.4, f * 8.93], [0.6, 0.35, 0.2, 0.12], [1, 0.6, 0.4, 0.25])], [burst(0.02, { f: 3000, att: 0.0003, dec: 0.004 }), 0, 0.6]]); }, // free-free bar mode ratios
  steam: () => burst(3, { type: 'hp', f: 2500, att: 0.35, dec: 1 }),
  gull() {
    const n = 3 + (R() * 4) | 0, base = rr(650, 800), parts = [];
    for (let k = 0, t = 0; k < n; k++) { const d = k < 2 ? rr(0.25, 0.35) : rr(0.12, 0.18); parts.push([voiced(d, x => base * (1 + 0.6 * Math.sin(Math.PI * x)) * (1 - k * 0.03), () => [[1600, 5, 1], [3000, 5, 0.5]], x => Math.min(1, x * 8) * (1 - x), { breath: 0.15, rough: 0.1 }), t]); t += d + rr(0.05, 0.12); }
    return mix(parts);
  },
  creak() { // stick-slip impulses with a wandering rate, ringing a plank or rope fibre
    const a = arr(rr(0.5, 1)); let ph = 0, rate = rr(30, 60);
    for (let i = 0; i < a.length; i++) { rate = cl(rate + wn() * 0.2, 25, 140); ph += rate / SR; if (ph >= 1) { ph -= 1; a[i] = rr(0.5, 1) * Math.sin(Math.PI * i / a.length); } }
    return ring(a, [rr(600, 800), rr(1200, 1500)], [10, 10], [4, 2]);
  },
  horn() { const v = f => voiced(3.8, () => f, () => [[160, 2, 1], [420, 3, 0.6], [800, 4, 0.3]], x => Math.min(1, x * 12) * Math.min(1, (1 - x) * 5), { breath: 0.05 }); return mix([[v(72)], [v(90), 0, 0.7]]); },
  whistle() { // three-chime steam whistle, pitch settles as pressure builds
    return mix([[tone([220, 277, 330].map(f => [0, 2.2, f * 0.93, f, 0.6, 5, 0.004]), 0.25, true)], [burst(2.2, { f: 1500, q: 0.8, att: 0.2, dec: 1 }), 0, 0.15]]);
  },
  thunder() {
    const d = rr(5, 8), near = R() < 0.4, bumps = Array.from({ length: 4 + (R() * 4) | 0 }, () => [rr(0, d * 0.6), rr(0.3, 1.2), rr(0.3, 1)]);
    return [0].map(() => {
      const a = arr(d), lp = bq('lp', 400, 0.7), b = brownGen();
      for (let i = 0; i < a.length; i++) {
        const t = i / SR; let e = near ? 1.5 * Math.exp(-t / 0.15) : 0;
        for (const [t0, w, g] of bumps) if (t > t0) e += g * Math.exp(-(t - t0) / w) * Math.min(1, (t - t0) / 0.08);
        if (i % 128 === 0) lp.set(120 + 600 * Math.min(1, e), 0.7);
        a[i] = (lp(wn()) * 0.6 + b() * 0.4) * e * Math.min(1, (d - t) / 1.5);
      }
      return a;
    });
  },
};

// ---------- footsteps and impacts ----------
const STEPS = {
  grass: () => mix([[burst(0.16, { f: 3000, f2: 1800, q: 0.7, att: 0.012, dec: 0.04 })], [burst(0.12, { f: 2500, q: 0.7, att: 0.01, dec: 0.03 }), 0.05, 0.6], [grains(0.1, 12, 4000), 0, 0.3], [thump(70, 0.025), 0, 0.3]]),
  dirt: () => mix([[thump(90, 0.025), 0, 0.6], [grains(0.08, 25, 2200, 1.5, 0.003), 0, 0.9], [burst(0.08, { type: 'lp', f: 1500, dec: 0.02 }), 0, 0.4]]),
  mud: () => mix([[burst(0.25, { f: 350, f2: 1000, q: 4, att: 0.03, dec: 0.07 })], [thump(60, 0.05), 0, 0.7], [burst(0.1, { type: 'lp', f: 600, dec: 0.03 }), 0, 0.5]]),
  sand: () => mix([[burst(0.2, { f: 3500, q: 0.5, att: 0.03, dec: 0.05 }), 0, 0.7], [grains(0.12, 40, 5000), 0, 0.2], [thump(60, 0.03), 0, 0.3]]),
  rock: () => mix([[burst(0.03, { f: 3000, q: 1.2, att: 0.0003, dec: 0.004 })], [thump(140, 0.02), 0, 0.7], [grains(0.03, 6, 4000), 0, 0.4], [burst(0.02, { f: 2600, q: 1.2, att: 0.0003, dec: 0.003 }), 0.035, 0.6]]),
  road: () => mix([[burst(0.03, { f: 2200, q: 1, att: 0.0003, dec: 0.005 })], [thump(120, 0.02), 0, 0.7], [burst(0.02, { f: 2000, q: 1, att: 0.0003, dec: 0.004 }), 0.04, 0.5]]),
  snow: () => mix([[grains(0.15, 70, 1800, 0.8, 0.004), 0, 0.8], [burst(0.2, { type: 'lp', f: 1200, att: 0.02, dec: 0.05 }), 0, 0.5], [thump(60, 0.04), 0, 0.3]]),
  water: () => mix([[burst(0.3, { f: 1200, f2: 500, q: 1.5, att: 0.005, dec: 0.08 })], [thump(50, 0.06), 0, 0.5], ...[0, 1, 2, 3].map(() => [bubble(rr(900, 2500)), rr(0.02, 0.15), rr(0.2, 0.5)])]),
  wood: () => mix([[ring(burst(0.15, { f: 2500, att: 0.0003, dec: 0.003 }), [190, 430], [12, 10], [6, 4])], [thump(110, 0.035), 0, 0.5]]),
};
const STEP_G = { grass: 0.32, dirt: 0.38, mud: 0.4, sand: 0.24, rock: 0.42, road: 0.4, snow: 0.38, water: 0.4, wood: 0.46 };
const CRASH = {
  stone: () => mix([[thump(55, 0.09, 0.6)], [burst(0.4, { type: 'lp', f: 2500, att: 0.001, dec: 0.06 }), 0, 0.8], [grains(0.35, 60, 2000, 1, 0.004), 0.02, 0.6]]),
  wood: () => mix([[burst(0.05, { f: 2200, q: 0.8, att: 0.0005, dec: 0.01 })], [ring(burst(0.4, { f: 2000, att: 0.0005, dec: 0.006 }), [160, 380, 900], [8, 8, 6], [5, 3, 1]), 0, 0.8], [grains(0.25, 30, 3000), 0.01, 0.5], [thump(80, 0.06), 0, 0.7]]),
  metal: () => { const f = rr(200, 320); return mix([[modes([f, f * 2.76, f * 5.4, f * 8.93, rr(1500, 2500), rr(3000, 4200)], [1.2, 0.7, 0.4, 0.25, 0.3, 0.2], [1, 0.7, 0.5, 0.3, 0.3, 0.2])], [burst(0.3, { f: 3000, q: 0.7, att: 0.0005, dec: 0.05 }), 0, 0.7], [thump(60, 0.08), 0, 0.8]]); },
  tree: () => mix([[thump(70, 0.08)], [burst(0.06, { f: 1800, q: 0.8, att: 0.0005, dec: 0.015 }), 0, 0.7], [burst(1.2, { type: 'hp', f: 2500, att: 0.05, dec: 0.35 }), 0.03, 0.5], [grains(0.8, 80, 4500), 0.05, 0.3]]),
};
function play(b, { gain = 1, rate = 1, to = bus.fx, pan = 0, pos, verb = 0, delay = 0 } = {}) {
  if (!ctx || !b || shots >= 28) return;
  const s = ctx.createBufferSource(), g = G(gain); s.buffer = b; s.playbackRate.value = rate;
  let out = s.connect(g);
  if (pos) { const p = panner(pos.ref || 10); setPos(p, pos.x, pos.y, pos.z); out = out.connect(p); }
  else if (pan) out = out.connect(new StereoPannerNode(ctx, { pan }));
  out.connect(to); if (verb && W) out.connect(G(verb)).connect(W.send);
  shots++; s.onended = () => { shots--; s.disconnect(); };
  s.start(ctx.currentTime + delay);
}
function crankBuf(k) { // starter motor dragging the engine through compression strokes, then the first firing
  const plane = k === 'cessna' || k === 'seaplane', diesel = k === 'offroad' || k === 'yacht';
  const d = plane ? 1.6 : diesel ? 1.4 : k === 'buggy' ? 0.6 : 0.9, c = plane ? 3.3 : 6.7, fs = plane ? 210 : 160, pulse = t => (0.5 + 0.5 * Math.cos(TAU * c * t)) ** 4;
  return [mix([[voiced(d, (x, t) => fs * (0.85 + 0.25 * x) * (1 - 0.15 * pulse(t)), () => [[300, 1, 1], [1200, 2, 0.5], [2500, 2, 0.3]], (x, t) => Math.min(1, x * 20) * (0.6 + 0.4 * pulse(t)), { breath: 0.3, rough: 0.1 })], [thump(50, 0.06), d - 0.02, 1.2], [burst(0.2, { type: 'lp', f: 500, att: 0.002, dec: 0.05 }), d - 0.02, 0.8]]), d];
}

// ---------- vehicles ----------
// idle/max rpm; n = firings per engine cycle (cylinders); st = stroke; off = off-order (imbalance) level; lp = filter at idle/full.
const VEH = {
  sedan: { idle: 800, max: 6500, n: 4, st: 4, off: 0.12, lp: [350, 3800], drive: 2, ex: 1, ref: 8 },
  offroad: { idle: 700, max: 4200, n: 6, st: 4, off: 0.25, lp: [250, 2200], drive: 3, ex: 1.6, ref: 8 }, // straight-six diesel
  buggy: { idle: 900, max: 5000, n: 4, st: 4, off: 0.45, lp: [400, 4500], drive: 5, ex: 1.4, ref: 8 }, // air-cooled flat-four: uneven, raspy
  cessna: { idle: 700, max: 2700, n: 4, st: 4, off: 0.2, lp: [300, 2500], drive: 3, ex: 1.2, blades: 2, ref: 14 }, // Lycoming O-320, 2700 rpm redline
  seaplane: { idle: 600, max: 2300, n: 9, st: 4, off: 0.3, lp: [250, 1800], drive: 4, ex: 1.2, blades: 2, ref: 14 }, // P&W R-985 nine-cylinder radial
  helicopter: { heli: 1, idle: 0, max: 3200, n: 6, st: 4, off: 0.2, lp: [300, 1500], drive: 2, ex: 1, spool: 0.2, ref: 14 }, // Bell 47
  riverboat: { idle: 1000, max: 5500, n: 2, st: 2, off: 0.6, lp: [600, 5000], drive: 6, ex: 1.5, ref: 10 }, // twin-cylinder two-stroke outboard
  steamliner: { steam: 1, ref: 20 },
  yacht: { idle: 600, max: 2300, n: 6, st: 4, off: 0.25, lp: [200, 1500], drive: 2, ex: 1.2, ref: 12 }, // marine diesel, wet exhaust
};
const TYRE = { // smooth rolling filter [type, Hz, Q, gain], gravel crunch [gain, Hz]
  road: ['bandpass', 900, 0.5, 1, 0, 2000], rock: ['bandpass', 700, 0.6, 0.8, 0.5, 2500], dirt: ['lowpass', 700, 0.7, 0.5, 1, 1800],
  grass: ['lowpass', 1200, 0.5, 0.6, 0.25, 3000], mud: ['lowpass', 350, 2, 0.9, 0.15, 500], sand: ['highpass', 2500, 0.5, 0.7, 0.3, 4000],
  snow: ['lowpass', 1500, 0.7, 0.4, 1, 1200], wood: ['bandpass', 300, 1.5, 1, 0.2, 1500], water: ['bandpass', 1000, 0.5, 1, 0, 1000],
};
function engWave(P) {
  const K = 200, re = new Float32Array(K + 1), im = new Float32Array(K + 1);
  for (let k = 1; k <= K; k++) im[k] = (k % P.n === 0 ? 1 : P.off * rr(0.3, 1)) / k ** 0.7;
  return ctx.createPeriodicWave(re, im);
}
function pulseWave(K) { // Hann-tapered cosine series: a smooth periodic pulse about 1/K of a period wide
  const re = new Float32Array(K + 1), im = new Float32Array(K + 1);
  for (let k = 1; k <= K; k++) re[k] = 0.5 * (1 + Math.cos(Math.PI * k / (K + 1)));
  return ctx.createPeriodicWave(re, im);
}
function buildVeh() {
  const pink = W.pink, v = { spin: 0, kind: null, surf: null, thr: 0, whistleAt: 0 };
  v.pan = panner(10); v.muff = F('lowpass', 20000); v.out = G(0); v.vin = G(1); v.motor = G(0);
  v.vin.connect(v.muff).connect(v.out).connect(v.pan).connect(bus.veh); v.motor.connect(v.vin);
  v.eng = osc('sine', 10); v.drive = G(1); v.shape = new WaveShaperNode(ctx, { curve: Float32Array.from({ length: 1024 }, (_, i) => Math.tanh((i / 511.5 - 1) * 3)) });
  v.engLP = F('lowpass', 800, 1.5); v.engG = G(0); v.eng.connect(v.drive).connect(v.shape).connect(v.engLP).connect(v.engG).connect(v.motor);
  v.pulse = osc('sine', 10); v.am = G(0); v.exF = F('bandpass', 1000, 0.8); v.exG = G(0);
  src(pink).connect(v.exF).connect(v.exG).connect(v.motor); v.pulse.connect(v.am).connect(v.exG.gain);
  v.thumpLP = F('lowpass', 110); v.thumpG = G(0); v.pulse.connect(v.thumpLP).connect(v.thumpG).connect(v.motor);
  v.tone = osc('sawtooth', 80); v.toneLP = F('lowpass', 1000); v.toneG = G(0); v.tone.connect(v.toneLP).connect(v.toneG).connect(v.motor);
  v.whine = osc('sine', 900); v.whineG = G(0); v.whine.connect(v.whineG).connect(v.motor);
  v.horn = osc('sawtooth', 1350); v.hornF = F('bandpass', 1400, 4); v.hornG = G(0); v.horn.connect(v.hornF).connect(v.hornG).connect(v.vin);
  v.tyreF = F('bandpass', 900, 0.5); v.tyreG = G(0); src(pink).connect(v.tyreF).connect(v.tyreG).connect(v.vin);
  v.crunch = src(once('gravel', gravelBuf)); v.crunchF = F('bandpass', 2000, 0.8); v.crunchG = G(0); v.crunch.connect(v.crunchF).connect(v.crunchG).connect(v.vin);
  v.sqOsc = osc('sawtooth', 1050); v.sqF = F('bandpass', 1050, 14); v.sqG = G(0);
  src(pink).connect(G(0.5)).connect(v.sqF); v.sqOsc.connect(G(0.3)).connect(v.sqF); v.sqF.connect(v.sqG).connect(v.vin);
  v.scrubG = G(0); src(pink).connect(F('lowpass', 900)).connect(v.scrubG).connect(v.vin);
  v.rushF = F('bandpass', 400, 0.5); v.rushG = G(0); src(pink).connect(v.rushF).connect(v.rushG).connect(v.vin);
  v.slap = src(lap()); v.slapG = G(0); v.slap.connect(v.slapG).connect(v.vin);
  v.washF = F('bandpass', 500, 0.7); v.washG = G(0); src(pink).connect(v.washF).connect(v.washG).connect(v.vin);
  return v;
}
function setKind(k) {
  const P = VEH[k] || VEH.sedan; V.kind = k;
  if (P.n) V.eng.setPeriodicWave(engWave(P));
  V.pulse.setPeriodicWave(pulseWave(P.heli ? 16 : P.steam ? 6 : 4));
  V.tone.type = P.steam ? 'triangle' : 'sawtooth';
  V.pan.refDistance = P.ref;
  set(V.exF.Q, P.heli ? 0.7 : 0.8); set(V.toneLP.frequency, P.heli ? 900 : 1000); set(V.thumpLP.frequency, P.steam ? 160 : 110);
}
function vehicle(s, T, lp) {
  const v = s.vehicle;
  if (!v) { if (V) set(V.out.gain, 0, 0.3); return; }
  V ||= buildVeh(); if (V.kind !== v.kind) setKind(v.kind);
  const P = VEH[v.kind] || VEH.sedan, now = ctx.currentTime, on = (v.inside || v.status !== 'Parked') && now > crankUntil;
  set(V.out.gain, 1, 0.3);
  V.spin += ((on ? 1 : 0) - V.spin) * cl(T * (P.spool || (on ? 4 : 1.5)));
  set(V.motor.gain, Math.min(1, V.spin * 3), 0.1);
  const thr = now < cutUntil ? 0 : cl(Math.abs(v.throttle ?? 0)), flare = on ? 0.35 * Math.exp(-(now - crankUntil) / 0.6) : 0;
  const r = cl((v.rpm ?? 0.1 + 0.9 * thr) + flare), kmh = Math.abs(v.speedKmh || 0), sp = V.spin;
  let eng = 0, ex = 0, am = 0, thump = 0, tn = 0, wh = 0;
  if (P.steam) { // two exhaust beats per crank revolution, 30 to 90 rpm
    const chuff = (30 + 60 * r) / 60 * 2 * sp;
    set(V.pulse.frequency, chuff, 0.2); set(V.exF.frequency, 700); set(V.tone.frequency, 45 * (0.8 + 0.2 * r));
    ex = 0.12 * (0.3 + thr) * sp; am = ex * 3; thump = 0.3 * sp; tn = 0.05 * sp;
    if (thr > 0.6 && V.thr <= 0.6 && now > V.whistleAt) { V.whistleAt = now + 25; play(bank('whistle', SOUNDS.whistle, 2), { to: V.vin, gain: 0.5, verb: 0.3 }); }
  } else {
    const rpm = (P.heli ? P.max * (0.9 + 0.1 * r) : P.idle + (P.max - P.idle) * r) * sp, cyc = rpm / 60 / (P.st / 2);
    set(V.eng.frequency, cyc * (1 + wn() * 0.015 * (1 - r)), 0.05);
    set(V.engLP.frequency, P.lp[0] + (P.lp[1] - P.lp[0]) * (0.4 * r + 0.6 * thr)); set(V.drive.gain, 1 + P.drive * thr);
    eng = (0.15 + 0.25 * r + 0.25 * thr) * (P.heli ? 0.3 : 1);
    if (P.heli) { // Bell 47: two-blade main rotor ~370 rpm -> 12.3 Hz blade slap; tail rotor ~5.8x faster
      const blade = 370 / 60 * 2 * sp;
      set(V.pulse.frequency, blade, 0.1); set(V.exF.frequency, 500); set(V.tone.frequency, blade * 5.8); set(V.whine.frequency, 300 + 700 * sp);
      ex = (0.06 + 0.18 * thr) * sp; am = ex * 4; thump = (0.12 + 0.2 * thr) * sp; tn = 0.1 * sp; wh = 0.035 * sp;
    } else {
      set(V.pulse.frequency, cyc * P.n, 0.05); set(V.exF.frequency, 600 + 2000 * r);
      ex = (0.03 + 0.1 * thr) * P.ex; am = ex * 1.5;
      if (P.blades) { set(V.tone.frequency, rpm / 60 * P.blades, 0.05); set(V.toneLP.frequency, 600 + 1500 * r); tn = 0.08 + 0.25 * r; }
    }
  }
  set(V.engG.gain, eng); set(V.exG.gain, ex); set(V.am.gain, am); set(V.thumpG.gain, thump); set(V.toneG.gain, tn); set(V.whineG.gain, wh);
  V.thr = thr;
  // ground contact: tyres, gravel, skid squeal on hard surfaces, scrub on loose ones
  const roll = v.class === 'land' || (v.class === 'air' && v.ground !== false && v.status !== 'On water' && v.status !== 'Airborne');
  const ty = TYRE[v.surface] || TYRE.road, slip = cl(v.slip ?? 0) * cl(kmh / 15), hard = ['road', 'rock', 'wood', undefined].includes(v.surface);
  if (V.surf !== v.surface) { V.surf = v.surface; V.tyreF.type = ty[0]; set(V.tyreF.frequency, ty[1]); set(V.tyreF.Q, ty[2]); set(V.crunchF.frequency, ty[5]); }
  set(V.tyreG.gain, roll ? cl(kmh / 120) ** 1.2 * 0.3 * ty[3] : 0);
  set(V.crunchG.gain, roll ? cl(kmh / 40) * 0.25 * ty[4] * (1 + slip) : 0); set(V.crunch.playbackRate, 0.4 + cl(kmh / 60) * 0.9);
  set(V.sqG.gain, roll && hard ? slip ** 1.5 * 0.12 : 0, 0.05); const sq = 1000 + 250 * R(); set(V.sqF.frequency, sq, 0.08); set(V.sqOsc.frequency, sq, 0.08);
  set(V.scrubG.gain, roll && !hard ? slip * 0.25 : 0, 0.05);
  const air = v.class === 'air' ? Math.abs(v.airspeedKmh ?? kmh) : kmh;
  set(V.rushG.gain, cl(air / 250) ** 2 * 0.35); set(V.rushF.frequency, 300 + air * 6);
  const wet = v.class === 'water' || v.status === 'On water';
  set(V.slapG.gain, wet ? 0.12 + 0.35 * cl(kmh / 40) : 0, 0.3); set(V.slap.playbackRate, 0.8 + cl(kmh / 40) * 0.8);
  set(V.washG.gain, wet ? cl(kmh / 50) ** 1.3 * 0.35 : 0, 0.3); set(V.washF.frequency, 400 + kmh * 10);
  set(V.hornG.gain, v.stall ? 0.08 : 0, 0.02);
  const d = Math.hypot(v.x - lp.x, v.y - lp.y, v.z - lp.z); // air absorption dulls distant engines
  set(V.muff.frequency, Math.min(v.inside ? 3500 : 20000, 20000 / (1 + d / 120)), 0.1);
}

// ---------- world ambience ----------
const SITE = { village: 40, farm: 40, industry: 60, harbour: 50 }; // panner refDistance, m
function buildWorld() {
  const w = W = { t: {}, gw: 0.5, s: {} };
  w.pink = noiseBuf(pinkGen);
  w.send = G(1); const verb = new ConvolverNode(ctx, { buffer: impulse() }); w.send.connect(verb).connect(G(0.3)).connect(master);
  w.duck = G(1); w.amb = F('lowpass', 18000); w.amb.connect(w.duck).connect(bus.amb);
  w.windF = F('bandpass', 400, 0.6); w.windG = G(0); bed(w.pink, [w.windF], w.windG);
  w.howlF = F('bandpass', 600, 18); w.howl2 = F('bandpass', 900, 18); w.howlG = G(0); bed(w.pink, [w.howlF], w.howlG); bed(w.pink, [w.howl2], w.howlG);
  w.crG = G(0); w.cr = [0, 1, 2].map(k => bed(cricketBuf(k), [new StereoPannerNode(ctx, { pan: k - 1 })], w.crG));
  return w;
}
function bed(b, f, g, rate) { const n = src(b, rate); let o = n; for (const x of f) o = o.connect(x); o.connect(g).connect(W.amb); return n; }
const once = (k, make) => W[k] ||= make();
const brown = () => once('brown', () => noiseBuf(brownGen)), lap = () => once('lap', lapBuf);
// Heavy beds are rendered the first time they are needed, so entering the world stays cheap.
const LAZY = {
  rustG: g => bed(rustleBuf(), [F('highpass', 1500)], g),
  hissG: g => bed(W.pink, [F('highpass', 700), F('lowpass', 9000)], g),
  dropG: g => bed(dropsBuf(), [], g),
  surfG: g => { bed(surfBuf(), [], g); bed(brown(), [F('lowpass', 300)], g); },
};
function level(k, v, tau) { if (v > 0 || W[k]) set(once(k, () => { const g = G(0); LAZY[k](g); return g; }).gain, v, tau); }
function buildSite(k) {
  const S = { pan: panner(SITE[k]), lp: F('lowpass', 6000), out: G(0), in: G(1), bed: G(0) };
  S.in.connect(S.lp).connect(S.out).connect(S.pan).connect(W.amb); S.pan.connect(G(0.25)).connect(W.send); S.bed.connect(S.in);
  if (k === 'village') src(babbleBuf()).connect(F('lowpass', 2500)).connect(S.bed);
  if (k === 'farm') src(tractorBuf()).connect(S.bed);
  if (k === 'harbour') { src(lap()).connect(S.bed); src(brown()).connect(F('lowpass', 300)).connect(G(0.5)).connect(S.bed); }
  if (k === 'industry') { // transformer hum sits at twice mains (2 x 50 Hz) plus harmonics; machinery rumble under it
    [[100, 0.3], [200, 0.15], [300, 0.08]].forEach(([f, g]) => osc('sine', f).connect(G(g)).connect(S.bed));
    src(brown()).connect(F('lowpass', 250)).connect(S.bed);
  }
  return S;
}
function due(k, T, lo, hi) { if ((W.t[k] = (W.t[k] ?? rr(lo, hi)) - T) > 0) return false; W.t[k] = rr(lo, hi); return true; }
function ambience(s, T, lp) {
  const e = s.env || {}, w = W, wind = e.wind ?? 3, rain = cl(e.rain ?? 0), snow = !!e.snow, night = cl(e.night ?? 0), temp = e.tempC ?? 20;
  const veg = cl(e.vegetation ?? 0.3), wd = e.waterDist ?? 1e4, inside = !!s.vehicle?.inside;
  w.gw = cl(w.gw + wn() * T * 1.2); const wl = cl(wind / 20), g = cl((e.gust ?? 0.3) * (0.4 + w.gw) + 0.1 * w.gw);
  set(w.windG.gain, (0.04 + 0.45 * wl ** 1.4) * (0.6 + 0.7 * g) * (snow ? 0.6 : 1), 0.4); set(w.windF.frequency, 250 + 700 * wl + 500 * g, 0.5);
  set(w.howlG.gain, cl((wind - 9) / 10) * (0.3 + g) * 0.08, 0.6); set(w.howlF.frequency, 450 + 400 * wl + 350 * g, 0.8); set(w.howl2.frequency, 700 + 500 * wl + 400 * g, 0.9);
  level('rustG', veg * cl((wind - 1) / 10) * (0.4 + g) * (snow ? 0.1 : 0.3), 0.3);
  level('hissG', snow ? 0 : rain ** 0.8 * 0.45, 1); level('dropG', snow ? 0 : rain * 0.4, 1);
  level('surfG', cl(1 - wd / 600) ** 2 * 0.5 * (s.vehicle?.class === 'water' ? 0.4 : 1), 1);
  set(w.crG.gain, cl(night * 2 - 1) * cl((temp - 12) / 6) * (rain < 0.3 && !snow) * 0.09, 2);
  const cr = cl((4 * (temp * 1.8 + 32 - 50) + 40) / 148, 0.5, 1.6); w.cr.forEach((c, k) => set(c.playbackRate, cr * (0.97 + 0.035 * k), 2));
  set(w.amb.frequency, snow ? 2500 : inside ? 6000 : 18000, 0.5);
  const around = (r0, r1, h0, h1) => { const a = R() * TAU, r = rr(r0, r1); return { x: lp.x + Math.cos(a) * r, y: lp.y + rr(h0, h1), z: lp.z + Math.sin(a) * r }; };
  if (due('bird', T, 1.5, 7) && night < 0.35 && temp > 0 && !snow && rain < 0.5 && R() < 0.3 + veg) play(bank('bird', SOUNDS.bird, 10), { to: w.amb, gain: 0.3 * rr(0.4, 1), pos: around(12, 50, 2, 12), rate: rr(0.95, 1.05) });
  if (due('owl', T, 25, 70) && night > 0.7 && veg > 0.2 && !snow) play(bank('owl', SOUNDS.owl, 2), { to: w.amb, gain: 0.35, pos: around(40, 90, 5, 15), verb: 0.4, rate: rr(0.95, 1.05) });
  if (due('thunder', T, 12, 40) && rain > 0.7) play(bank('thunder', SOUNDS.thunder, 3), { to: w.amb, gain: 0.7 * rr(0.5, 1), verb: 0.3, rate: rr(0.85, 1.1) });
  // ponytail: one emitter per kind at the nearest site of that kind, no Doppler; pool emitters if two sites of a kind must be heard at once
  const near = {};
  for (const st of e.sites || []) { const d = Math.hypot(st.x - lp.x, (st.y ?? lp.y) - lp.y, st.z - lp.z); if (SITE[st.kind] && !(near[st.kind]?.d < d)) near[st.kind] = { st, d }; }
  for (const k in SITE) {
    const n = near[k]; if (!n && !w.s[k]) continue;
    const S = w.s[k] ||= buildSite(k);
    if (!n || n.d > 1500) { set(S.out.gain, 0, 1); continue; }
    setPos(S.pan, n.st.x, n.st.y ?? lp.y, n.st.z); set(S.out.gain, 1, 1); set(S.lp.frequency, cl(9000 / (1 + n.d / 150), 700, 9000), 0.5);
    const day = 1 - night, at = (key, lo, hi) => due(k + key, T, lo, hi) && n.d < 900;
    const shot = (name, gain, opt = {}) => play(bank(name, SOUNDS[name], opt.n || 4), { to: S.in, gain, rate: rr(0.93, 1.07), ...opt });
    if (k === 'village') {
      set(S.bed.gain, 0.3 * (1 - 0.7 * night), 2);
      if (at('bark', 6, 25) && R() < 0.5 + night * 0.4) shot('bark', 0.4);
      if (at('rooster', night > 0.15 && night < 0.6 ? 8 : 30, night > 0.15 && night < 0.6 ? 20 : 80) && night < 0.6) shot('rooster', 0.45, { verb: 0.2 });
    } else if (k === 'farm') {
      set(S.bed.gain, night < 0.5 ? 0.25 : 0, 3);
      if (at('moo', 8, 25) && day > 0.3) shot('moo', 0.5, { verb: 0.15 });
      if (at('bleat', 6, 20) && day > 0.3) shot('bleat', 0.4);
    } else if (k === 'industry') {
      set(S.bed.gain, 0.3, 2);
      if (at('clank', 2.5, 4.5)) shot('clank', 0.35, { verb: 0.3 });
      if (at('steam', 10, 25)) shot('steam', 0.25, { n: 2 });
    } else {
      set(S.bed.gain, 0.4, 2);
      if (at('gull', 3, 10) && night < 0.6) shot('gull', 0.4, { n: 6 });
      if (at('creak', 4, 9)) shot('creak', 0.3, { n: 6 });
      if (at('horn', 45, 110)) shot('horn', 0.5, { verb: 0.5, n: 2 });
    }
  }
}

// ---------- speech ----------
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
let utter = null;
const NOVELTY = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy|Grandpa|Grandma|Rocko|Shelley|Sandy|Reed|Eddy|Flo/; // macOS joke and character voices

export const sfx = {
  update(dt, s) {
    if (!ctx || !s) return;
    if (!W) buildWorld();
    if (!live) { live = true; for (const b of ['amb', 'veh', 'fx']) set(bus[b].gain, b === 'veh' ? 0.7 : 1, 0.5); set(menu.gain, 0, 0.8); }
    const L = ctx.listener, cam = s.listener, lp = cam?.position || s.player || { x: 0, y: 0, z: 0 };
    if (cam) {
      setPos(L, lp.x, lp.y, lp.z);
      const { x, y, z, w } = cam.quaternion, f = [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))], u = [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)];
      if (L.forwardX) [L.forwardX.value, L.forwardY.value, L.forwardZ.value, L.upX.value, L.upY.value, L.upZ.value] = [...f, ...u]; else L.setOrientation(...f, ...u);
    }
    last = s; const v = s.vehicle;
    if (v && V) setPos(V.pan, v.x, v.y, v.z);
    if ((acc += dt) < 0.05) return; // AudioParam targets at 20 Hz, positions every frame
    const T = Math.min(acc, 0.5); acc = 0;
    ambience(s, T, lp); vehicle(s, T, lp);
  },
  footstep(surface, run) {
    if (!ctx) return; const k = STEP_G[surface] ? surface : 'dirt'; foot = -foot;
    if (k === 'water') return sfx.splash(run ? 3 : 1.5);
    play(bank('step-' + k, STEPS[k], 6), { gain: STEP_G[k] * rr(0.75, 1) * (run ? 1.6 : 1), rate: rr(0.92, 1.08) * (run ? 1.1 : 1), pan: foot * 0.12 });
  },
  land(v, surface) {
    if (!ctx || !(v > 1)) return; const g = cl(v / 12), k = STEP_G[surface] ? surface : 'dirt';
    if (k === 'water') return sfx.splash(v);
    if (last.vehicle?.inside) play(bank('susp', () => mix([[thump(45, 0.08, 0.3)], [modes([210, 580, 1130], [0.08, 0.05, 0.03], [1, 0.5, 0.3]), 0, 0.3], [burst(0.15, { type: 'lp', f: 400, dec: 0.05 }), 0, 0.6]])), { gain: 0.9 * g, verb: 0.15 });
    else play(bank('bodyland', () => mix([[thump(60, 0.06, 0.4)], [burst(0.1, { type: 'lp', f: 800, dec: 0.03 }), 0, 0.5]])), { gain: 0.5 * g });
    play(bank('step-' + k, STEPS[k], 6), { gain: STEP_G[k] * (1 + 0.6 * g), rate: 0.75 });
  },
  crash(v, material) {
    if (!ctx || !(v > 0.5)) return; const k = CRASH[material] ? material : 'stone', g = cl(v / 18) ** 0.7;
    play(bank('crash-' + k, CRASH[k], 3), { gain: 0.9 * g, rate: rr(0.9, 1.1) * (1.15 - 0.3 * g), verb: 0.25 * g });
  },
  door(open) {
    if (!ctx) return; const air = last.vehicle?.class === 'air';
    const latch = f => burst(0.02, { f, q: 2, att: 0.0003, dec: 0.003 });
    const b = open ? bank('door-open' + air, () => mix([[latch(air ? 3200 : 2800)], [latch(2000), 0.05, 0.7], [thump(air ? 160 : 110, 0.03), 0.05, 0.3]]))
      : bank('door-close' + air, () => mix([[thump(air ? 130 : 70, 0.05, 0.3)], [burst(0.12, { f: air ? 700 : 320, q: 1.5, att: 0.001, dec: 0.03 }), 0, 0.8], [latch(2500), 0.012, 0.5], [modes(air ? [520, 1300] : [140, 390], [0.06, 0.04], [0.4, 0.2]), 0, 0.5]]));
    play(b, { gain: open ? 0.4 : air ? 0.45 : 0.6, rate: rr(0.95, 1.05), verb: 0.1 });
  },
  engineStart(kind) {
    if (!ctx) return; const now = ctx.currentTime; let d;
    if (kind === 'helicopter') { // igniter ticks, then light-off; the rotor spool itself is the rig ramping up
      d = 2; play(bank('ignite', () => mix([...Array.from({ length: 8 }, (_, k) => [burst(0.01, { f: 3500, att: 0.0003, dec: 0.002 }), k * 0.25, 0.5]), [burst(1.5, { type: 'lp', f: 900, att: 0.3, dec: 0.5 }), 1.6, 1]]), 1), { gain: 0.4 });
    } else if (kind === 'riverboat') {
      d = 0.5; play(bank('pull', () => mix([[burst(0.45, { f: 800, f2: 2600, q: 2, att: 0.05, dec: 0.25 })], [grains(0.4, 25, 3000, 2, 0.002), 0, 0.5]]), 2), { gain: 0.5 });
    } else if (kind === 'steamliner') {
      d = 1.5; play(bank('hiss', () => burst(2, { type: 'hp', f: 2500, att: 0.4, dec: 0.8 }), 1), { gain: 0.35 });
      play(bank('whistle', SOUNDS.whistle, 2), { gain: 0.5, verb: 0.3, delay: 1.2 }); if (V) V.whistleAt = now + 25;
    } else { const [b, dd] = crankBuf(VEH[kind] ? kind : 'sedan'); d = dd; play(toBuf([b]), { gain: 0.35 }); }
    crankUntil = now + d; if (V) V.spin = 0;
  },
  splash(v) {
    if (!ctx) return; const big = v > 4, g = cl(v / 8) ** 0.7;
    play(bank(big ? 'splash-l' : 'splash-s', () => { const d = big ? 1.2 : 0.45; return mix([[burst(d, { f: 2000, f2: 600, q: 0.8, att: 0.005, dec: d / 3 })], [thump(45, 0.08), 0, 0.8], ...Array.from({ length: big ? 14 : 6 }, () => [bubble(rr(700, 2500)), rr(0.03, d), rr(0.2, 0.5)])]); }), { gain: 0.1 + 0.45 * g, rate: rr(0.9, 1.1), verb: 0.1 });
  },
  gear() {
    if (!ctx) return; cutUntil = ctx.currentTime + 0.15;
    play(bank('gear', () => mix([[burst(0.015, { f: 1800, q: 2, att: 0.0003, dec: 0.003 })], [thump(150, 0.02), 0, 0.5], [burst(0.08, { type: 'lp', f: 800, att: 0.002, dec: 0.02 }), 0.12, 0.4]]), 3), { to: bus.veh, gain: 0.35 });
  },
  say(text, { seed = 0, lang } = {}) {
    const ss = globalThis.speechSynthesis; if (!ss || !text) return () => {};
    ss.cancel(); const h = hash(seed), u = new SpeechSynthesisUtterance(text);
    const all = ss.getVoices().filter(v => !NOVELTY.test(v.name));
    const reg = lang?.split(/[-_]/)[1]?.toUpperCase(), base = lang?.slice(0, 2).toLowerCase(), en = /^[\x00-\x7F‘-”–—…]*$/.test(text);
    const has = p => all.filter(p), byLang = l => v => v.lang.replace('_', '-').toLowerCase().startsWith(l);
    const pool = [en && reg && has(byLang('en-' + reg.toLowerCase())), !en && base && has(byLang(base)), has(byLang(en ? 'en' : base || 'en')), all].find(p => p?.length);
    if (pool) { u.voice = pool[h % pool.length]; u.lang = u.voice.lang; } else if (lang) u.lang = lang;
    u.pitch = 0.75 + ((h >>> 8) & 255) / 255 * 0.5; u.rate = 0.9 + ((h >>> 16) & 255) / 255 * 0.15; u.volume = muted ? 0 : 1;
    const duck = x => W && set(W.duck.gain, x, 0.3);
    u.onstart = () => duck(0.55); u.onend = u.onerror = () => { if (utter === u) { utter = null; duck(1); } };
    utter = u; ss.speak(u);
    return () => { if (utter === u) ss.cancel(); };
  },
  stopVoice() { globalThis.speechSynthesis?.cancel(); if (W) set(W.duck.gain, 1, 0.3); utter = null; },
  leave() {
    if (!ctx) return; live = false; acc = 0;
    for (const b of ['amb', 'veh', 'fx']) set(bus[b].gain, 0, 0.4);
    set(menu.gain, 1, 1); sfx.stopVoice();
  },
};
