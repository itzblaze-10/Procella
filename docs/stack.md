# Stack, Components and Budgets

Research date 14 Nov 2026. Every version was checked on npm and is at least 14 days old. Full notes with URLs: `.tmp/research/stack.md` (local only).

## Four findings that shape the build

1. **"Multi-page" means routes inside one document.** Separate HTML pages reset the AudioContext and the WebGL globe on every navigation and re-trigger the autoplay block. One `index.html`, hash routes, same-document View Transitions. Deploys to any static host and works offline.
2. **The installed `gsap-*`, `threejs` and `d3-visualization` skills are empty stubs** (about 1 KB each, pointing at `greensock/skills`, which returns 404). The real ones are `greensock/gsap-skills` and `CloudAI-X/threejs-skills`, both MIT. Not yet installed; waiting for the owner's go-ahead.
3. **GSAP is free including all plugins** (standard licence, effective 30 Apr 2025). It is not OSI open source, so use it as an npm dependency and never copy its files into the repo. Pin `3.15.0`; npm also carries a 4.0 beta tag.
4. **Headless Chromium renders WebGL2** through software rendering, so automated globe screenshots work. FPS from that setup is not representative of a real GPU.

## Picks

| Layer | Pick | Why |
|---|---|---|
| Framework | `vite@8.3.5`, vanilla TypeScript, about 30-line hash router | Matches the ponytail pass. Astro, Next.js and SvelteKit add weight or reset audio and WebGL per page |
| Globe | `globe.gl@2.46.2` on `three@0.187.0`, lazy-loaded | Points, hex bins, atmosphere and `pointOfView` built in. About 570 KB gz total. Cesium and deck.gl fail offline; React Three Fiber needs React |
| Land | `world-atlas@2.0.2` + `topojson-client@3.1.0`, hex-dot polygons | No photo texture needed |
| Motion | `gsap@3.15.0` + ScrollTrigger; `lenis@1.3.27` optional | ScrollTrigger 45 KB gz, Lenis 5 KB gz (measured). CSS scroll-driven animation only for trivial reveals |
| Charts | D3 micro-modules (`d3-scale`, `d3-shape`, `d3-array`, `d3-axis`) with hand-written SVG | About 19 KB gz. We own the scales, so playhead, line-draw reveal and Sen's-slope line are easy. Observable Plot (98 KB gz) is the quick alternative |
| Audio | Raw Web Audio API, fully procedural, no audio files | 0 KB, no third-party rights, and it can sonify a series |
| Tests | Playwright 1.64.1, axe-core, Lighthouse 13.6.0 | See Testing below |

Tone.js `15.1.22` is the upgrade path if raw Web Audio is outgrown. Howler is pointless without audio files.

## Audio

- Browsers block audio until a click, tap or key press. Scrolling does not count. Use an **"Enter with sound / Enter silent"** splash; create and resume the AudioContext inside that click. Keep a persistent mute toggle and suspend when the tab is hidden.
- iOS: set `navigator.audioSession.type = 'playback'` so the silent switch does not mute it. Untested on a real iPhone.
- Music sourcing: **procedural**. Only per-file CC0 sounds are safe to commit. Pixabay Music forbids standalone redistribution, which includes a public repo. Every asset gets a row in `CREDITS.md`.
- Sonification: one note per year, pitch mapped to the series' own min to max across two octaves of D minor pentatonic. The UI states "pitch range = this series' own min to max". A non-significant result ends on an unresolved chord, never a triumphant one. NASA's SI policy asks for audio acknowledgment in text and metadata; code-generated audio still goes in the SI statement.

## Component catalogue (verified with `gh api`: licence, last push, not archived)

Useful: `vasturiano/globe.gl`, `vasturiano/three-globe`, `darkroomengineering/lenis`, `bramus/view-transitions-demos` (Apache-2.0, keep the notice), `greensock/gsap-skills`, `CloudAI-X/threejs-skills`, `pmndrs/postprocessing` (Zlib), `FarazzShaikh/glNoise`, `mdn/webaudio-examples` (CC0), `julianna-langston/chart2music` (accessible audio chart navigation), `Cuberto/mouse-follower` (20 lines of our own code does the same), `Makio64/threejs-cinematic-world-zoom` (camera ideas only; needs the network), `russellsamora/scrollama` (pattern only), `janarosmonaliev/github-globe` (visual reference only). The research notes list 16 in total.

