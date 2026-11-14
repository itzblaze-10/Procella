# Procella: data reality report

Run date 2026-11-14 (IST). Everything marked VERIFIED was queried or computed in this session. Anything else is marked UNVERIFIED. Raw screening table: `data/trend-screen-2026-11-14.csv` (221 rows, all 221 re-checked against `pymannkendall.original_test`, max |dz| 4.9e-5, |dp| 4.9e-5, |dSen| 5e-7, all from CSV rounding). Throwaway scripts and cached raw JSON sit beside this file (`fetch_monthly.py`, `fetch_imerg.py`, `screen.py`, `verify.py`, `sens2.py`, `ndvi.py`, `ndvi_trend.py`, `raw/`).

## 0. Findings that change the plan

1. **The strategy's proposed precipitation twin (central Chile vs central Sahel) does not survive a cross-check.** NASA POWER's `PRECTOTCORR` (MERRA-2) shows Chile drying (p=1.6e-5) and Sahel wetting (p=9.8e-5), but satellite IMERG over 1998-2025 shows Sahel flat (p=0.71) and Chile only borderline (p=0.079). The MERRA-2 Chile series has a visible step down around 2004-2007 and a mean of 0.98 mm/day against IMERG's 2.23. Do not ship that pair as a headline.
2. **MERRA-2 `PRECTOTCORR` has a suspected discontinuity at the Ganges Delta**: annual means sit at 3 to 6 mm/day until 2015, then jump to 7 to 11.5 mm/day in 2016-2025 (Sen +0.091 mm/day/yr, p=2.8e-7). IMERG at the same point shows no trend (p=0.62) and the two series correlate at r=0.31. Treat it as an artefact until proven otherwise. Congo Basin: MERRA-2 vs IMERG correlation is r=-0.16, IMERG trend p=0.80.
3. **Cross-source agreement is the best credibility filter we found.** Where MERRA-2 and IMERG agree on sign and significance (Beijing up, Rondonia down), the result is solid. Where only one says "detected", flag it.
4. **No 2 m temperature twin exists in our 16 regions.** All 11 significant `T2M` trends are warming; the 5 non-significant ones include small negative slopes. Opposite signs live in rainfall, sunlight, aerosol, humidity, cloud, ozone, not in temperature.
5. **Surface sunlight, longwave and cloud amount are spliced from two products**: GEWEX SRB up to about 2000, CERES SYN1deg after (verified from the POWER response header `sources` per date range, section 1). The Delhi and Chile sunlight twin holds in each product on its own (section 5), so it is safe. South-east US sunlight is not (SYN1deg-only p=0.53).
6. **Giovanni cannot be the app's core.** Downloads need an Earthdata Login (cited below). All GES DISC file hosts for MERRA-2, GLDAS and GPM IMERG answer with a 302 to `urs.earthdata.nasa.gov` (verified). The GES DISC Hydrology Data Rods point service now 301-redirects to a "service will be discontinued" alert (verified).
7. **POWER monthly `IMERG_PRECTOT` returns -999 for every month (all years, all 16 regions)**. IMERG exists in POWER at daily resolution only (1998-01-01 onward, needs `time-standard=UTC`). Build IMERG annual means from daily data (rule: at least 360 valid days).
8. **ORNL MODIS is slow and capped**: 10 dates per request, 8 to 59 s per call (single calls) and 502 proxy errors under 3 parallel callers. Snapshot it; do not call it live from the demo (section 6).

## 1. Access map

### 1.1 Which POWER parameter comes from which source (VERIFIED)

The parameter catalogue endpoint (`/api/system/manager/parameters?community=AG&temporal=monthly|daily`, 1388 monthly entries, 152 daily entries) labels `source` only as "SOURCE" or "POWER" and carries no dataset name. The dataset names below come from the `header.sources` array of an actual data response, queried one parameter at a time at Gandhinagar for 1981-2025 monthly and 5 recent days daily.

