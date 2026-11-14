# Build Journal — Procella

Every fix, dead end and decision on the NASA Space Apps 2026 project "Procella" (Earth System
Trend Detective), in the order it happened. The struggle is the record; outcomes live in the code.

**Format:** `## YYYY-MM-DD HH:MM` heading (IST), then what broke, what was tried, why the decision
went the way it did. Newest entries at the BOTTOM. **Update rule:** append only (shell `>>`);
never rewrite earlier entries.

---

## 2026-11-14 13:18 — Session 1: understand the challenge, set up the repo, run the strategy debate

Scope of the session: read the challenge, collect the resources, copy a toolkit from the Business
workspace (read-only), scaffold the repo, and rank approaches.

- **Firecrawl had zero credits** (resets 2026-11-17), so the challenge page could not be scraped with it.
  Tried WebFetch next: failed with "unable to get local issuer certificate". Read both challenge tabs
  (Details, Resources) through the Chrome browser tools instead. Plain curl worked for the resource sites.
- **Medium trend-test article returned HTTP 403** to scripts. Not scraped; listed in docs/resources.md to read in a browser.
- **Official resource list is mostly login-walled.** Giovanni, AppEEARS and GES DISC need an Earthdata
  login; KNMI sits behind a human-verification wall; NOAA CDO needs an emailed token. Tested open
  alternatives from this machine: NASA POWER and ORNL MODIS REST both work with no login.
- **Verified before trusting a strategist's claim.** The engineer assumed POWER sends CORS headers.
  Tested: `access-control-allow-origin: *`. Also confirmed: month key 13 is the annual mean (must be
  dropped), -999 is fill, and ALLSKY_SFC_SW_DWN is -999 in 1981 (record starts later). That killed the
  scientist's "solar brightening vs dimming" demo idea.
- **Debate result.** Three strategists (science rigor, product and demo, engineering) argued two
  rounds and converged: static React SPA, live POWER with snapshot fallback, hand-rolled stats
  validated against pymannkendall, Case Files UI with a three-state honest verdict, Twin Cases as the
  hero demo. Full detail in docs/strategy.md. The Product strategist's pre-baked region pairs are
  hypotheses, not results; they must be screened through the real pipeline before the demo.
- **Skill copy failed silently the first time.** The loop printed every skill as "missing" because zsh
  does not word-split an unquoted variable. Re-ran under bash with a script file; 64 skills copied.
  Lesson: run multi-item shell loops under bash, not zsh.
- **Toolkit copy was selective on purpose.** Took design, frontend, data-viz, QA, review, pitch and
  demo-video skills plus the generic rules and three agents. Left out Machine-specific modules,
  memory, settings, client data and the 17 MB last30days skill. Secret scan on the copy: clean.
  Source workspace was only read, never written.
- **Journal convention.** The Business workspace already uses a root file named `build journal.md`
  with append-only entries; kept the same name and rule here.
- **Sync design.** Local == GitHub is enforced by a tracked post-commit hook (auto-push) plus
  scripts/sync-check.sh. A failed push warns instead of blocking the commit.
- **Commit identity.** Commits carry the human partners' identity only, no Claude co-author trailer,
  per the owner's instruction.
- **Open:** submission deadline and deliverable format are not on the challenge page; Twin Case pairs
  unscreened; frontend choice and the A/B work split await the partners.

## 2026-11-14 13:19 — Push rejected: partner had pushed to main during the session

**What broke:** both of my commits failed to push (post-commit hook warned, sync-check showed 2 ahead,
1 behind). The partner (GitHub user blaze) had pushed "Add files via upload" at 13:04 IST: four
exploration scripts (GISTEMP trend, GRACE and MERRA-2 searches via earthaccess, an Earthdata login
test), a 2 MB SRTM test zip, and a README edit.

**What I checked before touching anything:** read the new files with credential-looking strings
redacted (none found; test_access.py only calls earthaccess.login, which prompts and saves to
~/.netrc outside the repo). The README change was line-ending only.

**Resolution:** `git pull --rebase -X theirs` so my replayed commits win the README conflict and
every partner file survives untouched; then pushed normally, no force. local == origin/main at fb1bea3.
Partner files left at the repo root on purpose: moving a partner's work without asking is not my call.

**Gap found:** the post-commit hook does not fire after a rebase, so a rebase leaves unpushed commits
until sync-check.sh is run. Rule: after any pull --rebase, run sync-check.sh and push.

**New facts folded into docs/data-access-notes.md:** GISTEMP CSV is open but has no CORS (precompute
it); CMR search is open; GRACE and MERRA-2 downloads need an Earthdata Login.

**Open:** ask the partner to run scripts/install-hooks.sh in their clone, and agree on short-lived
branches or at least pull-before-push so two people on main do not collide again.

## 2026-11-14 13:23 — Ponytail installed and enforced; plan re-cut against it

**Request:** make sure ponytail is installed and that all code adheres to it.

**Done:** copied the six ponytail skills (ponytail, -audit, -debt, -gain, -help, -review) from the Business
workspace into .claude/skills (read-only source; ponytail diffed identical). Added
.claude/rules/procella/ponytail.md and a standing rule in CLAUDE.md so every human and Claude session
on this repo loads it, including the partner's clone and cloud sessions. Rule: /ponytail-review on
every diff before commit, /ponytail-audit at milestones, `ponytail:` comments for known ceilings.

**Honest finding:** my own strategy failed the ladder. The debate plan carried about 215 lines of stats
(seasonal MK, Hamed-Rao, Pettitt), a service worker, a map stack and React, none of which the brief
requires. The brief says linear trends are enough. Biggest cut: POWER already serves an annual mean
(month key 13), so annual-series Mann-Kendall removes the whole seasonal-adjustment layer. Full table in
docs/strategy.md "Ponytail pass". Scientist's non-negotiables are kept, and ponytail's own exceptions
(trust-boundary validation, fill values, statistical correctness, accessibility, tests) are untouched.

**Limit:** this is enforcement by instruction, not by machine. No hook blocks a non-ponytail commit.
It holds only if /ponytail-review is actually run. Revisit a pre-commit check if it slips.

## 2026-11-14 13:26 — iCloud Desktop sync hung git and spawned 286 junk duplicates

**What broke:** the ponytail commit hung for 90 s+ in `git add -A` and left a stale .git/index.lock.
The working tree held 286 untracked files named "<name> 2.<ext>" with June mtimes, many of them
dataless iCloud placeholders; git stalled trying to download them. Cause: this repo lives on
~/Desktop and Finder's "Desktop & Documents in iCloud" is ON (FXICloudDriveDesktop = 1). iCloud
conflict-copied the freshly rsynced skill files.

**Checked before deleting:** none of the 286 were tracked or on origin/main, and every one had its
original beside it. Killed my own stuck git process, removed the stale lock, deleted only the copies,
added "* 2" and "* 2.*" to .gitignore, and ran git fsck (clean).

**Not fixed, needs the owner:** the root cause is the folder location. A git repo inside an
iCloud-synced folder can corrupt .git and keeps spawning conflict copies. Fix is to turn off Desktop
sync or move the repo to a non-synced folder (for example ~/Developer). Changing an iCloud setting is
a system setting, so left for the owner. Until then: run scripts/sync-check.sh after every commit
and do not trust an unpushed local state.
