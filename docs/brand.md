# Brand: Procella House Style

**Source of truth:** the Claude Design system at https://claude.ai/artifact/LN7Qu38c1iJNLoif9dLgcs
(private until shared from its Share menu). A mirror of its files lives in `brand/house-style/` for the build.
If the two differ, the Claude Design system wins: re-mirror it before building.

**Concept:** a globe-trotter's climate dossier. A traveller reads a news lead, picks a destination, and checks
what 40 years of NASA records say before going. Evidence first (series, rate per year, verdict), story second.

**Use in the app:**
- Tokens: `brand/house-style/tokens.json` (two themes, `night` first). Compile to CSS custom properties with the
  same names (`--ground`, `--plate`, `--lantern`, `--font-display` ...).
- Components: `brand/house-style/components/bundle.js` (window.Procella: Icon, Stamp, LuggageTag, Dossier,
  ChartPlate, Dispatch, FlapBoard, Compass, SourceBadge, RouteLine) and `bundle.css`.
- Rules: `brand/house-style/README.md` (brand book) and `brand/house-style/globe-trotter.md` (persona, journey
  order, the destinations we can stand behind).

No colour, type or motion outside the system (CLAUDE.md rule 10).

## Judges' deck

"Procella Initial Statement", 7 slides on the house style: https://claude.ai/artifact/5gVgHjZxrk4M4SFjFQz1Pf
(private until shared; downloads as .pptx or PDF from the page). Slides: title, challenge, team, how we solve it,
roadmap, datasets, findings. NASA allows a demo of at most 7 slides including title and intro. Before it is used
as the submission demo, slide 3 must say "Team Procella" instead of the partners' names (under-18 rule).