| POWER parameter | Dataset(s) in response header | Mission or model | Monthly | Daily |
|---|---|---|---|---|
| T2M, TS, PRECTOTCORR, GWETROOT/TOP/PROF, QV2M, T2MDEW, PS, TO3, EVLAND, TQV | MERRA2 | MERRA-2 reanalysis | yes | yes |
| RH2M, WS10M, WS2M, T2M_MAX, T2M_MIN | MERRA2 + POWER | MERRA-2, POWER-derived | yes | yes |
| ALLSKY_SFC_SW_DWN, CLRSKY_SFC_SW_DWN, ALLSKY_SFC_LW_DWN, ALLSKY_SFC_PAR_TOT | SRB (to about 2000) + SYN1DEG | GEWEX SRB then CERES SYN1deg | yes | yes |
| CLOUD_AMT | SRB + SYN1DEG | same | yes | yes |
| AOD_55, AOD_84, CLOUD_OD, PW | SYN1DEG | CERES SYN1deg | yes | yes |
| ALLSKY_KT | SYN1DEG + POWER | CERES + POWER derived | yes | yes |
| IMERG_PRECTOT | IMERG (response `sources` was empty in the monthly call; the daily header says `["IMERG"]`) | GPM IMERG | monthly returns only -999 | daily only, UTC |
| PRECTOT (non-corrected) | MERRA2 | MERRA-2 | not served (empty) | empty at Gandhinagar |

Splice check (Delhi point, monthly, by date range): SW, LW and cloud read `['SRB']` for 1984-1999, `['SRB','SYN1DEG']` for 2000-2002, `['SYN1DEG']` for 2003-2025. `AOD_55` is empty before 2000 and `['SYN1DEG']` from 2000. `T2M` and `PRECTOTCORR` are `['MERRA2']` throughout.

Not in POWER (VERIFIED by absence in the 1388-entry monthly catalogue and the header scans): AIRS retrievals, OMI retrievals, MODIS products, GLDAS land-model fields. `TO3` (column ozone) is MERRA-2; that MERRA-2 assimilates OMI ozone is from memory (UNVERIFIED here). POWER's `GWET*` are MERRA-2 soil wetness, not GLDAS.

Resolution reminder: POWER returns the nearest MERRA-2 cell (0.5 x 0.625 degrees) for MERRA-2 fields, 1 x 1 degree for CERES SYN1deg and SRB fields, and 0.1 degrees for IMERG. A "point" is a cell average of 50 to 110 km.

### 1.2 Per-source routes

| Source | Open, no login | Login route | Checked |
|---|---|---|---|
| MERRA-2 | NASA POWER monthly and daily point API (CORS `*`); CMR collection search (`M2TMNXSLV` v5.12.4, 1980-01-01 to ongoing) | GES DISC HTTPS or OPeNDAP, Earthdata Login | `goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2_MONTHLY/...nc4` returned 302 to urs.earthdata.nasa.gov |
| GLDAS | none found. POWER does not carry it. Hydrology Data Rods timeseries URL: 301 to a discontinuation alert | GES DISC `hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/GLDAS_NOAH025_M.2.1/...` (v2.1: 2000-01-01 to ongoing, v2.0: 1948-2014) | 302 to URS; CMR collection search open |
| AIRS | none for data. CMR search is open (`AIRS3STM` v7 and v6, 2002-09-01 to ongoing) | GES DISC, Giovanni, Earthdata Search, Harmony; all behind Earthdata Login | AIRS file download itself UNVERIFIED (same archive family returned 302) |
| GPM IMERG | POWER daily `IMERG_PRECTOT` (1998-01-01 to 2025-12-31 verified; `time-standard=UTC`) | GES DISC `GPM_3IMERGM` v07 (CMR says 1998-01-01 to 2025-09-30), Earthdata Login | `gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGM.07/...HDF5` returned 302 to URS |
| MODIS | ORNL DAAC MODIS REST `modis.ornl.gov/rst/api/v1` (no login, CORS reflects origin) | AppEEARS, LAADS, Earthdata Search (Earthdata Login) | subset call returned data |
| OMI | none for data. CMR search open (`OMTO3e` 2004-10-01, `OMAEROe` 2004-10-01 on) | GES DISC, Giovanni (Earthdata Login) | ozonewatch.gsfc.nasa.gov did not respond from here (UNVERIFIED) |

