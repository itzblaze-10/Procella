A dashed route between two destinations, for twin cases and journey steps.

`Procella.RouteLine({from, to, fromName, toName, variant, drawn})`.

- `from` and `to` are short codes we choose (DEL, SCL, PEK, RON); `fromName` and `toName` feed the accessible label.
- `variant: "airmail"` swaps the dashes for lantern and line-strong stripes. Use it once per page at most, for the hero twin.
- The line draws on over `dur-route` when the element gets `is-drawn`; pass `drawn: false` and add the class when it scrolls into view.
- Lantern and line-strong only. Never red and blue: those mean warming and cooling.
