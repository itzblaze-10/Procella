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

## 2026-11-14 13:35 — 5-minute sync automation and Windows tooling installed

**Request:** Make sure this repo and the local files are synced on a 5 minute basis.

**What was checked:**
- Remote origin is https://github.com/itzblaze-10/Procella.git. Partner (dakshdayalani) had pushed 4 commits (toolkit, strategy, ponytail rules, CLAUDE.md) that were not yet pulled locally.
- Untracked .dodsrc contained local NASA netrc credentials; .gitignore lacked .dodsrc. Added .dodsrc to .gitignore under Secrets immediately so credentials are never staged or leaked.
- Local repository fast-forwarded cleanly to origin/main (33c0a42).
- Existing sync tooling (scripts/install-hooks.sh, scripts/sync-check.sh) was bash-only and failed under Windows sandbox MSYS2 initialization.

**Resolution:**
- Configured core.hooksPath = scripts/hooks so every local commit auto-pushes via post-commit hook.
- Added native PowerShell tooling for Windows: scripts/sync.ps1, scripts/sync-check.ps1, scripts/install-hooks.ps1.
- scripts/sync.ps1 handles robust two-way sync: fetches origin, pulls incoming commits with --rebase --autostash (aborts cleanly on conflicts to prevent workspace corruption), auto-commits local untracked/modified files with timestamp, and pushes to origin.
- Added scripts/install-sync-task.ps1 and scripts/uninstall-sync-task.ps1 to configure a recurring Windows Scheduled Task (Procella-5Min-Sync) running scripts/sync.ps1 every 5 minutes in the background.

**Verification:** Verified with scripts/sync-check.ps1 and tested sync pass.
## 2026-11-14 13:40 — Starter roadmap run for real; groundwork research launched (3 agents)

**Request:** pick a named variable, preview in Giovanni, download a series, test the trend, report rate
per year; then lay the groundwork for a cinematic, multi-page, quest-driven web app with music, 3D and a
Claude Design house brand.

**Starter workflow:** Giovanni needs an Earthdata Login and Claude never types passwords, so step 1 is
left as a signed-in handoff (documented in docs/roadmap.md). Ran the same workflow on open MERRA-2
derived data via NASA POWER: Gandhinagar, annual means 1981-2025, Mann-Kendall + Sen's slope in
scripts/trend.py (stdlib). T2M: -0.0134 C/yr, p=0.113, not detectable. PRECTOTCORR: +0.0210 mm/day/yr,
p=0.0083, detected. Matches pymannkendall.original_test exactly on the live series.

**Mistake caught:** I pre-wrote "reference" values (S=38, Z=3.3779) into the selftest from memory and
labelled them "checked". pymannkendall's real values for that tied series are S=39, var=120.333,
Z=3.4641. Replaced with the real values and re-ran. Lesson: never write expected values into a test
before computing them with the reference library.

**Ponytail review of trend.py** (rule: review before commit): shrank the nested z ternary to
`(s - (s > 0) + (s < 0)) / sqrt(var)` and replaced the hand-rolled OLS with
statistics.linear_regression. 73 to 68 lines, results identical.

**Rules added:** instruction files supplied by the owner are read-only and never enter the repo (CLAUDE.md
rule 9); the brand follows the Claude Design house system strictly (rule 10). The only existing
Claude Design system on the account is "Munshi House Style" (a different project), so Procella gets its own.

**Research launched, max 3 agents:** stack and components; official rules, experience design and brand
candidates; data reality with a full variable-by-region trend screen. Notes land in .tmp/research (git-ignored)
and get synthesised into docs/.

## 2026-11-14 13:48 — Designed roadmap page; deadline discovered; start-year fragility found

**Request:** a designed HTML of the roadmap, 70% work (approach, data reality, collection, how it works), 30% design.

**Built:** docs/roadmap.html (standalone, tokens for light and dark, no framework, charts drawn from the real
45-year series) and a private Artifact at https://claude.ai/artifact/HdvDSMhPJNxkKHoSdf7gax. Browser blocks file:
URLs, so checked it once through a temporary localhost server (only console error: missing favicon). Interim
neutral styling; the Claude Design house system replaces it later.

