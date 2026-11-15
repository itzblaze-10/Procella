// Globe Lab: stay at the globe, scan trends across many places, compare variables, project forward.
import { VARS, VAR_IDS, fetchPoint, reverse } from '../data/power.js';
import { trend, correlate, project } from '../data/stats.js';
import { VERDICT_WORD } from '../data/stories.js';
import { GLOBE_LAYERS } from '../world/globe.js';
import { BRAND } from '../brand.js';
import { knock, chime } from './audio.js';

const P = () => window.Procella;
export const STATIONS = [
  ['Gandhinagar', 23.22, 72.65], ['Delhi', 28.61, 77.21], ['Beijing', 39.9, 116.4], ['Sahel, Niger', 13.0, 2.0], ['Central Chile', -35.0, -71.0],
  ['Svalbard', 78.0, 16.0], ['South-east US', 33.0, -87.0], ['Iowa Corn Belt', 42.0, -93.5], ['Rondonia, Amazon', -10.5, -63.0], ['Congo Basin', 0.5, 23.0],
  ['Tamanrasset, Sahara', 22.8, 5.5], ['Ganges Delta', 22.0, 89.5], ['Greenland Ice Sheet', 72.0, -40.0], ['Tibetan Plateau', 32.0, 90.0], ['Maldives', 3.2, 73.5], ['Antarctic Peninsula', -68.0, -66.0],
];
const DIRS = { T2M: ['warm', 'cool'], T2M_MAX: ['warm', 'cool'], T2M_MIN: ['warm', 'cool'], PRECTOTCORR: ['wet', 'dry'], RH2M: ['wet', 'dry'], GWETROOT: ['wet', 'dry'], WS10M: ['cool', 'dry'], CLOUD_AMT: ['cool', 'dry'], ALLSKY_SFC_SW_DWN: ['dry', 'cool'], AOD_55: ['dry', 'cool'] };
const fmtS = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toPrecision(2);
const fmtP = p => p < 1e-15 ? '< 1e−15' : p < 0.001 ? p.toExponential(1) : p.toFixed(3);

export class Lab {
  constructor(root, globe, app) {
    this.root = root; this.g = globe; this.app = app; this.cache = new Map(); this.pins = STATIONS.map(([name, lat, lon]) => ({ name, lat, lon }));
    this.v = 'T2M'; this.vb = 'PRECTOTCORR'; this.fy = 2050;
    root.innerHTML = `<div class="hud lab">
      <aside class="sat-panel" id="labL"><header><span class="eyebrow">Globe Lab</span></header><div class="sat-body">
        <section><h4>Variable to scan</h4><select id="var">${VAR_IDS.map(k => `<option value="${k}">${VARS[k].label} (${VARS[k].product})</option>`).join('')}</select>
          <button class="primary" id="scan">Scan ${this.pins.length} places live</button><p class="note" id="scanNote">Each place is one live NASA POWER call, 1981 to 2025.</p></section>
        <section><h4>Imagery on the globe</h4><select id="base"><option value="bluemarble">MODIS Blue Marble (monthly)</option><option value="truecolor">MODIS Terra true colour (daily)</option></select>
          <select id="over"><option value="">No overlay</option><option value="imerg">GPM IMERG rain rate</option><option value="airs">AIRS surface air temperature</option></select>
          <input type="date" id="date" value="2025-07-15" min="2003-01-01" max="2025-12-31"><p class="note">NASA GIBS, fetched live for the date.</p></section>
        <section><h4>Legend</h4><p class="note">Spike height: size of the trend. Colour: direction. Solid: Detected. Faint: Not detectable yet. Wire: too short. Click empty globe to drop your own pin.</p></section>
        <button id="labBack">Back to menu</button></div></aside>
      <aside class="detail" id="detail" hidden></aside><div class="toasts" id="toasts"></div></div>`;
    const $ = id => root.querySelector('#' + id); this.$ = $;
    $('var').value = this.v; $('var').onchange = e => { this.v = e.target.value; this.paint(); };
    $('scan').onclick = () => this.scan();
    const layers = () => { this.g.setBase($('base').value, 7, $('date').value).catch(() => this.toast('NASA GIBS did not answer for that layer and date.')); this.g.setOverlay($('over').value, $('date').value).catch(() => this.toast('NASA GIBS has no overlay for that date.')); };
    $('base').onchange = layers; $('over').onchange = layers; $('date').onchange = layers;
    $('labBack').onclick = () => app.home();
    this.g.markers.clear(); this.g.pin.visible = false; this.g.focus(15, 60);
  }

  toast(m, kind = '') { const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = m; this.$('toasts').appendChild(el); setTimeout(() => el.remove(), 5000); }

  async get(pin) {
    const k = `${pin.lat},${pin.lon}`;
    if (!this.cache.has(k)) this.cache.set(k, fetchPoint(pin.lat, pin.lon).catch(e => { this.cache.delete(k); throw e; }));
    return this.cache.get(k);
  }

  async scan() {
    const note = this.$('scanNote'); let done = 0, failed = 0;
    note.textContent = `Fetching 0 / ${this.pins.length} from NASA…`;
    const queue = [...this.pins], work = async () => { while (queue.length) { const p = queue.shift(); try { p.pt = await this.get(p); } catch { failed++; } note.textContent = `Fetched ${++done} / ${this.pins.length} from NASA${failed ? ` (${failed} failed)` : ''}…`; this.paint(); } };
    await Promise.all([work(), work(), work(), work()]);
    note.textContent = `Done: ${done - failed} places live from NASA POWER${failed ? `, ${failed} did not answer` : ''}.`;
    this.app.progress.earn('scan'); knock();
  }

