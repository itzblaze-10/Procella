# Data Access Notes — verified, not assumed

Tested from this Mac on 2026-11-14.

## NASA POWER (primary source)

Endpoint: `https://power.larc.nasa.gov/api/temporal/monthly/point`
Example: `?parameters=T2M,PRECTOTCORR&community=AG&latitude=23.22&longitude=72.65&start=1981&end=2024&format=JSON`

- **Open, no login.** Response header `access-control-allow-origin: *`, so the browser can call it live.
- **Month key `13` is the annual mean.** Each year has keys `YYYY01`..`YYYY12` plus `YYYY13`. Drop `13`
  from any monthly series or the trend is corrupted.
- **`-999.0` is the fill value.** Convert to missing before any maths.
- **Each variable has its own start year.** `ALLSKY_SFC_SW_DWN` returned `-999` for 1981, so its record
  starts later. Store a valid start year per variable in metadata and trim to it.
- Pin `community=AG` so units stay consistent across calls.
- Values are MERRA-2 / CERES derived. Reanalysis can contain steps where the observing system changed.
- Rate limits are not documented; keep a committed snapshot fallback for the demo.

## ORNL DAAC MODIS REST (second source, vegetation)

Base: `https://modis.ornl.gov/rst/api/v1/`
- Open, no login. CORS reflects the caller's origin, so browser calls work.
- `GET /products` lists products. `GET /MOD13Q1/dates?latitude=..&longitude=..` lists 16-day dates
  (first date 2000-02-18). `GET /MOD13Q1/bands` gives scale factors and fill values.
- NDVI band `250m_16_days_NDVI`: scale factor `0.0001`, fill value `-3000`, valid range -2000 to 10000
  (verified against the `/MOD13Q1/bands` call). Apply both before any maths.
- Record is about 25 years: label results "greenness change 2000 to present", never "climate trend".
- Per-request date caps exist; long series need chunked calls. Not yet measured.

## Login-walled or fragile (do not build the core on these)

| Source | Problem |
|---|---|
| Giovanni | Earthdata login, no stable public API |
| AppEEARS | Earthdata login, queued jobs (minutes to hours), tokens expire |
| GES DISC OPeNDAP / Harmony | Earthdata login, NetCDF parsing, slow |
| KNMI Climate Explorer | Human-verification wall, maintenance windows, no API |
| NOAA CDO | Emailed token, paged results, gappy station records |
| Firecrawl | Out of credits until 2026-11-17 |
| Medium article | HTTP 403 to scripts |

## Local toolchain

Python 3.14.4 (no numpy, scipy, pandas installed), Node 26.10. For the Mann-Kendall test fixtures use a
separate Python 3.12 virtual environment (`uv venv --python 3.12`) with `pymannkendall`; avoid
3.14 scientific wheels until proven.

## Found by the partner's exploration scripts (pushed 2026-11-14 13:04, verified 13:2x)

| Source | Finding |
|---|---|
| NASA GISTEMP CSV (`data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv`) | Open, HTTP 200, global annual anomaly. No CORS header, so fetch it in a build script and commit the result; do not call it from the browser |
| NASA CMR search (via `earthaccess.search_data`) | Search is open, no login (verified: MERRA-2 M2TMNXSLV collection found). Downloads need a free Earthdata Login |
| GRACE mascon (`TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4`) | Single NetCDF covering 2002 to present; download needs Earthdata Login. Candidate for a precomputed water-storage case |