**Finding 1, the deadline:** the research agent read NASA's submission guide: submission closes Sunday 15 Nov 2026
11:59 pm local time, about 34 hours from now. I re-checked the saved page text myself before believing it. Demo is
capped at 30 s video or 7 slides; most judging weight is on the final project link. This overrides any plan that
assumes days of work: the cinematic scope must be cut to what ships tonight and tomorrow.

**Finding 2, my headline was too strong:** testing the Gandhinagar verdicts across start years showed both flip.
Rainfall "detected" (1981, 1990) becomes not detectable from 2000; temperature "not detectable" becomes "detected
falling" if you start in 1990 (p=0.042). roadmap.md had shown "Detected" with no caveat; corrected, and the page now
carries the start-year table. This is the strongest argument for the trust panel.

**Finding 3, compliance flags for the owner:** (a) SI disclosure is required, SI must not be used to come up with the
solution idea, and our strategy debate was SI-assisted; CLAUDE.md rule 3 (no Claude credit) conflicts with
disclosure. (b) Under-18 names and likenesses are barred from submissions; README and docs name both partners.
Not changed without the owner: only the new HTML header was switched to "Team Procella". Recorded in
docs/challenge-brief.md "Open items".

## 2026-11-14 13:51 — Stack and experience research landed; two docs written

**Stack agent finished.** Verified its key claim myself: the gsap-core, gsap-timeline, gsap-react, gsap-scrolltrigger,
threejs and d3-visualization skills I copied from the Business workspace are ~1 KB stubs pointing at
greensock/skills, which returns 404. The real repos are greensock/gsap-skills (MIT, 18k stars) and
CloudAI-X/threejs-skills (MIT, 4k stars). Not installed: cloning downloads files, so it waits for the owner.
This was a copy-time blind spot: I sized skills by du and never opened them.

**Decisions captured in docs/stack.md:** one document with hash routes (separate pages reset audio and WebGL),
Vite 8.3.5 + vanilla TypeScript, globe.gl 2.46.2 on three 0.187.0 lazy-loaded, GSAP 3.15.0 via npm only (free
licence, not OSI open source), D3 micro-modules, raw procedural Web Audio (no audio files, no licence risk,
and it can sonify the series). Budgets, lite tier, offline plan and Playwright checks recorded.

**docs/experience.md:** routes, five quests mapped to the four objectives plus a Twin Case finale, ranked
goosebump moments, demo modes, data-first rules, three brand candidates (A Terminator recommended).

**Still running:** the data-reality agent (variable catalogue and the trend screen across regions). The roadmap
page updates in place when it lands. Artifact republished with stack status.

## 2026-11-14 14:05 — Data research landed and stopped; real GSAP and three.js skills installed

**Data agent stopped on the owner's call** once the research was enough: 221 trend rows (16 regions x 14
variables, all re-checked against pymannkendall), access map, Giovanni login answer, twin cases, nulls,
fragile cases, snapshot sizing. Only the optional MODIS NDVI pull was unfinished (ORNL: 8 to 59 s per 10-date
call). Killed its three leftover ndvi.py processes too, which kept running after the agent stopped.
Notes moved into the repo as docs/data-reality.md and data/trend-screen-2026-11-14.csv.

**What the data research overturned:**
- The strategy's Chile-vs-Sahel rainfall twin fails a satellite cross-check (IMERG: Sahel flat, Chile borderline).
- Ganges Delta MERRA-2 rainfall jumps in 2016 while IMERG shows no trend: treat as an artefact.
- No temperature twin exists in our 16 regions: every significant T2M trend is warming.
- POWER monthly IMERG returns -999 everywhere; IMERG is daily-only (build annual means from daily).
- Solar, longwave and cloud are spliced (GEWEX SRB to ~2000, CERES after).
- Giovanni needs Earthdata Login to download; guest plotting is limited; GES DISC hydrology Data Rods is being discontinued.
- AIRS, OMI and GLDAS have no open data route we could verify.
- Surviving twins: sunlight Delhi (dimming) vs central Chile (brightening), robust in both products;
  IMERG rainfall Beijing (up) vs Rondonia (down), corroborated by MERRA-2; haze Delhi (up) vs SE US (down).
