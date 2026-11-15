# Procella 🌍

A 3D globe-trotter game built on NASA climate data. Pick a traveller, a vehicle, a year from 1981 to 2025
and any place on Earth. You land in that place's real terrain, under the weather NASA recorded there that
month. The people you meet tell you how their climate has changed, quoting the numbers, and the trend
dossier tests each change for statistical significance.

Built for the NASA Space Apps Challenge 2026, challenge **Earth System Trend Detective**.

## Team

Team Procella.

## Run it

Procella is a static web app (three.js, ES modules, no build step, no credentials).

```bash
git clone https://github.com/itzblaze-10/Procella.git
cd Procella
python3 scripts/serve.py          # then open http://localhost:8000/app/
```

`scripts/serve.py` is the standard-library server with caching switched off, so a reload always picks up
new code. Plain `python3 -m http.server 8000` works too, but after pulling, hard-reload the tab
(Cmd+Shift+R / Ctrl+Shift+R). Any static host works (GitHub Pages, Netlify, Cloudflare Pages): publish
the repository root, and `index.html` forwards to `app/`.

Needs a desktop browser with WebGL 2 and an internet connection: climate data, elevation and satellite
imagery are fetched live.

## What is in it

- **Anywhere on Earth.** Real elevation (AWS Terrain Tiles) under 10 m Sentinel-2 imagery, with ground
  textures, vegetation chosen by the place's 45-year temperature and rainfall, rivers, settlements and people.
- **The month's real weather.** Rain, cloud, wind, haze and snow come from NASA POWER for that place, year
  and month. Each effect can be switched on or off in the NASA panel. The sun sits where it really was.
- **30 world cities** rebuilt from OpenStreetMap footprints, heights, roads, parks and water, with 37
  landmarks modelled at their real size. Pick one under *World cities* on the destination screen.
  See [app/CITIES.md](app/CITIES.md).
- **Nine vehicles** with physics tuned to published figures: 4x4, saloon, buggy, Cessna-style trainer,
  helicopter, float plane, safari boat, sailing steam liner and explorer yacht. Mud builds up on wet ground.
- **Climate stories.** People under gold beacons tell you what changed where they live, using that
  place's own NASA record.
- **Trend dossier and Globe Lab.** Mann-Kendall test, Sen's slope with a confidence interval, record
  length and method on screen for every verdict. The Lab scans trends across the planet, compares two
  variables and projects forward with honest ranges.
- **Future Zone and advancements.** Travel past 2025 on a straight-line extrapolation, clearly labelled as
  one, and collect era stamps.

## Controls

| On foot | Land vehicles | Planes | Helicopter | Boats |
| --- | --- | --- | --- | --- |
| W A S D walk, Shift jog, Space jump | W throttle, S brake then reverse | W / S throttle | Space / Shift collective | W / S throttle, reverse |
| Drag to look, wheel to zoom | A / D steer | Up / Down pitch | W / S tilt | A / D steer |
| E talk to people under gold beacons | Space handbrake | Left / Right bank, A / D rudder | Left / Right strafe, A / D yaw | |

Everywhere: **F** gets in and out, **T** opens the trend dossier, **J** shows advancements,
**[** and **]** move the sun through the day, **Esc** pauses.

## Honest statistics

- Every verdict shows the slope, its confidence interval, the record length and the method.
- "Not significant" is reported as "no detectable trend", never "no change".
- NASA POWER values are model-derived (MERRA-2 and CERES), not direct observations, and the app says so.
- The engine is checked against `pymannkendall`: `node app/src/data/stats.test.mjs`.
- `scripts/trend.py --selftest` is a standalone Python version of the same test.

## Repository

| Path | What it holds |
| --- | --- |
| `app/` | The game: `src/` code, `data/cities/` the OpenStreetMap city snapshots, `assets/` textures and models, `vendor/` three.js and EZ-Tree |
| `brand/house-style/` | Design tokens and components the interface is built from |
| `scripts/` | `serve.py` local server, `fetch_cities.py` city snapshot builder, `trend.py` reference trend test, git sync hooks |
| `data/` | The trend screening table behind `docs/data-reality.md` |
| `docs/` | Challenge brief, resources, data access notes, data reality check, strategy, roadmap |
| `research/` | First-day data experiments, not used by the game |
| `build journal.md` | Every fix and dead end, in order |
| `CREDITS.md` | Every third-party source and its licence |

Partners working on the code: run `./scripts/install-hooks.sh` once per clone (every commit then pushes),
and `./scripts/sync-check.sh` confirms local and GitHub are identical.

## Data and credits

NASA POWER, NASA GIBS, the ORNL DAAC MODIS service, AWS Terrain Tiles, Sentinel-2 cloudless by EOX
(CC BY-NC-SA 4.0) and OpenStreetMap (ODbL). Full list with licences in [CREDITS.md](CREDITS.md).

## Licence

Our code is under the [MIT licence](LICENSE). Third-party material keeps its own terms:
the city snapshots in `app/data/cities/` are derived from OpenStreetMap and stay under ODbL 1.0,
the vendored three.js and EZ-Tree code is MIT, and the Poly Haven textures are CC0. See
[CREDITS.md](CREDITS.md).
