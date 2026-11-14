# The globe-trotter

The person every Procella screen is written for. Use this section to decide what a page says and in what order.

## Who they are

An adventurous traveller who reads the news on the way to somewhere. They want to understand a place for what it is before they go: its weather, its land, and how both have changed. They are curious and sceptical. They will trust a number only if they can see where it came from and how fragile it is.

## How a journey runs (the order of every page)

1. **A lead.** A clipped Dispatch asks a question about a real place: "Is the sky over Delhi getting darker?"
2. **A destination.** The FlapBoard turns to the place; the Compass points to it; coordinates appear in `coord`.
3. **A variable.** The traveller picks a LuggageTag: Sunlight, Rainfall, Haze, Soil water, Temperature.
4. **The evidence.** The ChartPlate draws the real series, year by year, then the dashed Sen's-slope line.
5. **The verdict.** The Stamp presses: Detected, Not detectable yet, or Too short to judge, with the rate per year beside it.
6. **The trust check.** The traveller moves the start year and watches whether the verdict holds.
7. **The twin.** A RouteLine carries them to a second place with the same variable, where the trend may run the other way.

## Destinations we can stand behind (computed 14 Nov 2026, NASA POWER)

| Journey | Variable | Result | Use it for |
|---|---|---|---|
| Delhi and central Chile | Sunlight at the surface, 1984–2025 | Delhi −0.061, central Chile +0.044 MJ/m²/day per year; both Detected; holds in both satellite products | The hero twin |
| Beijing and Rondonia | Rainfall, GPM IMERG 1998–2025 | Beijing +0.0385, Rondonia −0.0751 mm/day per year; both Detected; MERRA-2 agrees on sign | The cross-check story |
| Delhi and the south-east US | Haze (aerosol optical depth), 2001–2025 | Delhi +0.0051, SE US −0.0050 per year; both Detected | A third twin |
| Gandhinagar | Rainfall, MERRA-2 1981–2025 | +0.021 mm/day per year, Detected; not detectable from 2000 | The trust-check lesson |
| Antarctic Peninsula | Temperature, 1981–2025 | No detectable trend; the sign flips with the start year | The honest null |
| Svalbard | Temperature, 2018–2025 only | 8 years: Too short to judge, though the long record warms +0.076 °C per year | The too-short lesson |

Every number here is in `docs/data-reality.md` of the Procella repository. Do not add a destination to a page until its numbers are computed and recorded there.

## How the traveller talks

- Curious, not alarmed: "I wanted to know if the rain I read about is real."
- Honest about limits: "This is one grid cell, 50 to 110 km across."
- Never certain about causes: "Possible reason, not tested: more haze from the plains."
