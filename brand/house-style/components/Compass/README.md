A compass rose whose needle points to the destination. Use it as a wayfinding mark and a quiet loading state.

`Procella.Compass({bearing, size, label})` and `Procella.compassTo(svg, bearing)`.

- The needle's north half is `lantern`; the needle turns over `dur-route` with `ease-dawn`. Reduced motion jumps.
- Use one compass per screen. Give it a real bearing (for example from the user's last pin to the next destination) or leave it at north.
- It is decoration plus orientation. Never use it to show a statistic.
