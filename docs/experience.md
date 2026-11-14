# Experience Design

Research date 14 Nov 2026. Official rules are in `docs/challenge-brief.md`. Full notes with 26 data-first rules and the compliance table: `.tmp/research/experience.md` (local only).

## Principle

One persistent globe canvas behind a hash-routed set of pages, with camera moves between them. Interface chrome stays neutral so colour only ever means data. POWER returns one grid cell of about 0.5 by 0.625 degrees, so the copy says "this grid cell", never "this region".

## Routes

| Route | Purpose |
|---|---|
| Gate | Unlock audio. Choices: sound, silent, or tour |
| `#/` Prologue | A live headline number and a 40-year timelapse scrub |
| `#/variables` | Quest 1: pick your suspect |
| `#/field` | Quest 2: place the pin |
| `#/lab` | Quest 3: draw the line first |
| `#/case` | Quest 4: run the test |
| `#/twins` | Finale: Twin Case |
| `#/evidence` | Method, fixture-test result, licences, SI disclosure |

## Quests (one per challenge objective)

1. **Pick your suspect (identify variables).** Match a news-style lead to a variable card with a sparkline, unit, source and record years.
2. **Place the pin (acquire a region).** Globe dive, grid-cell footprint, dropped-value count, Live or Cached badge. A `<select>` and lat/lon inputs are the accessible picker.
3. **Draw the line first (build and visualise).** Sketch a guess, then the raw series draws itself, sonified. No trend line yet, so the eye is not anchored.
4. **Run the test (rate and significance).** Guess the rate, press Fit: Sen's slope with a 95% CI ribbon and the Mann-Kendall result. Classify what the evidence supports. A start-year drag shows the verdict flipping. Trimming below the minimum length reveals "Too short to judge". The same stamp is awarded for all three honest states, plus a "Cherry-pick spotted" badge.
5. **Finale, Twin Case.** Predict same or opposite, then a split reveal. "Opposite" is claimed only when both CIs exclude zero with opposite signs.

The chart stays full size throughout; quest UI is a narrow rail, never a modal. No timers, lives or leaderboards. Replay comes from about 8 lead cards. Progress in localStorage inside try/catch.

## Goosebump moments, ranked by impact against cost

1. Sonified series draw (2 to 3 h). 2. Longer record flips amber to green: drag the end year, the CI narrows, the chord resolves (2 h). 3. Scroll-scrubbed timelapse on the globe with precomputed sample points, never interpolated (4 to 5 h). 4. Verdict seal with the music ducking out (1 h). 5. Cherry-pick pivot (1.5 h). 6. First-light opening (2 h). 7. Globe dive into the user's pin (4 h). 8. Stereo twin split (4 h). 9. Pull-back finale (2 h). 10. Variable-specific score (4 h, cut first).

Build order if time is short: 1, 4, 2, 5, then 6, 7, 3, 8. Hour figures are the research agent's estimates, not measured.

## Demo modes

- **20-second visitor:** a plain-HTML poster paints first (title, one sentence, a real Twin Case chart with its verdict, two buttons). A numeric slope, CI and verdict are visible within about 2 s. Globe and a muted timelapse fade in behind.
- **Judge mode (90 s):** eight-beat in-app autoplay with generated captions, ending with a hand-over to free explore.
- **Guided mode (3 min):** the five quests, each with "Skip with example".
- **30-second submission video:** captions only, no voice or faces (under-18 rule), cut from judge mode. Captions read their numbers from the engine.

## Data-first rules (core)

Chart at least 60% of viewport width and 50 vh on a solid plate with nothing moving behind it. Headline number is real DOM text within 1.2 s. All animation skippable and reduced-motion safe. Contrast 4.5:1 for text, 3:1 for graphics. Colour never the only carrier: verdict also gets a word and a glyph. Units from API metadata and a source line on every chart. Raw series first, then Sen line with CI ribbon. "Not significant" always reads "no detectable trend". Every chart has a data table, CSV download and keyboard stepping. Fonts and scripts self-hosted with snapshot fallback.

## Brand candidates for the Claude Design house system

All three use vermilion for warming, blue for cooling, teal for wetting, ochre for drying (no red/green pair; checked contrast and a colour-blind simulation).

| | Concept | bg / surface / text / accent | Fonts (SIL OFL) | Sound |
|---|---|---|---|---|
| **A Terminator (recommended)** | Dawn-gold line on the night planet | `#0B0D12` / `#151A23` / `#EDEFF4` / `#F2C879` | Fraunces, Hanken Grotesk, Geist Mono | Drone and glass bells, resolving or hanging chords |
| **B Almanac** | Printed almanac on cream paper | `#F3EEE2` / `#FBF8F0` / `#1C1B18` / `#9C3D12` | Newsreader, Source Sans 3, IBM Plex Mono | Plucked strings |
| **C Specimen** | Greyscale UI, only data has colour | `#0E0E0E` / `#181818` / `#F4F3EE` / white | Archivo, JetBrains Mono | Sine blips and clicks |

Data tokens. A: warm `#FF6A3D`, cool `#4FA3FF`, wet `#2FC4B2`, dry `#D08A2E`. B: `#C2331F`, `#1F5FA8`, `#0D7566`, `#9A5B0E`. C: `#FF5533`, `#3D8BFF`, `#18B7A0`, `#C98A1B`.
Motion. A: dawn ease `cubic-bezier(0.16,1,0.3,1)`. B: settle without overshoot. C: mechanical snaps.
Risks. A can drift toward a luxury-watch look and its gold sits near ochre under deuteranopia (keep the accent off charts). B is the least cinematic at first glance. C is cold and weakest for storytelling.
Recommendation: A, with C's rule that colour means data only.

## Compliance with the brief

Three considerations are met by documented simplification rather than a full feature: the seasonal cycle is removed by using annual means; non-linear trends are labelled as straight-line trends only; the CUAHSI plotting tools are not used and we say so.