  paint() {
    const v = this.v, items = [];
    const rows = this.pins.filter(p => p.pt).map(p => ({ p, t: trend(p.pt.annual[v]) })).filter(r => r.t.n >= 3);
    const max = Math.max(1e-9, ...rows.map(r => Math.abs(r.t.slope)));
    for (const { p, t } of rows) {
      const [up, down] = DIRS[v];
      items.push({ lat: p.lat, lon: p.lon, height: Math.abs(t.slope) / max, color: BRAND[t.direction === 'up' ? up : down], verdict: t.verdict, data: { pin: p } });
    }
    this.g.setMarkers(items);
  }

  async addPin(lat, lon) {
    const rv = await reverse(lat, lon, 8), pin = { name: rv?.address?.country ? `${rv.address.state || rv.address.county || rv.address.country}` : `${lat.toFixed(1)}, ${lon.toFixed(1)}`, lat, lon };
    this.pins.push(pin); this.toast(`Fetching ${pin.name} from NASA…`);
    try { pin.pt = await this.get(pin); this.paint(); this.show(pin); } catch { this.toast('NASA POWER did not answer for that pin.'); }
  }

  show(pin) {
    const d = this.$('detail'), v = this.v, se = pin.pt.annual[v], t = trend(se), meta = VARS[v];
    if (this.vb === v) this.vb = VAR_IDS.find(k => k !== v);
    this.g.focus(pin.lat, pin.lon);
    d.hidden = false;
    const corrRow = () => {
      const a = pin.pt.annual[v], b = pin.pt.annual[this.vb], raw = correlate(a, b), det = correlate(a, b, true);
      if (det) this.app.progress.earn('corr');
      return `<p class="dverdict">Spearman ρ = ${raw.r.toFixed(2)} (p = ${fmtP(raw.p)}, ${raw.n} years). With both trends removed: ρ = ${det.r.toFixed(2)} (p = ${fmtP(det.p)}).</p>
        <p class="fine">${Math.abs(raw.r) > Math.abs(det.r) + 0.2 ? 'Most of the link comes from both series trending at once. ' : ''}A correlation shows two things moving together. It never shows that one causes the other.</p>`;
    };
    const projRow = () => {
      if (t.verdict === 'short') return '<p class="fine">Too short to project.</p>';
      const pr = project(se, t, this.fy);
      return `<p class="dverdict">${this.fy}: about ${pr.value.toFixed(2)} ${meta.unit} (range ${Math.min(pr.lo, pr.hi).toFixed(2)} to ${Math.max(pr.lo, pr.hi).toFixed(2)})</p>
        <p class="fine">Straight-line extrapolation of the ${se.years[0]}–${se.years.at(-1)} Sen trend with its 95% confidence slopes. ${t.verdict === 'null' ? 'The trend itself is not detectable, so treat this range as wide open.' : ''} It is not a climate forecast: real futures depend on emissions and physics this line does not contain.</p>`;
    };
    d.innerHTML = `<button class="close" id="dClose">Close</button><span class="eyebrow">${pin.name} · ${pin.lat.toFixed(2)}, ${pin.lon.toFixed(2)}</span>
      ${P().ChartPlate({ eyebrow: meta.product, title: meta.label, unit: meta.unit + ', annual mean', years: se.years, values: se.values, sen: t.slope, intercept: t.intercept, caption: `${VERDICT_WORD[t.verdict]}. Sen ${fmtS(t.slope * 10)} ${meta.unit} per decade (95% CI ${fmtS(t.lo * 10)} to ${fmtS(t.hi * 10)}), p = ${fmtP(t.p)}.`, source: 'Data: NASA POWER', badges: [{ kind: pin.pt.source === 'live' ? 'live' : 'cached', text: pin.pt.source === 'live' ? 'Live' : 'Cached' }] })}
      <section><h4>How does it move with another variable?</h4><select id="vb">${VAR_IDS.filter(k => k !== v).map(k => `<option value="${k}" ${k === this.vb ? 'selected' : ''}>${VARS[k].label}</option>`).join('')}</select><div id="corr">${corrRow()}</div></section>
      <section><h4>Project forward</h4><label>Year <b id="fyL">${this.fy}</b><input type="range" id="fy" min="2030" max="2075" step="5" value="${this.fy}"></label><div id="proj">${projRow()}</div></section>
      <button class="primary" id="go">Travel here in the world</button>`;
    chime(t.verdict === 'detected');
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    d.querySelector('#vb').onchange = e => { this.vb = e.target.value; d.querySelector('#corr').innerHTML = corrRow(); };
    d.querySelector('#fy').oninput = e => { this.fy = +e.target.value; d.querySelector('#fyL').textContent = this.fy; d.querySelector('#proj').innerHTML = projRow(); };
    d.querySelector('#go').onclick = () => this.app.travelTo(pin.lat, pin.lon);
  }

  click(hit) {
    if (!hit) return;
    if (hit.marker) return this.show(hit.marker.userData.pin);
    this.addPin(hit.lat, hit.lon);
  }
}
