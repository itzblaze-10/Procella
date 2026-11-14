A variable, labelled like a luggage tag: name, unit, source and years.

`Procella.LuggageTag({name, unit, source, years, icon, button, selected})`. With `button: true` it renders a `<button>` with `aria-pressed`, for choosing a variable in a quest.

- `name` is the plain-English variable name (Sunlight, Rainfall, Haze, Soil water), never the API code. Put the code in tooltips or tables.
- `source` names the product honestly: `MERRA-2`, `SRB + CERES`, `GPM IMERG`, `MODIS`.
- `selected` fills it with `lantern`: the traveller's own choice.
- Minimum height 44px for touch. Do not stack more than six in one row.