- Rule adopted: cross-source agreement (MERRA-2 vs IMERG) is the credibility filter. Show it in the app.

**Skills:** cloned greensock/gsap-skills and CloudAI-X/threejs-skills into an isolated scratch folder,
scanned for agent-directed instructions, shell, network and secrets (clean), then installed only what a
vanilla TypeScript build uses: 6 GSAP skills, 11 three.js skills. Removed the six empty stubs (including
d3-visualization). MIT licence texts kept under .claude/skills/LICENSES; CREDITS.md started.

## 2026-11-14 14:16 — Procella House Style built in Claude Design; machine heat diagnosed

**Brand (owner's brief):** a globe-trotter reading news leads and checking a destination's climate record before
going; data and method first, story second; every icon and object coded. Built "Procella House Style" in Claude
Design: https://claude.ai/artifact/LN7Qu38c1iJNLoif9dLgcs. Night and Day themes, plate (evidence paper) constant
across themes, 26 colour tokens all contrast-checked by script (fixed day warm and wet, plate warm and wet, which
missed 4.5:1 on the first pass), 13 type styles (Barlow Condensed, Hanken Grotesk, JetBrains Mono, Caveat for one
field note per screen), spacing, radii, shadows, durations, easings. Ten coded components with live previews and
guidelines: Icon (41 icons), Stamp, LuggageTag, Dossier, ChartPlate, Dispatch, FlapBoard, Compass, SourceBadge,
RouteLine, plus a cover. Previews use only real data: the Delhi and central Chile sunlight series were refetched and
matched the screen exactly. First publish was refused for index.d.ts (no served type); resent as text/plain.
Mirrored to brand/house-style/.

**Heat:** load average hit about 25 during the research burst (three agents, NDVI downloads, headless renders) and
fell to about 10 after they stopped. Only one Chrome instance exists (the owner's, about 45 processes, 1.5 GB).
Remaining CPU is a Chrome tab playing video (VideoToolbox decoder plus coreaudiod), WindowServer and kernel_task
throttling. The real pressure is memory: an 8 GB Mac with about 6 GB swapped. Four idle older Claude sessions each
keep chrome-devtools and playwright MCP servers alive; they are idle and not orphaned, so left for the owner.
Running one agent at a time from here.

## 2026-11-14 14:20 — Judges' deck built by one sub-agent

7-slide "Procella Initial Statement" on the Claude Slides type, globe-trotter house style:
https://claude.ai/artifact/5gVgHjZxrk4M4SFjFQz1Pf. Topics as the owners asked: challenge, team, solution, roadmap and
approach, datasets, plus findings. Every number traced to docs/roadmap.md and docs/data-reality.md (checked against
what this session computed: Gandhinagar rainfall +0.0210/yr p=0.0083 with the start-year strip; Delhi -0.061 and
central Chile +0.044 MJ/m2/day per year). Open: slide 3 names both partners (fine for review, must become
"Team Procella" if submitted as the demo); lane assignment on slide 3 (Daksh on data and stats, Priyanshu on UI)
was the agent's guess from name order and needs the partners' confirmation. Agent ran one headless render and
closed it; no stray browser processes left.

## 2026-11-15 16:30 — Game build started: globe-trotter in real terrain on live NASA data

**Request:** a playable 3D globe-trotter game: home (Play, Explore, Settings), character and vehicle selection
(9 vehicles with physics and paint and decals), Year or Future Zone, pin anywhere on a globe, real-Earth terrain
built without AI, NPCs who tell climate stories from the data, a left panel of NASA layers that switch weather on and
off, Minecraft-style advancements, plus a Globe Lab to compare trends from afar. NASA must be called live every time.

**Verified first (all CORS-open from a browser):** AWS Terrain Tiles (terrarium elevation), NASA GIBS WMTS and WMS
(Blue Marble NG, MODIS Terra true colour, GPM IMERG rain rate, AIRS surface air temperature), NASA POWER monthly and daily
(10 variables in one monthly call, 585 values each), Nominatim. Failed: Overpass API (406 on three mirrors), so NPC sites are
placed procedurally on flat dry land and named with Nominatim reverse lookups. GIBS MODIS NDVI layer name was wrong (400).

**Decisions:**
- Static ES modules with an importmap and vendored three r187 (no npm, no node_modules): a node_modules tree inside the
  iCloud-synced Desktop would set off another sync storm on an overheating 8 GB Mac.
- Partner's Python engine cannot run in a browser and its AIRS, GLDAS, GPM and GRACE plugins need an Earthdata login, so the
  game calls open endpoints live. Critical review of those docs in docs/engine-review.md (causal claim, circular
  decomposition, inconsistent GRACE and GISTEMP numbers, flat GLDAS cache).
- Statistics ported to JS (Mann-Kendall, Sen with Gilbert CI, Spearman with detrended option, projection) and verified
  against pymannkendall values (stats.test.mjs).
- Two sub-agents in parallel: vehicles (models plus physics) and people (characters plus NPCs), each writing only its own
  folder against app/CONTRACTS.md. People done: 30/30 smoke tests.
- git pull hung again (iCloud); killed it and fetched with a timeout. Partner's test zip had vanished from the working tree
  (iCloud eviction); restored from git.

## 2026-11-15 16:39 — Game playable end to end; first browser test pass

Ran the full flow in one headless browser (closed after): home, onboarding, world, story, drive, fly, sail, dossier, Lab.
Real results from live NASA calls: Gandhinagar Jul 2005 heavy rain 6.5 mm/day, AOD 0.86; Kathmandu Jul 2005 10.9 mm/day,
92 % cloud, Cessna took off from the real valley floor at 1,310 m; Mumbai Jul 2019 35.4 mm/day (that year's record
monsoon), yacht spawned on real coastline, harbour site generated. World loads in 4 to 6 s. Ravi the farmer's story quotes
+0.210 mm/day per decade, Detected, p = 0.008, matching the pymannkendall-verified figure. Kathmandu temperature flips to
Not detectable yet when the record starts in 2000.

**Bugs found and fixed:**
- Car sat sunk into the ground: physics read 38 m elevation pixels while the mesh interpolated 100 m cells. heightAt now
  interpolates the mesh's own triangles.
- My scripted edit inserted the debug line at the first "app.home();" match, inside the onboarding Back handler, which would
  have sent every step home. Lesson: never patch by a common substring; anchor on unique text.
- Preview camera framed the traveller too close and behind the panel.
- Globe Lab compared a variable with itself (rho = 1.00) and printed p = 0.0e+0; now picks a different variable and prints
  "< 1e-15". Lab toasts printed raw HTML.
- Ground detail texture aliased into dotted lines at distance; softened. Cloud deck now follows the ground height.
- Python's local test server reset some module requests once (test harness, not the game).

## 2026-11-15 16:45 — Honesty fixes in the Future Zone; weather now changes the surroundings

- **Impossible values:** straight-line extrapolation gave Svalbard January 2060 106 % cloud cover and -0.6 MJ/m2/day
  sunlight. Added physical limits per variable (percentages 0 to 100, wetness 0 to 1, amounts at least 0) in the world,
  NPC stories and Globe Lab projections, each labelled "capped at a physical limit".
- **Story flavour was climate-blind:** a teacher in -9 C Svalbard said children "wilt in the classroom". Temperature roles now
  use cold-climate lines where the 45-year mean is below 8 C (winters losing their bite instead of heat stress).
- Surroundings follow the data: snow washes the ground white below freezing, soil wetness darkens it, wind roughens water,
  near-zero measured sunlight turns the sky to polar night. NPCs stroll loops around their workplaces and stop to face you.
- Test server: Python's http.server queue of 5 dropped module loads; swapped for a threaded server with queue 128 (test only).
- Root index.html forwards to app/ for any static host; README has run instructions.
