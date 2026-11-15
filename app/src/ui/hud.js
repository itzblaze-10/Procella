// In-world HUD: NASA satellite panel (left), destination board, telemetry, dossier, stories, vehicle spawner.
import { VARS } from '../data/power.js';
import { trend, sensitivity } from '../data/stats.js';
import { storyFor, VERDICT_WORD, ROLE_VAR } from '../data/stories.js';
import { VEHICLES } from '../vehicles/index.js';
import { knock, chime, sonify, click } from './audio.js';

const P = () => window.Procella;
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Satellite groups -> effect switches -> NASA variables
const PANEL = [
  { sat: 'MERRA-2', note: 'NASA GMAO reanalysis, assimilates satellite and ground observations', rows: [
    ['rain', 'PRECTOTCORR', 'Rain / snow'], ['wind', 'WS10M', 'Wind and gusts'], ['mist', 'RH2M', 'Humidity mist'], ['temp', 'T2M', 'Temperature'], ['soil', 'GWETROOT', 'Soil wetness'] ] },
  { sat: 'CERES', note: 'Clouds and Earth’s Radiant Energy System, on Terra and Aqua', rows: [
    ['cloud', 'CLOUD_AMT', 'Cloud cover'], ['sun', 'ALLSKY_SFC_SW_DWN', 'Sunlight'], ['haze', 'AOD_55', 'Haze (aerosol)'] ] },
];

export class HUD {
  constructor(root, world, app) {
    this.root = root; this.w = world; this.app = app;
    const o = world.o, when = o.mode === 'future' ? `Future Zone · ${MONTHS[o.month]} ${o.futureYear} · extrapolated` : `${MONTHS[o.month]} ${o.year}`;
    root.innerHTML = `
      <div class="hud">
        <aside class="sat-panel" id="sat"><header id="satHead"><span class="eyebrow">NASA layers</span><span class="sat-btns"><button id="satMin" title="Minimise">–</button><button id="satMax" title="Expand">⤢</button></span></header>
          <div class="sat-body" id="satBody"></div></aside>
        <div class="topbar"><div id="board"></div><div class="when">${esc(when)}</div><div class="badges" id="badges"></div><div id="compass"></div></div>
        <div class="era" id="era"></div>
        <div class="telemetry" id="tele"></div>
        <div class="help" id="help"></div>
        <div class="actions">
          <button id="bSpawn">Spawn vehicle</button><button id="bDelete">Delete vehicle</button><button id="bDossier">Trend dossier <kbd>T</kbd></button><button id="bAdv">Advancements <kbd>J</kbd></button><button id="bMenu">Menu <kbd>Esc</kbd></button>
        </div>
        <div class="prompt" id="prompt"></div>
        <div class="toasts" id="toasts"></div>
        <div class="modal" id="modal" hidden></div>
      </div>`;
    const $ = id => root.querySelector('#' + id); this.$ = $;
    $('board').innerHTML = P().FlapBoard({ text: world.placeName.toUpperCase().replace(/[^A-Z0-9 .+-]/g, '').slice(0, 14), size: 'sm' });
    $('compass').innerHTML = P().Compass({ size: 54 });
    $('badges').innerHTML = P().SourceBadge({ kind: world.pt.source === 'live' ? 'live' : 'cached', text: world.pt.source === 'live' ? 'Live · NASA POWER' : 'Cached · NASA unreachable' })
      + P().SourceBadge({ kind: 'model', text: o.mode === 'future' ? 'Extrapolated' : 'MERRA-2 + CERES' });
    $('satMin').onclick = () => $('sat').classList.toggle('min');
    $('satMax').onclick = () => $('sat').classList.toggle('max');
    this.drag($('sat'), $('satHead'));
    $('bSpawn').onclick = () => this.spawnPicker();
    $('bDelete').onclick = () => { world.deleteVehicle(); this.toast('Vehicle removed.'); };
    $('bDossier').onclick = () => this.dossier('T2M');
    $('bAdv').onclick = () => app.advancements();
    $('bMenu').onclick = () => app.pause();
    this.renderPanel(); this.renderEra();
  }

