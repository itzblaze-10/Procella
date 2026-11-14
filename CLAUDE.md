# Procella — Project Context

NASA Space Apps Challenge 2026, challenge **Earth System Trend Detective**. A tool that lets a
student pick an Earth-science variable and a region, plots its time series, and reports what is
changing, where, how much, and whether the change is statistically significant.

**Team:** Daksh Dayalani and Priyanshu Naskar. Claude is a tool in this repo, never a listed
partner or contributor.

**Repo:** https://github.com/itzblaze-10/Procella (private). Branch `main`.

## Read first

| File | What it holds |
|---|---|
| `docs/challenge-brief.md` | The challenge in plain English: objectives, constraints, judging hints |
| `docs/resources.md` | Every official resource, what it is, and whether we can use it |
| `docs/data-access-notes.md` | Verified facts about each data API (auth, CORS, traps) |
| `docs/strategy.md` | The three-strategist debate and the five ideas we ranked |
| `build journal.md` | Append-only log of every fix and dead end |

## Standing rules

1. **Local and GitHub are always identical.** Run `scripts/install-hooks.sh` once per clone. Every
   commit auto-pushes. `scripts/sync-check.sh` proves local == origin. Run it before ending a session.
2. **Build journal.** Every fix gets an entry in `build journal.md` (append with `>>`, never rewrite).
   See `.claude/rules/procella/build-journal.md`.
3. **Commits are authored by the human partners only.** No `Co-Authored-By` trailer for Claude, no
   "Generated with" lines, no Claude identity in commits, PRs, README or credits.
4. **Credentials live in `.env`** and are referenced by variable name. Never print, commit or discuss
   a value. The core product needs no credentials.
5. **Temporary files go in `.tmp/`** (git-ignored).
6. **Honest statistics.** No verdict without slope, confidence interval, record length and method on
   screen. "Not significant" is reported as "no detectable trend", never "no change".
7. **Ponytail on all code.** The laziest solution that works, per `.claude/rules/procella/ponytail.md`
   (skill in `.claude/skills/ponytail/`). Run `/ponytail-review` on every diff before committing.
8. **Demo must survive no wifi.** Every live data call has a committed snapshot fallback and a
   visible "Live" / "Cached" badge.

## Toolkit (copied from the owner's Business workspace, read-only source)

`.claude/skills/` holds 70 skills (including the six ponytail skills) for design, frontend, data visualisation, testing, review,
pitch decks and demo video. `.claude/rules/` holds the frontend (Tailwind), design-standards and
credential rules. `.claude/agents/` holds `karpathy-reviewer`, `deep-reasoner` and
`handoff-author`. The source workspace is never modified.

## Status

See the newest entries at the bottom of `build journal.md`.