Practical consequence: for the app, MERRA-2 and IMERG come through POWER, CERES-family radiation and aerosol come through POWER, MODIS comes through ORNL. AIRS and OMI have no open data route we could verify. Say so honestly in the app ("AIRS and OMI need an Earthdata login; we point to Giovanni for them").

### 1.3 Does Giovanni need an Earthdata Login? Yes for download, partially for plotting

Source: Giovanni User Guide Version 2024.1, `https://giovanni.gsfc.nasa.gov/giovanni/doc/UsersManualworkingdocument.docx.html`.

- Quick Start, "Earthdata Login Requirement": "As of early January 2019, it is necessary to use the Earthdata Login username and password to access full Giovanni functionality and data holdings." and "Earthdata Login was required to download data."
- Same section: "If an Earthdata Login username and login are not entered, a user can proceed in 'guest mode' by clicking on the 'Continue with limited access' button". After registering, "it is necessary to authorize the NASA GESDISC DATA ARCHIVE application before using Giovanni."
- Release notes 4.24: "Giovanni therefore now requires users to login before data can be downloaded." and "Plots can still be generated and downloaded without logging in".
- Release notes 4.29: "Giovanni guest users are limited to a maximum of 4 time points for most services" and guests "cannot download files produced by Giovanni." 4.30: "the guest mode limitations will be displayed under each plot."
- Whether the 4-time-point guest limit still applies today is UNVERIFIED (release notes are historical, the guide does not restate it in the quick start). A raw call to the legacy `service_manager.pl` endpoint without credentials returned a "Launching workflow" session for both `TmAvMp` and `ArAvTs`; I did not poll it to completion and we should not build on it.
- A forum post (not official documentation) says the Giovanni time-series API accepts single points only and cannot return area averages; it also states area-averaged time series are downloadable as CSV with a date column and an area-average column. Treat as hint.

### 1.4 Starter roadmap: preview one variable for one region in Giovanni and download the CSV (logged in)

Steps follow the guide's own sections (Visualization Type Selection, Date Range Selection, Region-of-Interest Selection, Variable Selection, Plot Data, Download). The guide has no single consolidated step list; this is assembled from those sections. Exact on-screen labels for individual variables are UNVERIFIED because I could not log in.

1. Open `https://giovanni.gsfc.nasa.gov/giovanni/`. Click the Earthdata Login button at top right and sign in. If this is a first use, authorize the "NASA GESDISC DATA ARCHIVE" application in your Earthdata profile. (Guest mode: "Continue with limited access", which blocks downloads.)
2. In "Select Plot" (default Time Averaged Map) open the menu and choose "Time Series, Area-Averaged" (the guide says Area-Averaged Time Series is the default for time series).
3. In "Select Date Range" type the start and end in YYYY-MM-DD (for example 1981-01-01 to 2025-12-31), or use the drop-down calendars. Pick dates inside the variable's record.
4. In "Select Region" either enter the bounding box as West, South, East, North (for Gandhinagar a box wider than one MERRA-2 cell, for example 72.0, 22.5, 73.0, 23.5), or drag a box on the map, or pick a shape from the Shape menu.
5. In "Select Variables" use the faceted search or the keyword search (for example "MERRA-2 2-meter air temperature monthly"). When results are listed, tick the variable (one or several; variables of the same quantity type should share y-axis settings).
6. Press the green "Plot Data" button. Wait for the plot to render; the result appears in the History tree on the left.
7. Download: the guide says the time series "can be downloaded as a Microsoft Excel Comma-Separated Values (CSV, .csv) file" and the plot as a PNG, from the Downloads choices on the plot; NetCDF is under "Downloads" in the History tree at left. The guide says an actual GeoTIFF cannot be downloaded.
8. Sanity-check: area-average over a box differs slightly from POWER's single-cell values; the CSV has a date column and a mean column. Feed it to the same Mann-Kendall and Sen's slope routine.

