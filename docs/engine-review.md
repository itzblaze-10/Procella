# Review of the Trend Detective Python engine (partner's docs and plugin code)

Reviewed 15 Nov 2026 from the pasted files (`datasets/*.py`, `contract.py`, and the `docs/engine/` set). The engine
itself is not in this repository yet, so this review covers what the documents and plugin code state. Each finding says
what is wrong, why it matters, and what to do. Severity: **High** = would mislead judges or users, **Medium** = wrong
or inconsistent, **Low** = tidy-up.

## High

1. **A causal claim breaks the engine's own rule.** `ENGINE_API.md` ends with "isolating intense anthropogenic pumping as
   the overwhelming cause". `KNOWLEDGE_GUIDE.md` Rule 3 says verdicts must never claim causation. The regression behind it
   has R² = 0.0038 (F = 0.438, p = 0.65): rain and temperature anomalies explain almost nothing of the monthly GRACE
   anomalies. A 99.4 % "unexplained residual" is evidence that this model explains nothing, not evidence of pumping.
   Pumping may well be the reason (published work says so), but this analysis does not show it.
   *Fix:* cite the literature for the pumping explanation and label it a hypothesis; drop the attribution verdict.
2. **The trend decomposition is circular.** `trend_decomposition` takes `y_trend_per_decade: -476.03` and
   `x_trends_per_decade: {rain: 0.0, temperature: -0.178}` as hard-coded inputs in the recipe, so its output repeats
   numbers typed into it. *Fix:* compute those trends inside the graph from the source nodes.
3. **The same quantity has different numbers in different documents.**
   - GRACE trend near Delhi: −476.03 mm/decade (= −47.6 cm/decade) in `FETCH_COOKBOOK.md` and `HEADLESS_AND_API.md`,
     but −82.5 cm/decade in `STABILITY_AUDIT.md` and `VARIABLES_GUIDE.md`. −82.5 cm/decade (8 cm a year) is about double
     the roughly 4 cm a year Rodell et al. (2009) reported for north-west India and is very likely an error.
   - GISTEMP regional warming near Delhi: +0.1854 °C/decade (p = 0.0055) in the cookbook, +0.134 °C/decade (p = 0.02)
     in `BUILD_LOG.md` and `VARIABLES_GUIDE.md`.
   - MERRA-2 Delhi temperature: "−0.36 °C/decade cooling" in `BUILD_LOG.md`, −0.1782 °C/decade (p = 0.198, not
     significant) for 2003–2024 in the cookbook.
   *Fix:* every published number must come from one script run with its window, region box and dataset stated.
4. **GLDAS values are flat, so they are broken data, not "no trend".** The cookbook shows total soil moisture slope
   +0.0000 with p = 1.0000, and `KNOWLEDGE_GUIDE.md` admits the bundled GLDAS cache is constant. A constant 22-year soil
   moisture series means the extraction failed (fill values, wrong variable or a stub). *Fix:* remove GLDAS results until
   re-extracted and checked against a plotted raw series.

## Medium

5. **GPM rainfall slope of exactly +0.0000.** Seasonal Sen's slope at a monsoon site has many dry months with zero rain,
   so the median of within-month slopes collapses to zero. That is a method artefact, not a measurement.
   *Fix:* test annual totals (as Procella does) or monsoon-season totals.
6. **p = 0.0 for GRACE.** A p-value printed as exactly zero is numerical underflow; report "p < 1e−16". With 231 strongly
   autocorrelated monthly values, a Hamed-Rao corrected p should be far less extreme, so check that the correction is
   actually applied. The Pettitt change point at 2014-06 (p ≈ 0) also means the series has a step, and a monotonic-trend
   test on a stepped series overstates a "steady" trend.
7. **"Pyper-Hollowed" effective sample size is not a real method name.** The standard reference is Pyper & Peterman
   (1998). Check the formula in `relationships.py` against that paper.
8. **Footprints do not match in cross-dataset comparisons.** MERRA-2 is queried at the box centre (one grid cell), while
   GRACE and GISTEMP average a 3° × 3° box (about 330 km). A box labelled "Big City (Delhi NCR)" mostly covers farmland.
   *Fix:* use the same footprint for compared datasets and name the region by what it covers.
9. **Shorter records than needed.** `merra2.load_series` defaults to `start_year=2001`, but POWER serves from 1981. Twenty
   fewer years weaken every test. *Fix:* default to 1981 for MERRA-2.
10. **Docs and code disagree.** `PARAMETERS.md` says POWER timeout 60 s at `merra2.py:141`, the code uses 30 s; the README
    says 31 tests, the audit says 23 passed; `VARIABLES_GUIDE.md` lists PRECTOTCORR in mm/day, the plugin converts to mm/month.

## Low

11. AIRS, GLDAS and GPM plugins raise an error unless data was precomputed with an Earthdata login, so they cannot run
    in a public web page. That is why the Procella game uses open endpoints (NASA POWER for MERRA-2, CERES and IMERG daily;
    NASA GIBS imagery for AIRS and MODIS) and calls them live in the browser.
12. Credentials: the engine documents a local `.env` with Earthdata login values and a `.dodsrc`. Both are git-ignored in
    this repository. Keep it that way.

## What Procella reuses

The NASA POWER handling matches ours (drop month key 13, treat −999 as missing). Procella's statistics run in the
browser (`app/src/data/stats.js`) and are verified against `pymannkendall` (`app/src/data/stats.test.mjs`). Nothing from
items 1 to 6 is shown in the game.
