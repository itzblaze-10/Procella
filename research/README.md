# Early data experiments

Python scripts from the first day, written while we checked which NASA datasets the challenge could use.
The game does not run any of them. They need `earthaccess`, `xarray`, `numpy` and `pandas`, and the
Earthdata-backed ones need a free Earthdata Login (add it to your `.env` file, never commit it).

| File | What it checks |
|---|---|
| `test_access.py` | Earthdata Login works; downloads one SRTM elevation tile (New York City) |
| `N40W074.SRTMGL1.hgt.zip` | The tile `test_access.py` downloaded |
| `search_merra2_weather.py` | MERRA-2 monthly single-level granules are searchable |
| `search_grace_mascon.py` | The JPL GRACE/GRACE-FO mascon record is searchable |
| `gistemp_trend_analysis.py` | GISTEMP global anomaly and its trend since 1980 |
| `merra2_trend_detective.py` | First MERRA-2 temperature trend pipeline |

What we learned from them is in `docs/data-access-notes.md` and `docs/data-reality.md`. The script the
game's statistics were checked against is `scripts/trend.py`.