  drag(el, handle) {
    handle.onpointerdown = e => {
      if (e.target.tagName === 'BUTTON') return;
      const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const move = ev => { el.style.left = Math.max(0, ev.clientX - ox) + 'px'; el.style.top = Math.max(0, ev.clientY - oy) + 'px'; };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
    };
  }

  renderPanel() {
    const w = this.w, desc = w.weather.describe(), on = w.weather.on;
    let h = '';
    for (const g of PANEL) {
      h += `<section><h4>${g.sat}</h4><p class="note">${g.note}</p>`;
      for (const [fx, id, label] of g.rows) {
        const tr = trend(w.pt.annual[id]);
        h += `<label class="sat-row ${on[fx] ? '' : 'off'}"><input type="checkbox" data-fx="${fx}" ${on[fx] ? 'checked' : ''}>
          ${P().Icon(VARS[id].icon, { size: 18 })}<span class="lbl">${label}<small>${esc(desc[fx])}</small></span>
          <button class="chip chip-${tr.verdict}" data-var="${id}" title="Open the trend dossier">${tr.verdict === 'detected' ? (tr.direction === 'up' ? '▲' : '▼') : tr.verdict === 'null' ? '≈' : '⌛'}</button></label>`;
      }
      h += '</section>';
    }
    const im = w.imerg, mer = w.values.PRECTOTCORR;
    h += `<section><h4>GPM IMERG</h4><p class="note">Satellite rainfall, the cross-check for MERRA-2 rain</p><div class="sat-row static">${P().Icon('rain', { size: 18 })}<span class="lbl">Satellite rain this month<small>${w.o.mode === 'future' ? 'No observations in the future' : im ? `${im.mean.toFixed(1)} mm/day · ${im.wetDays} wet days of ${im.days}` + (mer != null ? ` · MERRA-2 says ${mer.toFixed(1)}` : '') : w.o.year < 1998 ? 'IMERG starts in 1998' : 'Loading…'}</small></span></div></section>`;
    h += `<section><h4>MODIS</h4><p class="note">Ground colour: Blue Marble Next Generation monthly composite</p></section>
      <section class="locked"><h4>AIRS · GLDAS · GRACE</h4><p class="note">Need an Earthdata Login to fetch values. AIRS temperature imagery is in the Globe Lab.</p></section>`;
    const body = this.$('satBody'); body.innerHTML = h;
    body.querySelectorAll('input[data-fx]').forEach(cb => cb.onchange = () => {
      const now = w.weather.toggle(cb.dataset.fx); click();
      this.toggled = this.toggled || {}; this.toggled[cb.dataset.fx] = (this.toggled[cb.dataset.fx] || 0) + 1;
      if (now && this.toggled[cb.dataset.fx] >= 2) w.hooks.progress.earn('toggle');
      this.renderPanel();
    });
    body.querySelectorAll('button[data-var]').forEach(b => b.onclick = e => { e.preventDefault(); this.dossier(b.dataset.var); });
  }

  renderEra() {
    const p = this.w.hooks.progress, era = p.currentEra, got = p.stamps.has(era);
    this.$('era').innerHTML = `<span class="eyebrow">${era} objective</span><span>${got ? 'Stamp collected for this era. Explore freely.' : `Hear 2 stories (${Math.min(2, p.era.stories)}/2) and open the trend dossier (${p.era.dossier ? 'done' : 'not yet'}).`}</span>`;
  }

