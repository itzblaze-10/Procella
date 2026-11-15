// Procella: app shell, screens and loop.
import * as THREE from 'three';
import { Globe } from './world/globe.js';
import { World } from './world/world.js';
import { HUD } from './ui/hud.js';
import { Lab, STATIONS } from './ui/lab.js';
import { Progress, ADVANCEMENTS, ERAS } from './data/progress.js';
import { geocode } from './data/power.js';
import { CHARACTERS, createCharacter } from './people/index.js';
import { VEHICLES, createVehicle } from './vehicles/index.js';
import * as audio from './ui/audio.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const { startAudio, setMuted, knock, click } = audio;

const P = () => window.Procella;
const ui = document.getElementById('ui'), canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace;
// filmic tone mapping and soft sun shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; // r187 PCF filters softly; PCFSoft was removed
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const globe = new Globe(); globe.setBase('bluemarble', 8).catch(() => {});
const preview = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(35, 1, 0.1, 500), obj: null, spin: 0 };
preview.scene.background = new THREE.Color(0x0a111c);
preview.scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; preview.scene.environmentIntensity = 0.8;
preview.scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2b3d5a, 1.2));
{ const d = new THREE.DirectionalLight(0xfff1d6, 2.5); d.position.set(4, 8, 6); preview.scene.add(d);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.1, 48), new THREE.MeshStandardMaterial({ color: 0x192740 })); disc.position.y = -0.05; preview.scene.add(disc); }

const keys = {};
const app = {
  screen: 'home', choice: { characterId: CHARACTERS[0].id, vehicle: { kind: 'offroad', color: null, decal: 0 }, mode: 'year', year: 2005, month: 7, futureYear: 2050, lat: null, lon: null, place: '' },
  settings: { sound: true, quality: 'high' }, progress: null, world: null, hud: null, lab: null, modalOpen: false,
};
try { Object.assign(app.settings, JSON.parse(localStorage.getItem('procella:settings')) || {}); } catch { /* blocked */ }

app.progress = new Progress(a => {
  const html = `<span class="eyebrow">Advancement</span><b>${esc(a.title)}</b><span>${esc(a.how)}</span>`;
  (app.hud || app.lab)?.toast(html, 'adv'); knock();
});
app.progress.onStamp = era => app.hud?.toast(`<span class="eyebrow">Passport</span><b>${era} stamp collected</b>`, 'adv');
app.progress.onComplete = () => setTimeout(() => app.ending(), 2500);

// ---------- screens ----------
app.home = () => {
  app.leaveWorld(); app.screen = 'home'; globe.autoSpin = true; globe.markers.clear(); globe.pin.visible = false; globe.setOverlay(null);
  ui.innerHTML = `<div class="home">
    <div class="brand-block"><span class="eyebrow">NASA Space Apps 2026 · Earth System Trend Detective</span><div id="board"></div>
      <p class="lede">Pick a traveller and a ride, land anywhere on the real Earth, and read 45 years of NASA climate records with the people who live there.</p></div>
    <nav class="menu">
      <button class="big primary" id="play">Play<small>Travel into a real place and year</small></button>
      <button class="big" id="explore">Explore<small>Globe Lab: trends across the planet</small></button>
      <button class="big" id="adv">Advancements<small>${app.progress.earned.size} of ${ADVANCEMENTS.length}</small></button>
      <button class="big" id="set">Settings<small>Sound, graphics, progress</small></button>
      <button class="big ghost" id="cred">Credits and data</button>
    </nav>
    <div class="home-foot">${P().SourceBadge({ kind: 'live', text: 'Globe: NASA GIBS, live' })}${P().SourceBadge({ kind: 'live', text: 'Climate: NASA POWER, live' })}</div></div>`;
  ui.querySelector('#board').innerHTML = P().FlapBoard({ text: 'PROCELLA', length: 8 });
  setTimeout(() => P().flapTo(ui.querySelector('.pc-flap'), 'PROCELLA'), 200);
  ui.querySelector('#play').onclick = () => app.onboard(0);
  ui.querySelector('#explore').onclick = () => app.openLab();
  ui.querySelector('#adv').onclick = () => app.advancements();
  ui.querySelector('#set').onclick = () => app.settingsPanel();
  ui.querySelector('#cred').onclick = () => app.credits();
};

