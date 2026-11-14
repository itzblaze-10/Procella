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

## Submission rules (read from spaceappschallenge.org on 14 Nov 2026)

Sources: Project Submission Guide, Judging and Awards Guide, Participant FAQs, Terms. Full notes: `.tmp/research/experience.md` (local only).

- **Deadline: Sunday 15 Nov 2026, 11:59 pm local time of the team's Local Event.** Press "Submit for Judging"; the last save counts. Submission opened Sat 14 Nov 9:00. Nominees 3 Dec, finalists 17 Dec, winners 26 Jan 2027.
- **Form fields:** Project Name, High-Level Summary, Link to Project Demo, Link to Final Project, Detailed Description, Use of Super Intelligence (SI), NASA Data, Other References.
- **Demo:** video of 30 seconds or less, or at most 7 slides. Hosted publicly (YouTube, Drive, GitHub...), no login. Over the cap means ineligible for Global Judging.
- **Final project link:** public, no login. Most of the judging weight sits here, not on the demo.
- **Judging criteria:** Impact, Creativity, Validity, Relevance, Presentation (1 to 5 each). NASA data must be a core component.
- **SI policy:** allowed, but not for coming up with the solution idea. Use must be disclosed. SI images and video need a visible watermark; SI audio, code and data need an acknowledgment in descriptive text and metadata. Generated content may not use NASA branding.
- **Under 18:** must be registered by a parent or guardian and accompanied. No recognisable names, voices or likenesses of under-18s in the submission or demo. Use "Team Procella" in anything public.
- **Third-party material:** open source or unrestricted, every source cited (code, text, images, fonts). NASA defaults to Apache-2.0 for original work. Judges can only open public links.
- **NASA branding:** no NASA logos, flags or mission identifiers. Credit in plain text ("Data: NASA POWER").
- **Optional:** request FortiGuard web-filter classification for a new site so judges are not blocked.

## Open items

- Confirm which Local Event both partners are registered at (it sets the deadline's time zone).
- Decide the SI-disclosure wording (see `CLAUDE.md` rule 3, which conflicts with disclosure).
- Decide public repo plus licence, and scrub partner names from anything public.
