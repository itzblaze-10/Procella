# Challenge Brief — Earth System Trend Detective

Source: https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/
Event: 2026 NASA Space Apps Challenge. Difficulty: Advanced. Subjects: Earth Science, Software.

## In plain English

Earth's environment changes all the time. When a measurement keeps moving in one direction (rising,
falling, thickening, thinning) that is a **trend**. The catch: the same cause can push a variable up
in one region and down in another, and there are thousands of variables to choose from.

**Build a tool that lets a person:**
1. pick a variable measured by an Earth-science satellite mission or produced by an Earth-science model,
2. pick a region,
3. see how it changes over time,
4. learn **what** is changing, **where**, **how much**, and whether the change is **significant**
   (the word scientists use for "unlikely to be random noise").

## The four required elements

| # | Objective | Our reading |
|---|---|---|
| 1 | Identify variables worth investigating | A curated, explained variable list (temperature, rainfall, soil wetness, solar radiation, greenness) |
| 2 | Acquire the variable for a particular region | User picks a place; most trends are regional, not global |
| 3 | Generate and visualise a time series, long enough for statistics | Monthly or daily data, ideally 20+ years |
| 4 | Basic statistics: rate of change plus a significance test | Rate = Sen's slope. Test = Mann-Kendall (or t-test, or confidence intervals) |

"A response that does both the visualisation and the analysis meets the full scope."

## Audience

High-school and college students, plus scientifically curious adults. So: simple variable
definitions, a "data detective" feel, a short guided question flow, and a couple of demonstration
examples a user can watch.

## Optional ideas the brief suggests (not required)

- Ask the user what or where they want to investigate, then search matching variables.
- Pre-built demonstration examples.
- AI to suggest variables and regions from news articles, papers, or region character (desert,
  rain forest, tidal estuary, air above a big city).
- Daily and monthly data are easiest. Hourly and 3-hourly exist but are heavy.
- A trend that is not significant is still interesting. A longer record may make it significant.
- Trends can be non-linear and seasonal cycles can hide them. Linear trends are explicitly "a great start".

## What the brief hints judges care about

- The contrast theme: same process, opposite trend in two regions.
- Both visualisation and significance testing present, not one of them.
- Clarity for non-experts.

## Open item

The submission deadline and exact deliverables (video length, repo link, write-up format) are not on
the challenge page. Confirm them on the Space Apps portal and record them in `build journal.md`.