Known guide caveats worth surfacing in the roadmap: Microsoft Edge may not persist guest-mode state; "unexpected error trying to communicate with Earthdata" means click Login again; after a reload, click "Plots" to regenerate image download links.

## 2. Variable catalogue (15 live, no login)

First valid year is the first calendar year with a valid annual value (POWER key 13) at all 16 regions unless noted, and daily first dates were queried at Gandhinagar. Units are as returned by the POWER response.

| # | Variable | ID | Plain-English definition (high-school level) | Units | Source | Monthly first valid | Daily first valid |
|---|---|---|---|---|---|---|---|
| 1 | 2 m air temperature | `T2M` | How hot the air is at about head height | deg C | MERRA-2 | 1981 | 1981-01-01 |
| 2 | Skin temperature | `TS` | How hot the ground or sea surface itself is, like touching a pavement | deg C | MERRA-2 | 1981 | 1981-01-01 |
| 3 | Rainfall (model, gauge-corrected) | `PRECTOTCORR` | Average rain and snow reaching the ground, shown as millimetres per day | mm/day | MERRA-2 | 1981 | 1981-01-01 |
| 4 | Rainfall (satellite) | `IMERG_PRECTOT` | Rain measured by the GPM satellite constellation, blended with rain gauges | mm/day | GPM IMERG | not served (all -999) | 1998-01-01, `time-standard=UTC` |
| 5 | Root-zone soil wetness | `GWETROOT` | How full of water the soil is where plant roots grow, from 0 (dry) to 1 (soaked) | fraction (0 to 1) | MERRA-2 | 1981 (no data over ice or open ocean: Greenland, Antarctic Peninsula, Maldives) | 1981-01-01 |
| 6 | Sunlight at the surface | `ALLSKY_SFC_SW_DWN` | Solar energy reaching the ground each day, clouds included | MJ/m^2/day | SRB then CERES SYN1deg | 1984 | 1984-01-01 |
| 7 | Heat radiated down by the sky | `ALLSKY_SFC_LW_DWN` | Invisible infrared heat that clouds and greenhouse gases send down to the ground | MJ/m^2/day | SRB then CERES SYN1deg | 1984 (1987 Antarctic Peninsula, 1988 Maldives) | 1988-01-01 |
| 8 | Relative humidity | `RH2M` | How close the air is to holding all the water vapour it can (100% means saturated) | % | MERRA-2 + POWER | 1981 | 1981-01-01 |
| 9 | Specific humidity | `QV2M` | Grams of water vapour in each kilogram of air | g/kg | MERRA-2 | 1981 | 1981-01-01 |
| 10 | Wind speed at 10 m | `WS10M` | Average wind speed ten metres above ground, roughly the height of a lamp post | m/s | MERRA-2 + POWER | 1981 | 1981-01-01 |
| 11 | Surface pressure | `PS` | Weight of the air pressing down at ground level (lower at altitude) | kPa | MERRA-2 | 1981 | 1981-01-01 |
| 12 | Cloud amount | `CLOUD_AMT` | Share of the sky covered by cloud | % | SRB then CERES SYN1deg | 1984 | 1984-01-01 |
| 13 | Aerosol optical depth at 550 nm | `AOD_55` | How hazy the air is from dust, smoke and pollution; larger means hazier | dimensionless | CERES SYN1deg | 2001 | 2001-01-01 |
| 14 | Total column ozone | `TO3` | Thickness of the ozone layer above you, in Dobson units | Dobsons | MERRA-2 | 1981 | 1981-01-01 |
| 15 | Greenness (NDVI) | `250m_16_days_NDVI` (MOD13Q1) | How green and leafy the ground looks from space; 0 is bare, near 1 is dense forest | ratio, scale 0.0001, fill -3000 | Terra MODIS via ORNL DAAC | 2001 as first full year (first composite 2000-02-18) | 16-day composites only |

Latest data seen (Gandhinagar, 2026-11-14): daily `T2M` etc. to 2026-11-11, SW/LW to 2026-11-09, `CLOUD_AMT` and `AOD_55` to 2026-08-30; monthly MERRA-2 fields to 2026-09, CERES-family to 2026-07. The last full calendar year for every variable is 2025.

