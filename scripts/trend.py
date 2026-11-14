#!/usr/bin/env python3
"""Trend of one NASA POWER (MERRA-2 / CERES derived) variable at one point.

    python3 scripts/trend.py --lat 23.22 --lon 72.65 --param T2M --start 1981 --end 2025
    python3 scripts/trend.py --selftest

Fetches POWER's own annual mean (month key 13), runs Mann-Kendall (tie-corrected) and Sen's slope,
and prints the rate of change per year with an OLS slope as a cross-check. Stdlib only.
ponytail: no Sen CI, no autocorrelation correction; the app engine adds both.
"""
import argparse, json, math, urllib.request
from itertools import combinations
from statistics import linear_regression, median

URL = ("https://power.larc.nasa.gov/api/temporal/monthly/point?parameters={p}&community=AG"
       "&latitude={lat}&longitude={lon}&start={s}&end={e}&format=JSON")


def annual(lat, lon, param, start, end):
    with urllib.request.urlopen(URL.format(p=param, lat=lat, lon=lon, s=start, e=end), timeout=60) as r:
        raw = json.load(r)["properties"]["parameter"][param]
    # key YYYY13 is the annual mean; -999 is fill (variable not yet available, or incomplete year)
    return {int(k[:4]): v for k, v in raw.items() if k.endswith("13") and v != -999}


def mann_kendall(x):
    n = len(x)
    s = sum((b > a) - (b < a) for a, b in combinations(x, 2))
    ties = [x.count(v) for v in set(x)]
    var = (n * (n - 1) * (2 * n + 5) - sum(t * (t - 1) * (2 * t + 5) for t in ties)) / 18
    z = (s - (s > 0) + (s < 0)) / math.sqrt(var)  # continuity correction; 0 when s == 0
    return s, var, z, math.erfc(abs(z) / math.sqrt(2))  # two-sided p


def sen_slope(t, x):
    return median((x[j] - x[i]) / (t[j] - t[i]) for i, j in combinations(range(len(x)), 2))


def trend(series):
    t = sorted(series)
    x = [series[y] for y in t]
    s, var, z, p = mann_kendall(x)
    return dict(years=f"{t[0]}-{t[-1]}", n=len(t), s=s, z=round(z, 4), p=p,
                sen_per_year=sen_slope(t, x), ols_per_year=linear_regression(t, x).slope,
                verdict="detected" if p < 0.05 and len(t) >= 15 else
                        "too short to judge" if len(t) < 15 else "not detectable yet")


def selftest():
    s, var, z, p = mann_kendall(list(range(1, 11)))
    assert (s, var) == (45, 125.0) and abs(z - 3.9355) < 1e-3 and p < 1e-4, (s, var, z, p)
    assert sen_slope([1, 2, 3, 4], [2, 4, 6, 8]) == 2 and abs(linear_regression([1, 2, 3, 4], [2, 4, 6, 8]).slope - 2) < 1e-12
    # reference values from pymannkendall.original_test on a tied series (checked 2026-11-14)
    s, var, z, p = mann_kendall([1, 2, 2, 3, 3, 3, 5, 4, 6, 7])
    assert s == 39 and abs(var - 120.3333333) < 1e-6 and abs(z - 3.4641) < 1e-4, (s, var, z)
    print("selftest ok")


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--lat", type=float); a.add_argument("--lon", type=float)
    a.add_argument("--param", default="T2M"); a.add_argument("--start", type=int, default=1981)
    a.add_argument("--end", type=int, default=2025); a.add_argument("--selftest", action="store_true")
    o = a.parse_args()
    if o.selftest:
        selftest()
    else:
        print(json.dumps(trend(annual(o.lat, o.lon, o.param, o.start, o.end)), indent=2))
