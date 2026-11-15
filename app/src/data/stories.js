// NPC stories written from the place's own NASA record. Templates only: every number comes from the data,
// nothing is generated, and no line claims a cause.
import { VARS } from './power.js';
import { trend, project } from './stats.js';

export const ROLE_VAR = { farmer: 'PRECTOTCORR', herder: 'GWETROOT', fisher: 'WS10M', factory: 'T2M_MAX', teacher: 'T2M', nurse: 'T2M_MIN', builder: 'ALLSKY_SFC_SW_DWN', vendor: 'AOD_55' };
const JOB = { farmer: 'I farm the fields', herder: 'I graze my animals', fisher: 'I fish the water', factory: 'I work a shift at the plant', teacher: 'I teach at the school', nurse: 'I nurse at the clinic', builder: 'I build houses', vendor: 'I sell at the market' };

// What each person notices, by what the record says. Experience, never cause.
const FEEL = {
  farmer:  { up: 'Planting dates move every year now, and some seasons the fields stand in water.', down: 'We dig the wells deeper and choose seeds that can wait for rain.', null: 'Some years drown us, some years parch us. Nobody can tell me which way it is heading.' },
  herder:  { up: 'The grass holds on longer after the rains than when I was a boy.', down: 'The ground cracks earlier each dry season, so we walk the herd further for grazing.', null: 'Good pasture, bad pasture, it swings from year to year. I read the sky, not a trend.' },
  fisher:  { up: 'More days the wind keeps the boats on the beach.', down: 'The water lies flatter on more mornings than it used to.', null: 'Calm weeks, wild weeks. The sea keeps its own counsel.' },
  factory: { up: 'The afternoon shift feels heavier. We take water breaks we never needed.', down: 'Afternoons on the floor are a little easier than my first years.', null: 'Hot weeks come and go. I could not tell you if the summers are changing.' },
  teacher: { up: 'Children wilt in the classroom by noon. We moved lessons earlier.', down: 'The classroom is gentler than it was.', null: 'Each year is its own. I teach the children to measure before they believe.' },
  nurse:   { up: 'Warmer nights bring more tired patients who could not sleep.', down: 'Nights cool down better than they used to.', null: 'Night-time heat goes up and down. I have no pattern to tell you.' },
  builder: { up: 'Brighter days on site. We start before sunrise to finish before the glare.', down: 'The sun on site is softer than it was. Some say it is the haze.', null: 'Bright years, dull years. The sun keeps no schedule for us.' },
  vendor:  { up: 'Some mornings the market is grey with haze and my throat is sore by noon.', down: 'The air over the stalls looks clearer than a few years back.', null: 'Clear days, hazy days. I cannot say it is getting worse or better.' },
};

const NAMES = {
  southAsia: ['Meera', 'Arjun', 'Kavya', 'Ravi', 'Lakshmi', 'Imran', 'Pooja', 'Suresh'],
  eastAsia: ['Wei', 'Lin', 'Hana', 'Jun', 'Mei', 'Kenji', 'Yuna', 'Bao'],
  africa: ['Amara', 'Kofi', 'Zainab', 'Tendai', 'Nia', 'Chidi', 'Fatou', 'Juma'],
  mena: ['Layla', 'Omar', 'Yasmin', 'Karim', 'Noor', 'Samir', 'Huda', 'Tariq'],
  europe: ['Elena', 'Lukas', 'Sofia', 'Mateo', 'Ingrid', 'Pierre', 'Anna', 'Jonas'],
  americas: ['Lucia', 'Diego', 'Maya', 'Carlos', 'Sara', 'Tomas', 'Ana', 'Miguel'],
  north: ['Emma', 'Liam', 'Ava', 'Noah', 'Grace', 'Owen', 'Chloe', 'Ethan'],
  oceania: ['Aroha', 'Tama', 'Mia', 'Jack', 'Leilani', 'Kai', 'Ruby', 'Mason'],
  polar: ['Aput', 'Inga', 'Nuka', 'Sven', 'Malik', 'Freya', 'Ivalu', 'Erik'],
};
function region(lat, lon) {
  if (Math.abs(lat) > 62) return 'polar';
  if (lon > 60 && lon < 95 && lat > 5 && lat < 37) return 'southAsia';
  if (lon >= 95 && lon < 150 && lat > -10) return 'eastAsia';
  if (lon > 110 && lat <= -10) return 'oceania';
  if (lon > 25 && lon <= 60 && lat > 12 && lat < 42) return 'mena';
  if (lon > -20 && lon <= 52 && lat <= 12 && lat > -36) return 'africa';
  if (lon > -20 && lon <= 25 && lat > 12 && lat < 37) return 'mena';
  if (lon > -25 && lon <= 60 && lat >= 36) return 'europe';
  if (lon <= -30 && lat < 25) return 'americas';
  if (lon <= -30) return 'north';
  return 'americas';
}
export const nameFor = (lat, lon, seed) => { const list = NAMES[region(lat, lon)]; return list[Math.abs(seed) % list.length]; };

const fmt = (x, d = 2) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
export const VERDICT_WORD = { detected: 'Detected', null: 'Not detectable yet', short: 'Too short to judge' };

// pt: fetchPoint result. ctx: { year, month, mode: 'year'|'future', futureYear, placeName }
export function storyFor(role, seed, pt, ctx) {
  const id = ROLE_VAR[role], meta = VARS[id], series = pt.annual[id];
  const name = nameFor(pt.lat, pt.lon, seed), tr = trend(series), lines = [];
  lines.push(`I'm ${name}. ${JOB[role]} near ${ctx.placeName}.`);
  const i = series.years.indexOf(Math.min(ctx.year, series.years.at(-1)));
  const mean = series.values.reduce((s, v) => s + v, 0) / series.values.length;
  if (ctx.mode === 'year' && i >= 0) {
    const v = series.values[i], diff = v - mean;
    lines.push(`In ${series.years[i]} the ${meta.label.toLowerCase()} here averaged ${v.toFixed(2)} ${meta.unit}, ${Math.abs(diff) < 0.02 * Math.abs(mean) ? 'about the usual' : diff > 0 ? 'above' : 'below'} the ${series.years[0]} to ${series.years.at(-1)} average of ${mean.toFixed(2)}.`);
  }
  if (tr.verdict === 'short') lines.push(`NASA's record here is only ${tr.n} years long. That is too short to judge a trend.`);
  else lines.push(`Over ${tr.n} years NASA's record shows ${meta.label.toLowerCase()} here changing by ${fmt(tr.slope * 10, 3)} ${meta.unit} per decade. Verdict: ${VERDICT_WORD[tr.verdict]} (p = ${tr.p < 0.001 ? tr.p.toExponential(1) : tr.p.toFixed(3)}).`);
  lines.push(FEEL[role][tr.verdict === 'detected' ? tr.direction : 'null']);
  if (ctx.mode === 'future' && tr.verdict !== 'short') {
    const pr = project(series, tr, ctx.futureYear);
    lines.push(`If that straight line simply continued, ${ctx.futureYear} would sit near ${pr.value.toFixed(2)} ${meta.unit} (range ${Math.min(pr.lo, pr.hi).toFixed(2)} to ${Math.max(pr.lo, pr.hi).toFixed(2)}). That is an extrapolation of the past, not a forecast.`);
  }
  return { name, role, variable: id, meta, trend: tr, series, lines, source: `NASA POWER · ${meta.product} · ${series.years[0]}–${series.years.at(-1)}` };
}
