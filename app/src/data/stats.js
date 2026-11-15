// Trend statistics. Mann-Kendall (tie-corrected), Sen's slope with Gilbert 95% CI, Spearman correlation,
// linear projection. Verified against pymannkendall in data/stats.test.mjs.
// ponytail: O(n^2) pairwise slopes; fine for annual series (n <= 50). Aggregate before passing daily data.

export function erfc(x) { // Numerical Recipes erfcc, |error| < 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

export function mannKendall(x) {
  const n = x.length; let s = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) s += Math.sign(x[j] - x[i]);
  const counts = new Map(); x.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  let ties = 0; counts.forEach(t => { ties += t * (t - 1) * (2 * t + 5); });
  const variance = (n * (n - 1) * (2 * n + 5) - ties) / 18;
  const z = variance > 0 ? (s - Math.sign(s)) / Math.sqrt(variance) : 0;
  return { s, variance, z, p: erfc(Math.abs(z) / Math.SQRT2) };
}

const median = a => { const b = [...a].sort((p, q) => p - q), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

export function senSlope(t, x, variance) {
  const slopes = [];
  for (let i = 0; i < x.length - 1; i++) for (let j = i + 1; j < x.length; j++) slopes.push((x[j] - x[i]) / (t[j] - t[i]));
  slopes.sort((a, b) => a - b);
  const slope = median(slopes), intercept = median(x) - slope * median(t);
  // Gilbert (1987) confidence interval at 95%
  const c = 1.959964 * Math.sqrt(variance), N = slopes.length;
  const lo = slopes[Math.max(0, Math.round((N - c) / 2) - 1)], hi = slopes[Math.min(N - 1, Math.round((N + c) / 2))];
  return { slope, intercept, lo, hi };
}

export const MIN_YEARS = 15;

// series: {years: number[], values: number[]} with no missing values
export function trend({ years, values }) {
  const n = values.length;
  if (n < 3) return { n, verdict: 'short' };
  const mk = mannKendall(values), sen = senSlope(years, values, mk.variance);
  const verdict = n < MIN_YEARS ? 'short' : mk.p < 0.05 ? 'detected' : 'null';
  return { n, from: years[0], to: years[n - 1], ...mk, ...sen, verdict, direction: sen.slope >= 0 ? 'up' : 'down' };
}

// Start-year check: how fragile is the verdict?
export function sensitivity(series, starts) {
  return starts.map(s0 => {
    const keep = series.years.map((y, i) => y >= s0 ? i : -1).filter(i => i >= 0);
    return { start: s0, ...trend({ years: keep.map(i => series.years[i]), values: keep.map(i => series.values[i]) }) };
  });
}

// Straight-line extrapolation of the Sen line with the CI slopes pivoting at the median point.
// This is a statistical extrapolation, never a forecast.
export function project(series, tr, year) {
  const ty = median(series.years), tx = median(series.values);
  return { year, value: tr.intercept + tr.slope * year, lo: tx + tr.lo * (year - ty), hi: tx + tr.hi * (year - ty) };
}

function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function pearson(a, b) {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}
// Spearman rank correlation on the years both series share; p from Fisher's z.
// detrended: correlate what is left after removing each series' own Sen line (shared trends removed).
export function correlate(a, b, detrended = false) {
  const yrs = a.years.filter(y => b.years.includes(y));
  let va = yrs.map(y => a.values[a.years.indexOf(y)]), vb = yrs.map(y => b.values[b.years.indexOf(y)]);
  if (detrended) {
    const ta = trend({ years: yrs, values: va }), tb = trend({ years: yrs, values: vb });
    va = va.map((v, i) => v - (ta.intercept + ta.slope * yrs[i]));
    vb = vb.map((v, i) => v - (tb.intercept + tb.slope * yrs[i]));
  }
  const n = yrs.length, r = pearson(ranks(va), ranks(vb));
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r))) * Math.sqrt(Math.max(1, n - 3));
  return { r, n, p: erfc(Math.abs(z) / Math.SQRT2) };
}