  frame(dt) {
    const w = this.w, v = w.vehicle, tel = w.driving && v ? v.telemetry() : null;
    this.$('tele').innerHTML = tel
      ? `<b>${tel.speedKmh.toFixed(0)}</b><span>km/h</span><b>${tel.altitudeM.toFixed(0)}</b><span>m altitude</span><b>${tel.aglM.toFixed(0)}</b><span>m above ground</span><b>${tel.headingDeg.toFixed(0)}°</b><span>${esc(tel.status)}</span>`
      : `<b>${w.player.object.position.y.toFixed(0)}</b><span>m elevation</span><b>${(w.dist.total / 1000).toFixed(1)}</b><span>km travelled</span>`;
    this.$('help').innerHTML = (w.driving && v ? v.controlsHelp : ['W A S D walk', 'Shift run', 'Space jump', 'Drag to look', 'Wheel zoom']).map(s => `<span>${esc(s)}</span>`).join('')
      + `<span><kbd>F</kbd> ${w.driving ? 'get out' : 'get in'}</span>`;
    const npc = w.nearestNPC();
    this.$('prompt').textContent = npc ? `Press E to talk with the ${npc.role}${npc.heard ? ' again' : ''}` : (!w.driving && v && v.object.position.distanceTo(w.player.object.position) < 14 ? 'Press F to get in' : '');
    this.$('prompt').hidden = !this.$('prompt').textContent;
    const needle = this.$('compass').querySelector('svg');
    if (needle) P().compassTo(needle, -(w.camYaw * 180 / Math.PI));
  }