Other available if wanted: `T2M_MAX`, `T2M_MIN`, `T2MDEW`, `T2MWET`, `TQV`, `EVLAND`, `GWETTOP`, `GWETPROF`, `WS2M`, `ALLSKY_KT`, `CLOUD_OD`, `AOD_84`, `ALLSKY_SFC_PAR_TOT`, `PW`.

Annual mean from POWER key 13 for all MERRA-2 and CERES-family fields; IMERG annual mean must be computed from daily values (rule used here: at least 360 valid days).

## 3. Regions (16, all fetched live)

| # | Region | Lat | Lon | Tag | Why it is interesting (from the literature, flagged as motive only) |
|---|---|---|---|---|---|
| 1 | Gandhinagar | 23.22 | 72.65 | monsoon | Home city; semi-arid monsoon, irrigated farmland and urban growth |
| 2 | Delhi | 28.61 | 77.21 | megacity | Heavy aerosol load, widely reported solar dimming |
| 3 | Beijing | 39.90 | 116.40 | megacity | Strong air-quality policy since 2013 |
| 4 | Sahel Niger | 13.0 | 2.0 | monsoon | Post-1980s rainfall recovery debate |
| 5 | Central Chile | -35.0 | -71.0 | agricultural belt | Megadrought since about 2010 |
| 6 | Svalbard | 78.0 | 16.0 | glacier/polar | Fastest Arctic warming |
| 7 | Southeast US | 33.0 | -87.0 | agricultural belt | The "warming hole", falling aerosol |
| 8 | Iowa Corn Belt | 42.0 | -93.5 | agricultural belt | Humidity and rainfall changes tied to cropping |
| 9 | Rondonia Amazon | -10.5 | -63.0 | rain forest | Deforestation arc, lengthening dry season |
| 10 | Congo Basin | 0.5 | 23.0 | rain forest | Second great rain forest, contested drying signal |
| 11 | Tamanrasset Sahara | 22.8 | 5.5 | desert | Hyper-arid baseline |
| 12 | Ganges Delta | 22.0 | 89.5 | estuary/delta | Sea-level and monsoon exposure |
| 13 | Greenland Ice Sheet | 72.0 | -40.0 | glacier/polar | Ice-sheet melt |
| 14 | Tibetan Plateau | 32.0 | 90.0 | mountain | The "third pole", high-altitude warming |
| 15 | Maldives | 3.2 | 73.5 | ocean/island | Low-lying islands |
| 16 | Antarctic Peninsula | -68.0 | -66.0 | glacier/polar | Warm-then-pause temperature history |

Note: these are single points, so the "region" is one 0.5 x 0.625 degree MERRA-2 cell or one 1 degree CERES cell. For the app, offer a small-box average later if needed (POWER has a regional endpoint, not tested here: UNVERIFIED).

## 4. Screening result summary

221 rows (16 regions x 14 variables minus 3 `GWETROOT` rows with no data over ice or ocean). 127 detected (p<0.05, n>=15), 94 not detectable. Every series has n>=25, so none is "too short" in the full-record screen. Counts by variable (significant up / down / not significant): T2M 11/0/5; TS 11/2/3; PRECTOTCORR 7/3/6; IMERG 2/1/13; GWETROOT 7/3/3; SW 3/9/4; LW 2/5/9; RH2M 5/5/6; QV2M 11/2/3; WS10M 0/4/12; PS 7/1/8; CLOUD_AMT 5/6/5; AOD_55 5/2/9; TO3 6/2/8.

Gandhinagar reproduces the baseline exactly: T2M Sen -0.0134 C/yr, p=0.113; PRECTOTCORR +0.0210 mm/day/yr, p=0.0083.

Not independent: the MK p-values assume independent years, but lag-1 autocorrelation of the annual series is often 0.3 to 0.7 (for example Rondonia precipitation r1=0.55, Delhi sunlight r1=0.70). Hamed-Rao-corrected p from `pymannkendall` stays below 0.05 for every twin case below. The Yue-Wang test in `pymannkendall` returned p=0 or implausibly tiny values on several 25 to 45 point series, so do not use it unchecked.

