# Design Standards

Applies to **any task that changes how something looks, feels, or moves** — websites, landing
pages, decks, brand guidelines, posters, social, components, dashboards, documents, emails,
and UI. The bar is *designed*, not *generated*. Before designing anything non-trivial, consult
the design-skill library first — do not wing it from memory.

> Pairs with [`frontend/react.md`](../frontend/react.md) (Tailwind is the default styling layer).

> These govern the agency's own surfaces and are never a client system's law; a client's values
> come from its record (R139; owner, session 0, 2026-09-29, decision 18).

---

## 1. Use the design skills — mandatory, not optional

For any visual work, pull from the skill library. Know **what each is for, when to reach for
it, and how to combine them** (3–6 at a time, by brief).

| Skill | Role | When |
|---|---|---|
| **ui-ux-pro-max** | foundation | **Always.** Query its DB (`scripts/search.py` / `design_system.py`) for the matching *style* (Editorial Grid, Exaggerated Minimalism, Brutalism, Bento…) + colour / type / spacing / a11y rules. The rule base every screen is checked against. |
| **taste-skill** | foundation | **Always.** Restraint, spatial rhythm, hierarchy discipline. |
| **impeccable** | polish | Craft / anti-slop pass — committed choices, alignment, detail. Lean harder for rich/bold work. |
| **design-motion-principles** | motion | Any web/HTML motion. Purposeful, eased — never decorative. |
| **ui-craft-editorial** | taste | Type-led / editorial / long-form / brand books. |
| **web-prototype-taste-luxury / -editorial / -artisan / -soft / -brutalist / -southasian** | taste | Pick by the brand's mood (quiet-luxury, warm-editorial, etc.). |
| **art-direction · creative-direction · color-expert · typeset** | support | Photography briefs, palettes, typesetting as needed. |
| ~~framer-motion · 21st-dev~~ | — | **React-only.** Never for static HTML→PDF or non-React output. |

**Combine, don't pick one.** A typical job runs the two foundations + 1–2 taste lenses +
impeccable, plus motion for HTML. Record which lenses shaped the work when it matters.

## 2. Scour the library + the internet first

- Query **ui-ux-pro-max** for the style before composing.
- When the brief is unfamiliar, **search the web** (firecrawl) for current best-practice
  references and real examples — don't reinvent from memory.
- Reach for the skill library before hand-rolling CSS or a layout.

## 3. The non-negotiable visual principles

What separates *designed* from *AI-generated*:

- **Oversized display type.** Headlines `clamp(40px → 180px)`. Type carries the hierarchy.
- **No card chrome.** Never a `border + padding + shadow` box as the default container. Use
  type, space, hairline rules (`1px`), and full-bleed fields instead.
- **Asymmetric / uneven grids. NEVER three equal cards.** Vary spans, weights, row heights.
- **Purposeful negative space — fill the canvas.** No accidental empty quadrants; whitespace
  is deliberate, not leftover.
- **Editorial devices:** drop caps, small caps, pull-quotes, big faded section numerals,
  OpenType features. Accent colour is a *voice* (drop cap, rule, link) — not decoration.
- **A grain / texture layer** for richness — flatness reads as AI.
- **One clear idea per page/section, and vary the layout.** Repeating the same template down
  a doc is monotony — give each section its own composition.
- **Fix clipping by design** — adaptive type sizing / clause-capping so text fits the box.
  Never a blunt `zoom` hack as the remedy.

## 4. Imagery makes it alive

Premium is not the same as alive. The fastest path from "lifeless but pretty" to "alive" is
**real imagery and people**.

- Use photography as **full-bleed backdrops, cutouts, contained shots, and section dividers** —
  not just type and brand-graphics.
- If no photography exists, **generate brand-styled images** (Higgsfield Unlimited, free) on
  the brand's aesthetic + palette; keep a cohesive grade.
- Show people and context wherever the brand world allows it.

## 5. Image treatment

- **Contained images** (anything not filling the whole page/section): slight rounding (~`8px`)
  **+ a 1–1.5px hairline border**. Sharp-cornered inset photos read WordPress-y.
- **Full-bleed / full-page images:** edge-to-edge, **no rounding, no border** (nobody sees a
  rounded corner on a full-page image; let it fill).

## 6. Motion (web / HTML)

- **Purposeful and eased** (`power3.out` / similar) — never bouncy, never decorative-only.
- **Reveals fire when the element is in view** (e.g. ScrollTrigger `start:'top 58%'`), so they
  are actually seen — not as the element enters from the bottom.
- **Photographs get subtle parallax** for depth.
- **Respect `prefers-reduced-motion`.** **Print/PDF is static** — motion must never leave
  content invisible in print (apply hidden states via JS at runtime, force-reset in `@media print`).
- GSAP for self-contained HTML. **Verify motion in a real browser**, don't assume it works.

## 7. Output discipline

- **Tailwind by default** (see `frontend/react.md`); drive brand colours/fonts through the
  Tailwind config, not hardcoded values.
- **Self-contained deliverables must be portable** — bundle fonts/images as relative assets;
  never ship a file that depends on absolute local `file://` paths.
- **HTML→PDF:** render via isolated headless Chrome; poll for the PDF to finish writing; quote
  and URL-encode asset paths (spaces / parens break `url()` and `@font-face`).

## 8. Banned (anti-patterns)

- Boxy grids of equal cards · centred-everything-in-a-void · small timid type · the same
  template repeated down a page · clipping / overflow · sharp corners on contained photos ·
  drop shadows + gradients as crutches · AI clichés ("Elevate / Seamless / Unleash") · stock
  warmth / generic placeholder content.

## 9. Process

1. **Study the skills first** (query ui-ux-pro-max, load the right taste lenses).
2. Build.
3. **Self-review visually** — render and screenshot the actual output; read it like a client.
4. Fix what's boxy / clipped / monotonous / lifeless. Iterate.
5. For HTML: verify motion + portability in a browser before calling it done.
