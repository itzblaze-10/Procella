# Procella 🌍

Uncovering Earth's environmental trends through NASA satellite data, scientific analysis, and
interactive visualisations. Built for the NASA Space Apps Challenge 2026, challenge
**Earth System Trend Detective**.

Pick a variable and a place. Procella plots how it has changed, then tells you what is changing,
where, how much, and whether the change is statistically significant.

## Team

Daksh Dayalani and Priyanshu Naskar.

## Documentation

- [Challenge brief](docs/challenge-brief.md): what we were asked to build, in plain English
- [Resources](docs/resources.md): every official resource and whether we use it
- [Data access notes](docs/data-access-notes.md): verified facts about NASA POWER and MODIS access
- [Strategy](docs/strategy.md): the debate, the five ranked ideas and the build order
- [Build journal](build%20journal.md): every fix and dead end, in order

## Getting started

```bash
git clone https://github.com/itzblaze-10/Procella.git
cd Procella
./scripts/install-hooks.sh   # auto-push after every commit
./scripts/sync-check.sh      # confirms local and GitHub are identical
```

The core product needs no credentials. Copy `.env.example` to `.env` only if optional sources are added.

## Play the game

Procella is a static web app (three.js, no build step). Every session calls NASA live.

```bash
python3 -m http.server 8000      # from the repository root
# open http://localhost:8000/app/
```

Any static host works (GitHub Pages, Netlify, Cloudflare Pages): publish the repository root; `index.html` forwards to `app/`.

After pulling new code, hard-reload the tab (Cmd+Shift+R / Ctrl+Shift+R): `http.server` lets the browser cache modules.

- **World cities:** 30 famous cities (New York, London, Paris, Tokyo, Dubai, Mumbai, Delhi and more) are rebuilt from real
  OpenStreetMap footprints, roads, parks and water (snapshot in `app/data/cities/`, fetched with `scripts/fetch_cities.py`),
  with their landmarks modelled at real size. Pick one under *World cities* on the destination screen. See `app/CITIES.md`.
- **Controls:** W A S D walk (Shift jogs), F gets in and out, E talks to people under gold beacons, T opens the trend dossier,
  J shows advancements, `[` and `]` move the sun through the day, Esc pauses.

- **Play:** pick a traveller, a vehicle (4x4, saloon, buggy, Cessna-style trainer, helicopter, float plane, safari boat,
  sailing steam liner, explorer yacht), a year (1981 to 2025) or the Future Zone, and a pin anywhere on Earth.
- **In the world:** real elevation and NASA imagery; weather from that place's NASA record for that month, each effect
  switchable in the left NASA panel; people nearby tell how their climate has changed, quoting the data.
- **Explore (Globe Lab):** scan trends across the planet live, compare two variables, project forward with honest ranges.

Statistics check: `node app/src/data/stats.test.mjs` (matches pymannkendall).

## Status

Playable build in `app/`. Progress and every fix are in the build journal.

## Data

NASA POWER (MERRA-2 and CERES derived) and ORNL DAAC MODIS services. Both are open.
POWER values are model-derived, not direct observations, and the app says so.
