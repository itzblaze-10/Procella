Line icons for Procella's variables, places, verdicts and controls, drawn in code on a 24px grid.

Call `Procella.Icon(name, {size, label})`; it returns an inline SVG string that inherits `currentColor`. `Procella.icons` lists all 41 names.

- Pass `label` only when the icon carries meaning on its own (it then gets `role="img"`). Next to a word, leave `label` out so screen readers skip it.
- Colour it through its container: `ink` or `ink-muted` on ground, `plate-muted` on a plate. Never use `lantern` on an icon inside a chart.
- Sizes: 14 in badges, 16 to 20 in tags and datelines, 24 in controls, 28 or more only as a feature.
- Variables: `temperature`, `rain`, `humidity`, `sun`, `haze`, `cloud`, `wind`, `soil`, `leaf`, `gauge`, `ozone`. Places: `mountain`, `ocean`, `city`, `desert`, `forest`, `polar`. Verdicts: `trend-up`, `trend-down`, `trend-flat`, `hourglass`. Provenance: `live`, `cached`, `crosscheck`, `model`.
- Do not mix in another icon set. Add a new icon in the same stroke and grid instead.
