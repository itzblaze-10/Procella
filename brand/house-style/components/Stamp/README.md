The verdict of a trend test, drawn as a passport stamp in one of three honest states.

`Procella.Stamp({state, direction, detail, size, press})`:
- `state`: `detected` (p below 0.05 and at least 15 years), `null` (not detectable yet), `short` (fewer than 15 years: too short to judge).
- `direction`: `up` or `down`, only for `detected`. It picks the glyph and the default bottom text.
- `detail`: the bottom arc, for example `falling · 1984–2025`. Keep it under 20 characters.
- `press: true` plays the press once (`dur-stamp`, `ease-press`). Reduced motion shows it still.

Rules:
- Never show a stamp without the slope, p-value, years and method next to it. The stamp summarises evidence; it never replaces it.
- The word and the glyph carry the meaning; colour (`stamp-detected`, `stamp-null`, `stamp-short`) only reinforces it.
- `null` reads "Not detectable yet", never "No change". `short` appears whenever a window drops under 15 years, even if p is tiny.
- Press a stamp once per verdict. Never loop, shake or flash it.