## 5. The stories (all numbers computed this session)

Slopes are Sen's slope; "per decade" is 10 x slope; percentages are relative to the series mean. All windows end 2025.

### 5.1 Twin cases (same variable, opposite sign, p<0.05 both)

**Twin 1: sunlight, Delhi vs central Chile** (`ALLSKY_SFC_SW_DWN`, 1984-2025, n=42; SRB then CERES SYN1deg)
- Delhi: -0.061 MJ/m^2/day/yr (-0.61 per decade, about -3.4%/decade, total -2.5 MJ/m^2/day), p=2.1e-11.
- Central Chile: +0.044 MJ/m^2/day/yr (+0.44 per decade, +2.4%/decade, total +1.8), p=8.0e-5.
- Start-year sensitivity, Delhi: 1984 -0.061 p=2e-11; 1990 -0.060 p=1e-8; 2000 -0.064 p=2e-5; 2010 -0.074 p=0.007 (n=16). Chile: 1984 +0.044 p=8e-5; 1990 +0.050 p=3e-4; 2000 +0.077 p=9e-4; 2010 +0.058 p=0.32 (n=16, not detectable). Ending in 2020: Delhi p=7e-9, Chile p=0.002.
- Splice check: Delhi SRB-only 1984-1999 -0.061 (p=0.027) and SYN1deg-only 2003-2025 -0.067 (p=5e-4); Chile SRB-only +0.075 (p=0.065) and SYN1deg-only +0.068 (p=0.014). Both products agree on sign.
- Fragility: low. Only the 16-year window for Chile loses significance.
- Headline: "Delhi receives about 8% less sunlight in 2016-2025 than in the 1990s (decade-mean 18.5 to 17.0 MJ/m^2/day); central Chile receives about 6% more (18.1 to 19.2)." Shorter headline: "Delhi's sky has been dimming since the 1980s, central Chile's has been brightening."
- Hypothesis (not tested): Delhi's aerosol load rose (AOD_55 +0.0051/yr, p=1.3e-4, below) and aerosols scatter and absorb sunlight; central Chile's cloud amount fell (`CLOUD_AMT` -0.41 %/yr, p=3e-9, 1984-2025) and fewer clouds let more sun through. Cloud and sunlight in POWER come from the same CERES/SRB family, so this is a consistency check, not independent confirmation.

**Twin 2: rainfall, Beijing vs Rondonia** (`IMERG_PRECTOT`, 1998-2025, n=28; GPM IMERG via POWER daily, annual mean of daily values)
- Beijing: +0.0385 mm/day/yr (+0.39 per decade, +22.6%/decade of a 1.71 mm/day mean), p=1.5e-5.
- Rondonia: -0.0751 mm/day/yr (-0.75 per decade, -16.0%/decade of 4.71), p=8.4e-5.
- Independent corroboration from MERRA-2 over 1981-2025 (n=45): Beijing +0.0145 (p=4e-4), Rondonia -0.0603 (p=8e-9).
- Start-year sensitivity (IMERG): Beijing 1998 +0.0385 p=1.5e-5; 2000 +0.0393 p=1e-5; 2005 +0.041 p=6e-4; 2010 +0.052 p=0.017 (n=16). Rondonia 1998 -0.0751 p=8e-5; 2000 -0.083 p=9e-5; 2005 -0.083 p=0.005; 2010 -0.067 p=0.115 (n=16, drops out). End-year: both stay significant ending 2020 and 2015 in IMERG. In MERRA-2, Beijing is fragile (ending 2015: p=0.26) because the wettest years sit at the end (2021 to 2025).
- Fragility: medium. Rondonia holds from 1998 to 2005 starts only; Beijing's trend leans on a run of wet recent years.
- Headline: "In Beijing the rain has increased by about a fifth per decade since 1998, while at our Rondonia point in the Amazon it has fallen by about a sixth per decade."
- Hypothesis (not tested): Amazon arc-of-deforestation drying and a lengthening dry season; for Beijing, shifting monsoon rainfall and extreme-rain years. The size of the Rondonia change (about -2 mm/day over 27 years on a 4.7 mm/day base) is large for one 0.1 degree cell; present as one cell, not "the Amazon".

