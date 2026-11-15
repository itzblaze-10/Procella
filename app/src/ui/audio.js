// Procedural sound (Web Audio, no audio files): a wind-like drone, stamp knock, flap clicks, and a
// sonified series where pitch follows the series' own min-to-max on D minor pentatonic.
let ctx, master, drone;
const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic steps from D
const freq = step => 146.83 * 2 ** ((SCALE[step % 5] + 12 * Math.floor(step / 5)) / 12);

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  // drone: filtered noise (wind) plus two soft sines a fifth apart
  const noise = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise.buffer = buf; noise.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const ng = ctx.createGain(); ng.gain.value = 0.05; noise.connect(lp).connect(ng).connect(master); noise.start();
  drone = ctx.createGain(); drone.gain.value = 0.035; drone.connect(master);
  for (const f of [73.42, 110]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(drone); o.start(); }
  setInterval(() => { if (ctx.state === 'running') lp.frequency.setTargetAtTime(300 + Math.random() * 500, ctx.currentTime, 2); }, 3000);
  document.addEventListener('visibilitychange', () => document.hidden ? ctx.suspend() : ctx.resume());
}
export function setMuted(m) { if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.1); }
export function setWindLevel(ws) { if (drone) drone.gain.setTargetAtTime(0.02 + Math.min(0.05, ws / 300), ctx.currentTime, 1); }

function blip(f, t, dur, type = 'sine', vol = 0.15) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
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
