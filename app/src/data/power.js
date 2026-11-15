// NASA POWER client. Every call goes to NASA live; the browser copy is used only if NASA does not answer,
// and the result says which (source: 'live' | 'cached').

export const VARS = {
  T2M:               { label: 'Air temperature',          unit: '°C',        product: 'MERRA-2', icon: 'temperature', color: 'warm' },
  T2M_MAX:           { label: 'Daytime high',             unit: '°C',        product: 'MERRA-2', icon: 'temperature', color: 'warm' },
  T2M_MIN:           { label: 'Night-time low',           unit: '°C',        product: 'MERRA-2', icon: 'temperature', color: 'cool' },
  PRECTOTCORR:       { label: 'Rainfall',                 unit: 'mm/day',    product: 'MERRA-2', icon: 'rain',        color: 'wet' },
  WS10M:             { label: 'Wind at 10 m',             unit: 'm/s',       product: 'MERRA-2', icon: 'wind',        color: 'cool' },
  RH2M:              { label: 'Humidity',                 unit: '%',         product: 'MERRA-2', icon: 'humidity',    color: 'wet' },
  GWETROOT:          { label: 'Root-zone soil wetness',   unit: '0 to 1',    product: 'MERRA-2', icon: 'soil',        color: 'wet' },
  CLOUD_AMT:         { label: 'Cloud cover',              unit: '%',         product: 'CERES',   icon: 'cloud',       color: 'cool' },
  ALLSKY_SFC_SW_DWN: { label: 'Sunlight at the surface',  unit: 'MJ/m²/day', product: 'SRB + CERES', icon: 'sun',     color: 'dry' },
  AOD_55:            { label: 'Haze (aerosol)',           unit: 'AOD',       product: 'CERES',   icon: 'haze',        color: 'dry' },
};
export const VAR_IDS = Object.keys(VARS);

// Physical limits. A straight-line extrapolation can run past them (106 % cloud, negative sunlight); cap it and say so.
const LIMITS = { PRECTOTCORR: [0, Infinity], WS10M: [0, Infinity], RH2M: [0, 100], GWETROOT: [0, 1], CLOUD_AMT: [0, 100], ALLSKY_SFC_SW_DWN: [0, Infinity], AOD_55: [0, Infinity] };
export function bound(id, v) { const [lo, hi] = LIMITS[id] || [-Infinity, Infinity]; const c = Math.min(hi, Math.max(lo, v)); return { value: c, capped: c !== v }; }

const BASE = 'https://power.larc.nasa.gov/api/temporal';
const key = (lat, lon) => `procella:power:${lat.toFixed(2)},${lon.toFixed(2)}`;

async function getJSON(url, ms = 25000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`NASA POWER answered ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Monthly + annual values for every variable at one point, 1981 to endYear.
// Returns { lat, lon, source, fetchedAt, monthly: {VAR: {YYYYMM: v}}, annual: {VAR: {years, values}} }
export async function fetchPoint(lat, lon, endYear = 2025) {
  const url = `${BASE}/monthly/point?parameters=${VAR_IDS.join(',')}&community=AG&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start=1981&end=${endYear}&format=JSON`;
  let raw, source = 'live', fetchedAt = new Date().toISOString();
  try {
    raw = await getJSON(url);
    try { localStorage.setItem(key(lat, lon), JSON.stringify({ raw, fetchedAt })); } catch { /* storage full or blocked */ }
  } catch (err) {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(key(lat, lon))); } catch { /* blocked */ }
    if (!cached) throw err;
    ({ raw, fetchedAt } = cached); source = 'cached';
  }
  return { lat, lon, source, fetchedAt, elevation: raw.geometry?.coordinates?.[2], ...parse(raw.properties.parameter) };
}

function parse(parameter) {
  const monthly = {}, annual = {};
  for (const id of VAR_IDS) {
    const p = parameter[id] || {}, m = {}, years = [], values = [];
    for (const [k, v] of Object.entries(p)) {
      if (v === -999 || v == null || !Number.isFinite(v)) continue; // fill value: missing
      if (k.endsWith('13')) { years.push(+k.slice(0, 4)); values.push(v); } // key 13 = POWER's annual mean
      else m[k] = v;
    }
    monthly[id] = m; annual[id] = { years, values };
  }
  return { monthly, annual };
}

// Satellite rainfall cross-check: GPM IMERG daily (POWER serves IMERG at daily resolution only, from 1998).
export async function fetchImergMonth(lat, lon, year, month) {
  if (year < 1998) return null;
  const mm = String(month).padStart(2, '0'), last = new Date(year, month, 0).getDate();
  const url = `${BASE}/daily/point?parameters=IMERG_PRECTOT&community=AG&time-standard=UTC&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start=${year}${mm}01&end=${year}${mm}${last}&format=JSON`;
  const vals = Object.values((await getJSON(url)).properties.parameter.IMERG_PRECTOT).filter(v => v !== -999);
  return vals.length ? { mean: vals.reduce((s, v) => s + v, 0) / vals.length, wetDays: vals.filter(v => v >= 1).length, days: vals.length } : null;
}

// Values for one year and month (or the year's annual mean when month is 13).
export function snapshot(pt, year, month) {
  const out = {};
  for (const id of VAR_IDS) {
    const k = `${year}${String(month).padStart(2, '0')}`;
    out[id] = month === 13 ? pt.annual[id].values[pt.annual[id].years.indexOf(year)] : pt.monthly[id][k];
  }
  return out;
}

// Mean of each calendar month across all years: the "normal" a value is compared with.
export function climatology(pt, id, month) {
  const v = Object.entries(pt.monthly[id]).filter(([k]) => +k.slice(4) === month).map(([, x]) => x);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined;
}

// Nominatim: place search and reverse lookup (names for NPC villages).
export async function geocode(q) {
  return getJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, 12000);
}
export async function reverse(lat, lon, zoom = 12) {
  try { return await getJSON(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&zoom=${zoom}&format=json`, 8000); }
  catch { return null; }
}
