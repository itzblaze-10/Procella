# Starter Roadmap — from a variable to a rate of change per year

The four steps the challenge expects, with a worked example we actually ran.

| Step | What you do | Where | Status |
|---|---|---|---|
| 1 | Pick a variable named by the statement (MERRA-2, GLDAS, AIRS, GPM or MODIS) and preview it for one region | NASA Giovanni | Manual, needs a logged-in browser (see below) |
| 2 | Download a daily or monthly series for that region, long enough for a test (20+ years) | Giovanni CSV, or NASA POWER (open) | POWER done |
| 3 | Test the trend with Mann-Kendall (or a t-test) | `scripts/trend.py` | Done, verified |
| 4 | Report the rate of change per year | Sen's slope, OLS as cross-check | Done |

## Step 1 — Giovanni preview (needs a person signed in)

Giovanni (https://giovanni.gsfc.nasa.gov/giovanni/) needs a free NASA Earthdata Login to plot. Claude
never types passwords, so the order is: you sign in once in Chrome, then say so, and Claude can drive
the Giovanni page in that signed-in session: choose "Time Series, Area-Averaged", pick the variable and
a bounding box, set the date range, plot, and download the CSV. The click-by-click version with the
exact menu names is in `docs/data-reality.md` once the data research lands.

## Steps 2 to 4 — worked example we ran (no login)

Variable: MERRA-2 derived 2 m air temperature (`T2M`) and corrected precipitation (`PRECTOTCORR`),
served by NASA POWER. Region: the MERRA-2 grid cell over Gandhinagar (23.22 N, 72.65 E).
Series: annual means, 1981 to 2025, 45 years. Test: Mann-Kendall, tie-corrected, two-sided.

```bash
python3 scripts/trend.py --selftest
python3 scripts/trend.py --lat 23.22 --lon 72.65 --param T2M --start 1981 --end 2025
python3 scripts/trend.py --lat 23.22 --lon 72.65 --param PRECTOTCORR --start 1981 --end 2025
```

| Variable | Sen's slope per year | OLS slope per year | Mann-Kendall z | p | Verdict |
|---|---|---|---|---|---|
| T2M (air temperature) | -0.0134 °C | -0.0131 °C | -1.585 | 0.113 | Not detectable yet |
| PRECTOTCORR (rainfall) | +0.0210 mm/day (about +7.7 mm of yearly total per year) | +0.0203 mm/day | +2.642 | 0.0083 | Detected, rising |

Both tests are identical to `pymannkendall.original_test` (S, Z, p and Sen's slope matched on the live series).

**What to say about it:** Gandhinagar's rainfall has risen detectably over 45 years while its
annual-mean temperature shows no detectable trend in this model-derived record. A non-significant
result is still a finding: it means "cannot be told apart from year-to-year noise at this record
length", not "nothing changed".

**Honest caveats:** POWER values are MERRA-2 and CERES model-derived, not direct station or satellite
readings. The region is one MERRA-2 grid cell (about 0.5 by 0.625 degrees). The script has no Sen
confidence interval and no autocorrelation correction; the app's engine adds both.
