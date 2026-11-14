A destination dossier: one place, one variable, one verdict, with the evidence on the card.

`Procella.Dossier({place, coords, variable, unit, source, icon, slope, p, years, n, state, stampDetail, series, badges, digits})`.

- `slope` is Sen's slope per year in the variable's unit; the card prints it with a true minus sign and adds the per-decade value, p, the years and n.
- `series` (`years`, `values`, `sen`, `intercept`) draws the sparkline on a strip of `plate`. Pass the real annual series, never a smoothed or invented one.
- `badges` say where the numbers came from (see SourceBadge). A dossier without a source badge is not finished.
- Show two dossiers side by side for a twin case. Claim "opposite" only when both are detected with opposite signs.
- Never add a cause to the card. Hypotheses go in the dispatch text, labelled "Possible reason, not tested".
