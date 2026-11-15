// Run: node app/src/data/stats.test.mjs  (reference values from pymannkendall.original_test, 14 Nov 2026)
import { mannKendall, trend, correlate } from './stats.js';
import assert from 'node:assert/strict';
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) < tol, `${m}: ${a} vs ${b}`);
let r = mannKendall([1,2,2,3,3,3,5,4,6,7]); assert.equal(r.s, 39); near(r.variance, 120.3333333, 1e-6, 'var'); near(r.z, 3.4641016, 1e-6, 'z');
r = mannKendall([...Array(10)].map((_, i) => i + 1)); assert.equal(r.s, 45); near(r.p, 8.303070332638107e-05, 1e-7, 'p');
const years = [...Array(45)].map((_, i) => 1981 + i);
const T2M = [27.13,27.31,27.05,27.29,28.2,28.17,29.12,28.22,27.93,27.9,28.28,27.73,28.35,26.78,28.39,27.62,26.78,27.88,28.45,28.31,28.07,28.64,27.32,27.7,26.81,27.3,27.27,27.35,28.45,27.65,27.33,27.41,26.68,27.49,28.0,28.09,27.49,28.36,27.13,26.81,27.58,27.47,27.09,27.39,26.74];
const t = trend({ years, values: T2M });
assert.equal(t.s, -163); near(t.z, -1.5851, 1e-4, 'gnr z'); near(t.p, 0.11294, 1e-5, 'gnr p'); near(t.slope, -0.013374, 1e-6, 'gnr sen'); assert.equal(t.verdict, 'null');
assert.ok(t.lo <= t.slope && t.slope <= t.hi, 'CI brackets slope');
const c = correlate({ years, values: T2M }, { years, values: T2M.map(v => -v) }); near(c.r, -1, 1e-9, 'spearman');
console.log('stats ok', { sen: t.slope.toFixed(5), ci: [t.lo.toFixed(4), t.hi.toFixed(4)], p: t.p.toFixed(5) });