**Twin 3: haze, Delhi vs south-east US** (`AOD_55`, 2001-2025, n=25; CERES SYN1deg)
- Delhi: +0.0051/yr (+0.051 per decade, +7.7%/decade of a 0.67 mean), p=1.3e-4.
- Southeast US: -0.0050/yr (-0.050 per decade, -16.6%/decade of 0.30), p=3.3e-6.
- Start-year sensitivity: Delhi 2001 +0.0051 p=1.3e-4; 2005 +0.0067 p=4e-4; 2010 +0.0061 p=0.026. Southeast US 2001 -0.0050 p=3.3e-6; 2005 -0.0050 p=1.4e-4; 2010 -0.0033 p=0.0498. Ending 2020: Delhi p=0.0045, SE US p=1.6e-5. Ending 2015 (n=15): Delhi p=0.25, SE US p=0.0019.
- Fragility: low to medium; Delhi needs the 2016-2025 years.
- Headline: "Haze over Delhi has grown by about 8% per decade since 2001, over the south-eastern US it has shrunk by about a sixth."
- Hypothesis (not tested): rising fossil-fuel, biomass and dust emissions in north India; US sulphur-dioxide emission cuts.
- Do not use Beijing as the haze partner: Beijing AOD is -0.010/yr (p=0.003) over 2001-2025, but ending in 2020 gives -0.002 (p=0.38) and the series rises to a peak around 2011 before falling (0.62 in 2001, 0.89 in 2006, 0.88 in 2011, 0.47 in 2025). Mann-Kendall assumes a monotonic trend; this is a hump. Best used as a "non-linear" teaching case.

Also screened and passing but less clean: humidity `RH2M` Gandhinagar +0.285 %/yr (p=5e-5) vs Rondonia -0.223 %/yr (p=1.6e-6), robust to 1990 and 2000 starts, but it is MERRA-2 only (model humidity), fails from 2010 (p=0.115 and 0.26). Temperature skin `TS` Gandhinagar -0.0219 C/yr (p=0.031) vs Svalbard +0.0717 (p=4e-7): fragile on the Gandhinagar side (2000 start p=0.12). Cloud Svalbard +0.96 %/yr vs Central Chile -0.41 %/yr both p<1e-7, robust.

### 5.2 Honest nulls

**Null 1: Antarctic Peninsula 2 m temperature, expected to warm** (`T2M`, 1981-2025, n=45)
- Sen -0.0159 C/yr (-0.16 per decade), p=0.26, not detectable.
- Start-year: 1990 -0.011 p=0.44; 2000 -0.055 p=0.045 (a "significant cooling" that appears only from 2000); 2010 +0.070 p=0.18 (n=16). End 2020 p=0.12; 2015 p=0.27.
- Fragility: high in the other direction. Whether it flips to "detected" depends on the start year, so show the sensitivity strip.
- Headline: "At our Antarctic Peninsula point the data show no detectable temperature trend since 1981. The slope flips sign depending on where you start."
- Hypothesis (flagged, from literature, not tested): a warm phase to about 1998 followed by a cooler, variable period, driven by shifts in regional winds.

**Null 2: Sahel Niger 2 m temperature** (`T2M`, 1981-2025, n=45)
- Sen +0.0094 C/yr (+0.09 per decade), p=0.096.
- Start-year: 1990 -0.0023 p=0.81; 2000 -0.013 p=0.39; 2010 -0.012 p=0.72. End 2015: +0.022 p=0.011 (detected).
- Fragility: high; sign flips with start year and the end year can create significance.
- Headline: "We cannot detect warming at this Sahel point. Four different start years give four different answers."
- Hypothesis (not tested): MERRA-2 is a model blend and the cell is dominated by a variable monsoon and dust year to year.
- Bonus null for the home city: Gandhinagar T2M -0.0134 C/yr, p=0.113 (1981); 1990 start gives -0.0198, p=0.042, i.e. "detected cooling". Warn the demo author: a 1990 start flips the verdict for the home city.