const STEPS = ['Traveller', 'Vehicle', 'Time', 'Destination'];
app.onboard = step => {
  app.screen = step === 3 ? 'pick' : 'preview'; app.step = step;
  const head = `<div class="steps">${STEPS.map((s, i) => `<button class="${i === step ? 'on' : ''} ${i < step ? 'done' : ''}" data-s="${i}">${i + 1}. ${s}</button>`).join('')}</div>`;
  const nav = `<div class="onav"><button id="back">${step ? 'Back' : 'Home'}</button>${step < 3 ? '<button class="primary" id="next">Next</button>' : ''}</div>`;
  let body = '';
  if (step === 0) body = `<div class="opanel"><h2>Choose your traveller</h2><div class="cards">${CHARACTERS.map(c => `<button class="card ${c.id === app.choice.characterId ? 'on' : ''}" data-c="${c.id}"><b>${esc(c.name)}</b><span class="eyebrow">${esc(c.title)}</span><small>${esc(c.blurb)}</small></button>`).join('')}</div></div>`;
  if (step === 1) {
    const cur = VEHICLES.find(v => v.kind === app.choice.vehicle.kind);
    body = `<div class="opanel"><h2>Choose your ride</h2>${['land', 'air', 'water'].map(cl => `<h4>${cl === 'land' ? 'Roads and trails' : cl === 'air' ? 'Sky' : 'Water'}</h4><div class="cards three">${VEHICLES.filter(v => v.class === cl).map(v => `<button class="card ${v.kind === cur.kind ? 'on' : ''}" data-v="${v.kind}"><b>${esc(v.name)}</b><small>${esc(v.blurb || '')}</small></button>`).join('')}</div>`).join('')}
      <h4>Paint</h4><div class="swatches">${cur.colors.map(c => `<button style="background:${c}" class="${c === (app.choice.vehicle.color || cur.colors[0]) ? 'on' : ''}" data-col="${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
      <h4>Decal</h4><div class="chips">${cur.decals.map((d, i) => `<button class="${i === app.choice.vehicle.decal ? 'on' : ''}" data-dec="${i}">${esc(d)}</button>`).join('')}</div>
      <p class="fine">You can spawn any other vehicle once you are in the world. Boats need open water nearby.</p></div>`;
  }
  if (step === 2) body = `<div class="opanel"><h2>Choose your time</h2><div class="cards">
      <button class="card ${app.choice.mode === 'year' ? 'on' : ''}" data-m="year"><b>A year in the record</b><small>Weather and stories from NASA's measured values for one month of one year, 1981 to 2025.</small></button>
      <button class="card ${app.choice.mode === 'future' ? 'on' : ''}" data-m="future"><b>Future Zone</b><small>Each month's normal shifted along its 45-year trend to a future year. An extrapolation of the past, never a forecast.</small></button></div>
      ${app.choice.mode === 'year' ? `<label>Year <b id="yL">${app.choice.year}</b><input type="range" id="yr" min="1981" max="2025" value="${app.choice.year}"></label>` : `<label>Future year <b id="yL">${app.choice.futureYear}</b><input type="range" id="fyr" min="2030" max="2075" step="5" value="${app.choice.futureYear}"></label>`}
      <label>Month <select id="mo">${MONTHS.slice(1).map((m, i) => `<option value="${i + 1}" ${i + 1 === app.choice.month ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>`;
  if (step === 3) body = `<div class="opanel pickp"><h2>Where to?</h2><p class="fine">Drag to turn the globe, scroll to zoom, click to drop your pin. Or search.</p>
      <form id="sf"><input id="q" placeholder="Search a place, e.g. Kathmandu" autocomplete="off"><button>Search</button></form><div id="results"></div>
      <h4>Trend stations</h4><div class="chips">${STATIONS.map(([n, la, lo]) => `<button data-la="${la}" data-lo="${lo}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="pinned" id="pinned">${app.choice.lat != null ? `${esc(app.choice.place || 'Pinned')} · ${app.choice.lat.toFixed(2)}, ${app.choice.lon.toFixed(2)}` : 'No pin yet'}</div>
      <button class="primary big" id="enter" ${app.choice.lat == null ? 'disabled' : ''}>Enter the world<small>Land here and explore on foot and by vehicle</small></button>
      <button class="big" id="stay" ${app.choice.lat == null ? 'disabled' : ''}>Stay at the globe<small>Globe Lab: compare trends from afar</small></button></div>`;
  ui.innerHTML = `<div class="onboard">${head}${body}${nav}</div>`;
  ui.querySelectorAll('.steps button').forEach(b => b.onclick = () => +b.dataset.s <= step && app.onboard(+b.dataset.s));
  ui.querySelector('#back').onclick = () => step ? app.onboard(step - 1) : app.home();
  ui.querySelector('#next')?.addEventListener('click', () => app.onboard(step + 1));
  ui.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { app.choice.characterId = b.dataset.c; click(); app.onboard(0); });
  ui.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { app.choice.vehicle = { kind: b.dataset.v, color: null, decal: 0 }; click(); app.onboard(1); });
  ui.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { app.choice.vehicle.color = b.dataset.col; app.onboard(1); });
  ui.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { app.choice.vehicle.decal = +b.dataset.dec; app.onboard(1); });
  ui.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { app.choice.mode = b.dataset.m; app.onboard(2); });
  ui.querySelector('#yr')?.addEventListener('input', e => { app.choice.year = +e.target.value; ui.querySelector('#yL').textContent = e.target.value; });
  ui.querySelector('#fyr')?.addEventListener('input', e => { app.choice.futureYear = +e.target.value; ui.querySelector('#yL').textContent = e.target.value; });
  ui.querySelector('#mo')?.addEventListener('change', e => { app.choice.month = +e.target.value; });
  if (step === 3) {
    globe.autoSpin = false; globe.markers.clear();
    const setPin = (lat, lon, name) => { Object.assign(app.choice, { lat, lon, place: name || '' }); globe.setPin(lat, lon); app.onboard(3); };
    app.pickHandler = hit => hit && !hit.marker && setPin(hit.lat, hit.lon, '');
    if (app.choice.lat != null) globe.setPin(app.choice.lat, app.choice.lon);
    ui.querySelectorAll('[data-la]').forEach(b => b.onclick = () => { globe.focus(+b.dataset.la, +b.dataset.lo); setPin(+b.dataset.la, +b.dataset.lo, b.dataset.n); });
    ui.querySelector('#sf').onsubmit = async e => {
      e.preventDefault(); const r = ui.querySelector('#results'); r.textContent = 'Searching OpenStreetMap…';
      try { const res = await geocode(ui.querySelector('#q').value); r.innerHTML = res.map((x, i) => `<button data-i="${i}">${esc(x.display_name)}</button>`).join('') || 'Nothing found.';
        r.querySelectorAll('button').forEach(b => b.onclick = () => { const x = res[+b.dataset.i]; globe.focus(+x.lat, +x.lon); setPin(+x.lat, +x.lon, x.display_name.split(',')[0]); });
      } catch { r.textContent = 'Search did not answer. Click the globe instead.'; }
    };
    ui.querySelector('#enter').onclick = () => app.enterWorld();
    ui.querySelector('#stay').onclick = () => { app.openLab(); globe.focus(app.choice.lat, app.choice.lon); app.lab.addPin(app.choice.lat, app.choice.lon); };
  } else setPreview(step);
};

function setPreview(step) {
  if (preview.obj) { preview.scene.remove(preview.obj.object); preview.obj.dispose?.(); preview.obj = null; }
  if (step === 0) preview.obj = createCharacter(app.choice.characterId);
  else if (step === 1) { const v = VEHICLES.find(x => x.kind === app.choice.vehicle.kind); preview.obj = createVehicle(v.kind, { color: app.choice.vehicle.color || v.colors[0], decal: app.choice.vehicle.decal }); }
  else { preview.obj = createCharacter(app.choice.characterId); }
  preview.scene.add(preview.obj.object);
  const box = new THREE.Box3().setFromObject(preview.obj.object), size = box.getSize(new THREE.Vector3()).length();
  preview.size = size; preview.center = box.getCenter(new THREE.Vector3());
}

app.enterWorld = async () => {
  app.leaveWorld(); app.screen = 'loading';
  ui.innerHTML = `<div class="loading"><div id="lc"></div><h2>Travelling to ${esc(app.choice.place || 'your pin')}</h2><p id="ls">Packing…</p><p class="fine">Everything you will see is fetched from NASA and open map services now.</p></div>`;
  ui.querySelector('#lc').innerHTML = P().Compass({ size: 120 });
  let b = 0; const spin = setInterval(() => P().compassTo(ui.querySelector('.pc-compass'), b += 37), 500);
  const c = app.choice, v = VEHICLES.find(x => x.kind === c.vehicle.kind);
  renderer.shadowMap.enabled = app.settings.quality !== 'low';
  const w = new World(renderer, { ...c, quality: app.settings.quality, vehicle: { kind: v.kind, color: c.vehicle.color || v.colors[0], decal: c.vehicle.decal } }, {
    status: m => { const el = ui.querySelector('#ls'); if (el) el.textContent = m; }, progress: app.progress,
    toast: m => app.hud?.toast(m), refresh: () => app.hud?.renderPanel(), sound: app.settings.sound ? audio.sfx : null,
  });
  try { await w.start(); } catch (e) {
    clearInterval(spin); ui.querySelector('#ls').textContent = `NASA did not answer (${e.message}). Check the connection and try again.`;
    ui.querySelector('.loading').insertAdjacentHTML('beforeend', '<button class="primary" id="retry">Try again</button><button id="hm">Home</button>');
    ui.querySelector('#retry').onclick = () => app.enterWorld(); ui.querySelector('#hm').onclick = () => app.home(); return;
  }
  clearInterval(spin); app.world = w; app.screen = 'world'; resize();
  app.hud = new HUD(ui, w, app);
  setTimeout(() => P().flapTo(ui.querySelector('.pc-flap'), w.placeName.toUpperCase().replace(/[^A-Z0-9 .+-]/g, '').slice(0, 14)), 300);
  app.hud.toast(`<b>Welcome to ${esc(w.placeName)}</b><span>Follow the gold beacons to meet people who live here. Press E to talk.</span>`);
};
app.leaveWorld = () => { if (app.world) { app.world.dispose(); app.world = null; app.hud = null; } app.lab = null; app.modalOpen = false; };

app.openLab = () => { app.leaveWorld(); app.screen = 'lab'; globe.autoSpin = false; app.lab = new Lab(ui, globe, app); };
app.travelTo = (lat, lon) => { Object.assign(app.choice, { lat, lon, place: '' }); app.enterWorld(); };

function sheet(html) {
  const host = document.createElement('div'); host.className = 'modal top'; host.innerHTML = `<div class="sheet"><button class="close">Close <kbd>Esc</kbd></button>${html}</div>`;
  document.body.appendChild(host); app.modalOpen = true;
  const close = () => { host.remove(); app.modalOpen = !!document.querySelector('.modal:not([hidden])'); };
  host.querySelector('.close').onclick = close; host.close = close; return host;
}
app.advancements = () => {
  const p = app.progress, groups = [...new Set(ADVANCEMENTS.map(a => a.group))];
  sheet(`<h2>Advancements</h2><p class="fine">${p.earned.size} of ${ADVANCEMENTS.length} earned.</p>${groups.map(g => `<h4>${g}</h4><div class="adv">${ADVANCEMENTS.filter(a => a.group === g).map(a => { const on = p.earned.has(a.id);
    return `<div class="advi ${on ? 'on' : ''}">${P().Icon(on ? 'stamp' : 'passport', { size: 22 })}<b>${on ? esc(a.title) : '???'}</b><small>${on ? esc(a.how) : 'Keep exploring.'}</small></div>`; }).join('')}</div>`).join('')}
    <h4>Passport</h4><div class="stamps">${ERAS.map(e => `<div class="era-stamp ${p.stamps.has(e) ? 'on' : ''}">${p.stamps.has(e) ? P().Stamp({ state: 'detected', size: 84, detail: e }) : `<span>${e}</span>`}</div>`).join('')}</div>`);
};
app.settingsPanel = () => {
  const h = sheet(`<h2>Settings</h2><label class="row"><input type="checkbox" id="snd" ${app.settings.sound ? 'checked' : ''}> Sound (procedural, starts on your first click)</label>
    <label class="row">Graphics <select id="q"><option value="high">High</option><option value="low">Low (older laptops)</option></select></label>
    <button id="reset">Reset all progress</button>`);
  h.querySelector('#q').value = app.settings.quality;
  h.querySelector('#snd').onchange = e => { app.settings.sound = e.target.checked; setMuted(!app.settings.sound); saveSettings(); };
  h.querySelector('#q').onchange = e => { app.settings.quality = e.target.value; renderer.setPixelRatio(e.target.value === 'low' ? 1 : Math.min(devicePixelRatio, 1.75)); saveSettings(); };
  h.querySelector('#reset').onclick = () => { app.progress.reset(); h.close(); };
};
const saveSettings = () => { try { localStorage.setItem('procella:settings', JSON.stringify(app.settings)); } catch { /* blocked */ } };
app.credits = () => sheet(`<h2>Credits and data</h2>
  <p><b>Climate data:</b> NASA POWER (Prediction Of Worldwide Energy Resources) monthly and daily point API, values derived from NASA GMAO MERRA-2, CERES SYN1deg, GEWEX SRB and GPM IMERG. Fetched live every session.</p>
  <p><b>Imagery:</b> NASA GIBS (Global Imagery Browse Services): MODIS Blue Marble Next Generation, MODIS Terra Corrected Reflectance, GPM IMERG precipitation rate, AIRS surface air temperature.</p>
  <p><b>Elevation:</b> AWS Terrain Tiles (Mapzen terrarium encoding of SRTM, GMTED and ETOPO1), open data. <b>Place names:</b> © OpenStreetMap contributors via Nominatim.</p>
  <p><b>Ground imagery:</b> Sentinel-2 cloudless 2020 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2020), CC BY-NC-SA 4.0, s2maps.eu.</p>
  <p><b>Code and assets:</b> three.js (MIT); EZ-Tree by Daniel Greenheck (MIT) for trees; CC0 ground and building textures from Poly Haven. Vehicles, people, buildings, icons and sounds are made in code for this project. Statistics: Mann-Kendall and Sen's slope, verified against pymannkendall.</p>
  <p class="fine">Not endorsed by NASA. Built by Team Procella for the NASA Space Apps Challenge 2026.</p>`);
app.pause = () => {
  const h = sheet(`<h2>Paused</h2><div class="menu"><button class="big primary" id="r">Resume</button><button class="big" id="t">Change time or destination</button><button class="big" id="a">Advancements</button><button class="big" id="s">Settings</button><button class="big ghost" id="q">Quit to home</button></div>`);
  h.querySelector('#r').onclick = h.close;
  h.querySelector('#t').onclick = () => { h.close(); app.leaveWorld(); app.onboard(2); };
  h.querySelector('#a').onclick = () => { h.close(); app.advancements(); };
  h.querySelector('#s').onclick = () => { h.close(); app.settingsPanel(); };
  h.querySelector('#q').onclick = () => { h.close(); app.home(); };
};
app.ending = () => sheet(`<div class="ending"><span class="eyebrow">Every advancement earned</span><h2>You are an Earth System Trend Detective</h2>
  <p>You crossed real terrain, listened to people about the climate they live in, tested every verdict against its start year, and looked into a future the record can only sketch.</p>
  <p class="fine">The data was NASA's, fetched live each time. The judgement was yours.</p>${P().Stamp({ state: 'detected', size: 140, detail: 'trend detective' })}</div>`);

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.target.matches?.('input, select, textarea')) return;
  keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') { const m = [...document.querySelectorAll('.modal.top')].pop(); if (m) return m.close(); if (app.hud && !app.hud.$('modal').hidden) return app.hud.closeModal(); if (app.screen === 'world') app.pause(); return; }
  if (app.screen !== 'world' || app.modalOpen || e.repeat) return;
  if (e.code === 'KeyF') app.world.toggleDrive();
  if (e.code === 'KeyE') { const n = app.world.nearestNPC(); if (n) app.hud.story(n); }
  if (e.code === 'KeyT') app.hud.dossier('T2M');
  if (e.code === 'KeyJ') app.advancements();
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') { app.world.weather.shiftTime(e.code === 'BracketLeft' ? -1 : 1); app.hud.toast(`<b>${app.world.weather.clock()}</b><span>The sun moves to where it really stands at this latitude and month.</span>`); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; if (app.settings.sound) startAudio(); });
addEventListener('pointerdown', () => { if (app.settings.sound) startAudio(); }, { once: true });
addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (app.screen === 'world') app.world?.orbit(dx, dy); else globe.drag(dx, dy);
});
addEventListener('pointerup', e => {
  if (drag && drag.moved < 6 && e.target === canvas) {
    const hit = globe.pick(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (app.screen === 'pick') app.pickHandler?.(hit); else if (app.screen === 'lab') app.lab?.click(hit);
  }
  drag = null;
});
canvas.addEventListener('wheel', e => { e.preventDefault(); if (app.screen === 'world') app.world?.zoom(e.deltaY); else globe.zoom(e.deltaY); }, { passive: false });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false); globe.resize(innerWidth, innerHeight);
  preview.camera.aspect = innerWidth / innerHeight; preview.camera.updateProjectionMatrix(); app.world?.resize(innerWidth, innerHeight);
}
addEventListener('resize', resize); resize();

// ---------- loop ----------
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (app.screen === 'world' && app.world) {
    if (!app.modalOpen) app.world.update(dt, keys); else app.world.updateCamera(dt);
    app.hud?.frame(dt); renderer.render(app.world.scene, app.world.camera);
  } else if (app.screen === 'preview' && preview.obj) {
    preview.spin += dt * 0.5; preview.obj.update?.(dt, 0);
    const r = preview.size * 2.3, c = preview.center, s = preview.spin;
    preview.camera.position.set(c.x + Math.sin(s) * r, c.y + r * 0.22, c.z + Math.cos(s) * r);
    // aim right of the subject so it sits in the open space left of the panel
    preview.camera.lookAt(c.x + Math.cos(s) * r * 0.3, c.y, c.z - Math.sin(s) * r * 0.3);
    renderer.render(preview.scene, preview.camera);
  } else { globe.update(dt); renderer.render(globe.scene, globe.camera); }
});
window.procella = app; // handy for debugging in the console
app.home();
