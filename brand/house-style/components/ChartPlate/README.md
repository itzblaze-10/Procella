Evidence on paper: a time series with its Sen's-slope line, caption and source, on a `plate` that looks the same in both themes.

`Procella.ChartPlate({eyebrow, title, unit, years, values, sen, intercept, from, caption, source, badges, width, height, label})`. `Procella.trendSvg(...)` draws the chart alone.

- Every chart sits on a plate. Nothing moves behind a plate, and no effect covers it.
- Show raw values first. The dashed `plate-trend` line is Sen's slope; `from` starts it at another year for the start-year check.
- The caption states the verdict in words with its numbers, and says when a different start year changes it.
- `source` names the dataset and the cell. Give the chart a data table or CSV next to it in the app.
- Use `plate-warm`, `plate-cool`, `plate-wet` and `plate-dry` only for labels and highlighted series on the plate.