### 5.3 Too-short or fragile

**Fragile case: root-zone soil wetness, Congo Basin** (`GWETROOT`, MERRA-2)
- 1981-2025 (n=45): -0.0080 /yr (-0.080 per decade, -14.3%/decade), p=4.6e-6.
- Start-year: 1990 -0.005 p=0.015; 2000 +0.00125 p=0.675 (sign flips, not detectable); 2010 -0.011 p=0.047 (n=16).
- Cross-check against satellite: IMERG rainfall at the same cell has no trend (-0.0026 mm/day/yr, p=0.80) and MERRA-2 vs IMERG annual correlation is -0.16. MERRA-2 here is the only voice.
- Headline: "MERRA-2 says Congo soil is drying, but the verdict vanishes if you start in 2000, and a satellite check does not agree."

**Too-short demonstration** (the app's gate: n<15 gives "too short to judge"): Beijing `AOD_55` for 2012-2025 (n=14) has Sen -0.0214/yr with p=1.2e-4, yet the three-state verdict is "too short to judge"; 2015-2025 (n=11) p=0.003; 2018-2025 (n=8) p=0.035. Rondonia IMERG 2012-2025 (n=14): -0.037 mm/day/yr, p=0.58. Svalbard `T2M` 2018-2025 (n=8) Sen +0.222 C/yr p=0.27 against a full-record +0.0757 (p=1.8e-7): an 8-year slope is three times the long-term one and means nothing.

## 6. MODIS NDVI (ORNL DAAC REST, MOD13Q1)

Not completed. The run was stopped on 2026-11-14 once the rest of the research was sufficient: ORNL answered at 8 to 59 s per 10-date request, so a 25-year NDVI series per region takes tens of minutes. The finding that matters is in section 0: snapshot NDVI offline, never call ORNL live in the demo. Partial logs stayed local.

## 7. Snapshot sizing (measured on the real fetched data)

| Snapshot | Raw | Gzip |
|---|---|---|
| POWER monthly JSON exactly as served, 16 regions x 14 variables (1981-2025) | 2,180 KiB | not measured |
| Compact monthly + annual, 16 regions x 13 variables (IMERG excluded), values rounded to 3 dp, nulls for fill | 638 KiB | 223 KiB |
| Compact annual only, 16 regions x 13 variables | 55 KiB | 19 KiB |
| IMERG daily as served, per region (1998-2025) | about 177 KiB | not measured |
| Daily, 3 regions x 6 variables (T2M, PRECTOTCORR, ALLSKY_SFC_SW_DWN, RH2M, GWETROOT, WS10M), 1981-2025, compact arrays at 2 dp | 1,537 KiB total (about 510 KiB per region) | 416 KiB total (about 138 KiB per region) |
| Same daily pull as served by POWER JSON | 5,299 KiB | not measured |
| NDVI, 3 regions, 16-day composites 2001-2025 as returned (81 pixels per date) | see section 6 | see section 6 |

Recommendation:
1. Commit the compact monthly + annual snapshot (638 KiB raw, 223 KiB gzip). It is small enough to ship in the app bundle and gives each of the 16 x 13 cases offline without a live call. Add IMERG annual series (28 numbers per region) derived offline from daily data.
2. Commit daily series for the 3 sonification and timelapse regions only (about 416 KiB gzip for 6 variables). Store as typed arrays or compact JSON arrays with a start date and a null marker; do not commit POWER's keyed-by-date JSON, which is 3.5x larger.
3. Commit precomputed annual NDVI means (a few hundred bytes) plus the raw 16-day mean series for 3 regions (tens of KiB), not the 81-pixel arrays.
4. Pin each snapshot with its fetch date and the dataset `sources` string so the Live/Cached badge can cite it. Vercel and Cloudflare serve gzip or brotli automatically, so the transfer sizes above are what users pay.
5. Keep the POWER monthly point call live for any user-chosen point (about 0.5 to 3 s per call here, 14 parameters in a single call worked), with the snapshot as fallback.