  toast(msg, kind = '') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = msg; this.$('toasts').appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }

  openModal(html, wide) { const m = this.$('modal'); m.hidden = false; m.className = 'modal' + (wide ? ' wide' : ''); m.innerHTML = `<div class="sheet"><button class="close" id="mClose">Close <kbd>Esc</kbd></button>${html}</div>`; m.querySelector('#mClose').onclick = () => this.closeModal(); this.app.modalOpen = true; return m; }
  closeModal() { this.$('modal').hidden = true; this.app.modalOpen = false; }

  dossier(id) {
    const w = this.w, se = w.pt.annual[id], meta = VARS[id];
    if (se.values.length < 3) { this.toast(`${meta.label}: no data at this point.`); return; }
    const tr = trend(se), first = se.years[0], last = se.years.at(-1);
    const m = this.openModal(`<div class="dossier">
      <div class="dossier-top"><div class="tags">${Object.keys(VARS).map(k => `<button class="vtab ${k === id ? 'on' : ''}" data-v="${k}">${VARS[k].label}</button>`).join('')}</div></div>
      <div id="dPlate"></div>
      <div class="trust"><label>Start the record in <b id="sy">${first}</b><input type="range" id="start" min="${first}" max="${last - 8}" value="${first}"></label><div id="dStamp"></div></div>
      <p class="dverdict" id="dText"></p>
      <button class="primary" id="play">Play the record as sound</button>
      <p class="fine">Mann-Kendall test (two-sided, ties corrected) on annual means; Sen's slope with a 95% confidence interval. Data: NASA POWER, ${meta.product}, grid cell at ${w.o.lat.toFixed(2)}, ${w.o.lon.toFixed(2)}. ${w.pt.source === 'live' ? 'Fetched live this session.' : 'Shown from this browser’s last copy: NASA did not answer.'}</p></div>`, true);
    const draw = start => {
      const keep = se.years.map((y, i) => y >= start ? i : -1).filter(i => i >= 0), s2 = { years: keep.map(i => se.years[i]), values: keep.map(i => se.values[i]) }, t2 = trend(s2);
      m.querySelector('#dPlate').innerHTML = P().ChartPlate({ eyebrow: `${w.placeName} · ${meta.product}`, title: meta.label, unit: meta.unit + ', annual mean', years: s2.years, values: s2.values, sen: t2.slope, intercept: t2.intercept,
        caption: t2.verdict === 'short' ? `Only ${t2.n} years: too short to judge.` : `Sen's slope ${fmtS(t2.slope)} ${meta.unit} per year (95% CI ${fmtS(t2.lo)} to ${fmtS(t2.hi)}), p = ${fmtP(t2.p)}, ${t2.n} years.`,
        source: `Data: NASA POWER · ${meta.product}`, badges: [{ kind: w.pt.source === 'live' ? 'live' : 'cached', text: w.pt.source === 'live' ? 'Live' : 'Cached' }] });
      m.querySelector('#dStamp').innerHTML = P().Stamp({ state: t2.verdict, direction: t2.direction, press: true, size: 110, detail: `${t2.from}–${t2.to}` });
      m.querySelector('#dText').textContent = `${VERDICT_WORD[t2.verdict]}. ${t2.verdict === 'null' ? 'This change cannot be told apart from year-to-year noise at this record length. It does not mean nothing changed.' : t2.verdict === 'short' ? 'Under 15 years: the app will not call a trend.' : `The ${meta.label.toLowerCase()} here has been ${t2.direction === 'up' ? 'rising' : 'falling'} by about ${fmtS(t2.slope * 10)} ${meta.unit} per decade.`}`;
      knock(); chime(t2.verdict === 'detected');
      if (t2.verdict !== tr.verdict) w.hooks.progress.earn('flip');
      return t2;
    };
    const t0 = draw(first); w.hooks.progress.openedDossier(t0.verdict); this.renderEra();
    m.querySelector('#start').oninput = e => { m.querySelector('#sy').textContent = e.target.value; draw(+e.target.value); };
    m.querySelectorAll('.vtab').forEach(b => b.onclick = () => this.dossier(b.dataset.v));
    m.querySelector('#play').onclick = () => {
      const pts = m.querySelectorAll('.pc-chart__pt');
      sonify(se.values, i => { pts.forEach(p => p.classList.remove('hot')); pts[i]?.classList.add('hot'); });
    };
  }

  story(npc) {
    const w = this.w, s = storyFor(npc.role, npc.seed, w.pt, { year: w.o.year, month: w.o.month, mode: w.o.mode, futureYear: w.o.futureYear, placeName: w.placeName });
    npc.person.setTalking(true);
    const m = this.openModal(`<div class="story"><span class="eyebrow">${esc(npc.site.label)} · ${esc(w.placeName)}</span><h2>${esc(s.name)}, ${npc.role === 'factory' ? 'factory worker' : npc.role}</h2>
      <div class="lines" id="lines"></div><div class="story-plate" id="sPlate"></div><button class="primary" id="thank" hidden>Thank ${esc(s.name)}</button></div>`);
    const box = m.querySelector('#lines'); let i = 0;
    const next = () => {
      if (i < s.lines.length) { const p = document.createElement('p'); p.textContent = s.lines[i++]; box.appendChild(p); click(); setTimeout(next, 1400); return; }
      m.querySelector('#sPlate').innerHTML = P().ChartPlate({ eyebrow: s.source, title: s.meta.label, unit: s.meta.unit, years: s.series.years, values: s.series.values, sen: s.trend.slope, intercept: s.trend.intercept, caption: `${VERDICT_WORD[s.trend.verdict]} · p = ${fmtP(s.trend.p)}`, source: 'The number behind the story', badges: [] });
      m.querySelector('#thank').hidden = false;
    };
    next();
    m.querySelector('#thank').onclick = () => {
      npc.person.setTalking(false);
      if (!npc.heard) { w.settlements.markHeard(npc); w.hooks.progress.heardStory(npc.role); knock(); this.renderEra(); }
      this.closeModal();
    };
  }

  spawnPicker() {
    const m = this.openModal(`<h2>Spawn a vehicle</h2><p class="fine">Boats need open water within 12 km. Aircraft need a flat patch of ground.</p><div class="vgrid">${VEHICLES.map(v =>
      `<button class="vcard" data-k="${v.kind}"><span class="eyebrow">${v.class}</span><b>${esc(v.name)}</b><span class="sw">${v.colors.slice(0, 5).map(c => `<i style="background:${c}"></i>`).join('')}</span></button>`).join('')}</div>`, true);
    m.querySelectorAll('.vcard').forEach(b => b.onclick = () => { const v = VEHICLES.find(x => x.kind === b.dataset.k); this.closeModal(); this.w.spawnVehicle(v.kind, v.colors[0], 0); });
  }
}

const fmtS = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toPrecision(2);
const fmtP = p => p == null ? '–' : p < 0.001 ? p.toExponential(1) : p.toFixed(3);