Rejected: `oframe/ogl` and `arscan/encom-globe` (no licence), `dataarts/webgl-globe` (archived), all `codrops/*` demos (no licence), `nasa/NASA-3D-Resources` (no SPDX), `badsvetac/visulaserz` (AGPL).

The owner's separate instruction files may name more components. They are read-only inputs and never enter the repo.

## Reference sites to study

NASA Eyes on the Earth (persistent time scrubber), earth.nullschool.net (particle flow, almost no chrome), showyourstripes.info (a series as diverging stripes), Ed Hawkins' Climate Spiral (animated time-series reveal), Copernicus Climate Pulse (giant headline number over a clean anomaly chart), Google Earth Engine Timelapse (40 years scrubbed in seconds), The Pudding (one claim per scroll step), Chandra "A Universe of Sound" (legible data-to-sound mapping).

## Budgets

- JS: first load at most 120 KB gz, globe chunk at most 600 KB gz, total at most 800 KB gz, `dist/` at most 5 MB. Fonts self-hosted, at most 120 KB. No globe photo texture (if one is added: 2048 by 1024, at most 400 KB).
- Runtime: 60 fps on integrated graphics, at least 30 fps on mid phones. Device pixel ratio capped at 2 (1.5 on mobile). Pause rendering when hidden or offscreen.
- **Lite tier:** a 600 ms frame-time probe after Enter switches to pixel ratio 1, no atmosphere, no particles, no Lenis. Visible "Reduce effects" toggle and `?lite=1`.
- WebGL missing or lost: static globe image, the data experience still works.
- Reduced motion: no scrubbed camera, auto-rotate, parallax or Lenis; instant route changes.
- Accessibility: skip link, focus to `<main>` on route change, canvas `aria-hidden`, contrast at least 4.5:1, colour never the only signal, quests keyboard-completable, native cursor stays visible.
- Photosensitivity (WCAG 2.3.1): nothing flashes more than 3 times a second, fades of at least 300 ms, a pause control for anything moving longer than 5 s.
- Offline: every asset same-origin; POWER falls back to a committed snapshot; preload all route chunks on Enter; run `npx vite preview` on the demo laptop and keep `dist.zip` on a USB stick. A double-clicked `file://` page will not work.

## Testing

Playwright desktop, mobile WebKit and reduced-motion projects: zero console errors; screenshots at scroll offsets with the canvas masked; assertions that verdict, slope, CI and badge stay visible during animation; axe-core on every route; an offline test that aborts non-localhost requests; a WebGL-off test; Lighthouse; a frame-time sampler; a gzip budget script. Real fps needs a headed Chrome on the Mac GPU and one weak borrowed machine.

## Top 5 risks

1. Effects bury the data and scope outruns two people. Build in slices, data-first Explore page first, fixed kill order: cursor, Lenis, shader backgrounds, overlay, sonification.
2. The demo dies on stage. Same-origin assets, snapshots, local preview plus `dist.zip`, `webglcontextlost` handler, Enter click gate, backup recording.
3. Performance on judges' devices. Budgets, lazy globe chunk, lite tier, early test on a weak machine.
4. One-shot integration drift (GSAP 3 vs 4 beta, ScrollTrigger leaking across routes, invented APIs). Lockfile, real skills installed, one `mount()` cleanup contract per route, one hand-verified vertical slice first.
5. Asset and licence provenance. Procedural music, no photo textures, `CREDITS.md` with an SPDX row per asset, a plain-text NASA credit with no logo, GSAP only via npm.

## Not verified

iOS silent-switch behaviour on hardware, per-file licences on NASA sonifications, licences of example textures in three.js and three-globe, offline behaviour of `pmndrs/detect-gpu`.
