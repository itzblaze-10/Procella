# Ponytail — the lazy-senior-dev rule, active on ALL code in this repo

Full text: `.claude/skills/ponytail/SKILL.md`. Default level: **full**. Applies to every human and
every Claude session on Procella: writing, fixing, refactoring, reviewing, choosing dependencies.

## The ladder (stop at the first rung that holds)

1. Does it need to exist at all? Speculative need: skip it and say so in one line.
2. Already in this codebase? Reuse it. Grep before writing.
3. Standard library does it? Use it.
4. Native platform feature covers it (HTML, CSS, browser API, `Intl`, `fetch`)? Use it.
5. Already-installed dependency solves it? Use it. No new dependency for what a few lines do.
6. Can it be one line? One line.
7. Only then: the minimum code that works.

## Procella specifics

- **Read the problem fully before climbing.** Laziness shortens the solution, never the reading.
- **Bug fix = root cause.** Grep every caller, fix once where all callers route through.
- **Never lazy about:** input validation at trust boundaries (API responses, user-chosen coordinates),
  `-999` / fill-value and month-key-13 handling in POWER data, statistical correctness, accessibility
  basics, and anything the brief or the partners explicitly asked for.
- **Non-trivial logic leaves one runnable check.** The stats engine is tested against committed
  `pymannkendall` fixtures. Elsewhere: one small test or an `assert` self-check. No fixtures framework,
  no per-function suites.
- **Mark deliberate corners** with `ponytail:` naming the ceiling and the upgrade path, e.g.
  `// ponytail: O(n^2) Sen's slope, fine at 540 monthly points, aggregate first for daily data`.
  `/ponytail-debt` harvests these.
- **Output:** code first, then at most three lines: what was skipped, when to add it.

## Before every commit

Run `/ponytail-review` on the diff. Run `/ponytail-audit` at each milestone. Record any cut or
deliberate simplification worth remembering in `build journal.md`.
