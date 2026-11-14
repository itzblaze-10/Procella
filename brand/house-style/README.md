Procella is a globe-trotter's climate dossier. A traveller reads a news lead, picks a destination, and checks what 40 years of NASA records say before going. Every screen leads with the evidence (the series, the rate per year, the verdict) and then tells the story of the trip. Build every surface from the tokens, type styles and components below, and nothing else.

## Content fundamentals

**Two voices, never mixed in one sentence.**
- Interface and evidence: plain, direct, second person. "Pick a place." "Open the dossier." "Start the record in 2000."
- Dispatches and field notes: the traveller, first person, short sentences. "I came for the monsoon. The record says the rain here rose from 1981, and stopped looking certain once I started counting from 2000."

**Numbers.**
- Always: sign, value, unit, per year, period, verdict. `−0.061 MJ/m²/day per year · 1984–2025 · p = 2.1e−11 · Detected`.
- Use a true minus sign (−) and a plus sign on rises. Set every number in the `mono` family with tabular numerals.
- Give the per-decade value beside the per-year value when the per-year value is under 0.1.
- p-values under 0.001 in scientific form (`2.1e−11`); otherwise three or four decimals.

**Verdict words are fixed.** Detected. Not detectable yet. Too short to judge. Never "no change", "proven", "significant warming confirmed" or "causes".

**Hypotheses are labelled.** Write "Possible reason, not tested:" before any physical explanation. A dossier never states a cause.

**Places.** Say "this grid cell" or "our Delhi point", never "Delhi" alone when the claim is about one cell. Coordinates in `coord` style: `28.61 N · 77.21 E`.

**Casing.** Sentence case for headlines and buttons. Uppercase only in `board`, `eyebrow`, stamps and tags. No emoji.

**Avoid.** Em-dash asides, "not X but Y" framing, hype words (incredible, shocking), and quoting real news articles. Leads are questions written by us.

## Visual foundations

**Ground and paper.** Night (`ground`, `surface`, `raised`) is the train window at night; Day is a grey morning. Evidence always sits on `plate`, a paper colour that does not change between themes, with `plate-ink` text and `shadow-plate`. Nothing moves behind a plate.

**Colour means data.**
- `warm`, `cool`, `wet` and `dry` mean warming, cooling, wetting and drying, and nothing else. On a plate use their `plate-` versions.
- `lantern` is the traveller: primary actions, selected tags, the compass needle, route pins, focus. Never put `lantern` inside a chart.
- Verdicts use `stamp-detected`, `stamp-null` and `stamp-short`, always with their word and glyph. `stamp-null` shares the lantern hue on purpose.
- Text: `ink` and `ink-muted` on `ground`, `surface` and `raised` (5.7:1 or more in both themes). `plate-ink` and `plate-muted` on `plate`.
- Borders that carry meaning use `line-strong` (3:1 or more). `line` and `plate-line` are decoration only.

**Type.**
- `board`: destination names, uppercase, on the flap board and page openers.
- `headline` for page and dispatch headlines, `title` for plates and dossiers, `eyebrow` above them.
- `lede`, `body`, `small`, `caption` for reading. Running text stays under 68 characters a line.
- `figure-xl` for the one headline rate on a dossier, `figure` for secondary statistics, `coord` for coordinates and units, `table` for data tables.
- `field-note` (Caveat) for one handwritten margin note per screen at most, never for numbers.

**Spacing and shape.** Space in steps `space-1` to `space-9`; plates and dossiers pad `space-5`, sections part by `space-7`. Corners: `radius-tag` for tags, badges and flap tiles; `radius-plate` for plates; `radius-card` for dossiers and dispatches; `radius-pill` for badges and calls to action.

**Motion.** Default easing `ease-dawn`. Route lines and series draw on over `dur-route`. Stamps press once with `ease-press` over `dur-stamp`. Flap boards flip at `dur-flip` per character. Playheads tied to sound use `ease-steady`. Every animation has a still version under reduced motion. Nothing flashes more than three times a second.

**Sound.** Procedural Web Audio only, started from an "Enter with sound" click. A wind-like drone under the journey; a soft wooden knock when a stamp lands; flap clicks when the board turns. When a series plays, pitch follows its own minimum to maximum on a D minor pentatonic scale; a Detected verdict resolves the chord, Not detectable yet leaves it hanging.

**Layout.** The chart is the largest thing on any evidence screen: at least 60% of the width and half the viewport height. Quest controls sit in a narrow rail beside it, never in a modal over it. Story furniture (dispatches, tags, compass, routes) frames the evidence and never overlaps it.

**Focus.** A 2px solid `focus` ring with a 3px offset, 3:1 or more on every surface.

## Iconography

`Procella.Icon` holds 41 line icons on a 24px grid with a 1.75 stroke and round caps, all drawn in code. Icons inherit `currentColor`. Use them for variables (sun, rain, haze, soil, leaf), place types (desert, forest, city, polar), verdict glyphs (trend-up, trend-down, trend-flat, hourglass) and provenance (live, cached, crosscheck, model). No other icon set, no emoji, no NASA logos, flags or mission patches. Credit data as plain text ("Data: NASA POWER").

## Story furniture

The brand's small objects, each a component: the passport **Stamp** (verdict), the **LuggageTag** (variable), the **Dossier** (destination card), the **ChartPlate** (evidence paper), the **Dispatch** (news lead), the **FlapBoard** (departure board), the **Compass**, the **SourceBadge** and the **RouteLine**. Use them together: a dispatch raises a question, a tag picks the variable, the board announces the destination, the plate shows the evidence, the stamp gives the verdict, the route carries the traveller to the twin.

## Imagery

No photographs of people, no generated images. The globe is drawn from data (dots and hexes from a land atlas), not a photo texture.
