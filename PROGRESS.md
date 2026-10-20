# Progress

## 2026-10-19 — Phase 1: recovery and design
- Read PROJECT.md, DESIGN_SYSTEM.md, ASSET_INVENTORY.md and the mobile screen sheet from Drive (App Design folder). Original docs and generated mockup images were not recovered; the Drive copies are partial recovery drafts.
- Logo reference images received from the owner (`prototype/assets/reference/`). They are rendered references, **not** production vector assets. A proper SVG/transparent asset is still needed.
- Built `prototype/index.html`: interactive desktop design prototype (11 screens). Uses public-domain WEB text as placeholder for John 1:1–10; ESV is pending license/API key.

## Open items
- GitHub push access: Claude GitHub App must be installed on this repo.
- Desktop design approval from the owner, then Phase 2 (Next.js foundation).
- Confirm provisional items listed in PROJECT.md (default playback-end mode, flip gesture, cross-chapter selection).

## 2026-10-20 — Prototype v2 (matches mobile mockups)
- Rebuilt listener screens from the owner's mobile mockup sheets: ring-style play with skip-verse buttons, end-mode icon at far left and genre note at far right, dot-and-line step indicator with gold triangle arrows, dashed-line Recall/Chain views, highlighted Sing verse, hanging gold verse numbers, OT/NT book + chapter selector, 1–51 verse-range grid, flashcard card with side arrows.
- Playback-end defaults taken from the mockup captions (**assumption, to confirm**): Reader = Next Verse, memorization (Steps/Flashcards) = Loop Verse.
- Mockup monograms read inconsistently ("LF"/"LE"); the owner-supplied L+cross logo is used instead.
- Home hero is a CSS placeholder; landscape art is AI-generated and not used as an asset.

## 2026-10-20 — Prototype v2.2
- Single/multi verse toggle (list button) in Steps; focused verse normal, others faded.
- Procedural SVG scenery (animated light rays, drifting mist) for the Home hero and Recently Studied thumbnails; entry/card/menu transitions; reduced-motion respected.
- Motion library recommendation for the Next.js build: Motion (Framer Motion) for component transitions, CSS for ambient effects; GSAP only if a hero timeline is needed.

## 2026-10-20 — Typography decision
- Owner chose **EB Garamond** (option B) for all serif text, headings and numerals; Cormorant Garamond removed (its old-style "1" read like a capital I).
- Staggered verse fade (single↔multi), selector anchored under clicked control, Switch to Flashcards/Steps buttons added.
- Open: could not reproduce "verses not appearing" on single→multi toggle; made faded Recall dashes brighter. Need step + browser if it recurs.

## 2026-10-20 — Home reveal + faster verse toggle
- Home "Recently Studied" extended to 13 items; rows fade/rise progressively as they scroll up from the bottom edge (scroll-linked, reduced-motion respected).
- Single↔multi verse transition sped up (~.45s per verse, 70ms stagger; leave .2s) per owner feedback.

## 2026-10-20 — Admin upload metadata
- Removed Track title and Version/arrangement. Genre select gains "Custom"; choosing it reveals a Custom genre name input, auto Title Case. Library no longer has an Arrangement column; tracks are identified by passage + genre.

## 2026-10-20 — Mobile view
- Added Desktop/Mobile toggle in the prototype bar. Mobile renders listener screens in a 390px phone frame (no sidebar/right panel, LF mark + ESV + menu header, gear on Home, 5-column verse grid). Same layout applies on real phone-width screens. Admin stays desktop-only.
- Differences from the mockups: Switch to Flashcards/Steps buttons and help icon are additions requested later; Reader shows the selected verse range highlight; hero art is still code-drawn, not photography.
- Book selector: Old/New Testament underline now slides between tabs (.38s ease).
- Flashcards now use a stacked-cards icon (Memorize choice, Switch to Flashcards); the crossing-arrows icon is kept only for Shuffle.
- Book selector: one continuous Old+New Testament list; tab underline follows scroll (and tab click smooth-scrolls); underline slide sped up to .17s. Scroll position preserved when a book expands.

## 2026-10-20 — Handoff to Claude Code
- Wrote PROJECT.md, DESIGN_SYSTEM.md (was empty), ARCHITECTURE.md, IMPLEMENTATION_PLAN.md, CLAUDE.md, docs/DECISIONS.md, .claude/settings.json + /resume /checkpoint /decision commands, .gitignore, .env.example; rewrote ASSET_INVENTORY.md.
- Added reference media under docs/reference (mockups, motion clips, prototype screenshots).
- ESV: owner scope is John 1–2 initially; Crossway policy summarized in PROJECT.md §7; music/audio permission is an open question. **Next: Gate 0 owner approvals, then M1 scaffold.**
- Owner: cross-chapter ranges confirmed; title/arrangement hidden in UI, stored as "Default"/"Default 2"... per passage+genre. ESV key stays in local .env.local only (never in chat/git); settings.json deny rules narrowed so .env.example stays readable.
- Owner supplied a clean logo board (PNG) → assets/brand/. It is raster, not vector; production SVG still needed.
- Added owner-supplied logo SVGs (mark + lockup, dark/light ink) to assets/brand/svg/. Flat single-color redraws; app recolors to gold. Verified shapes against the PNG board.

## 2026-10-20 — M1 scaffold started
- Stack approved by owner (Next.js, TypeScript, Tailwind, Prisma/Postgres, Motion; Vercel + Neon + R2 for later). Work is on branch `m1-scaffold`.
- Added the Next.js app skeleton with a plain placeholder home page. `npm run lint`, `typecheck` and `build` pass.
- Logo SVGs from `assets/brand/svg/` reviewed; they will be wired into the app shell at M2/M3.
- Next in M1: Prettier, Vitest, Playwright, CI, docker-compose Postgres, `.env.example` check.
- M1: added Prettier (`npm run format`) and Vitest (`npm test`) with a first tested helper, Title Case for custom genre names.
- M1: added Playwright with a home-page smoke test (desktop + mobile). Set up the folder structure: `src/client` (frontend), `src/server` (backend), `src/shared` (pure logic), `src/app` (routing). Lint blocks imports across those boundaries. Documented in ARCHITECTURE.md §2 and docs/DECISIONS.md.
- M1: added GitHub CI (format, lint, typecheck, tests, build) and a docker-compose Postgres for local development.

## 2026-10-20 — M2 design tokens and primitives (branch `m2-design-tokens`)
- Added the design tokens (colors, fonts, sunlight layer, gold hover-wipe styles, reduced-motion rule) and loaded EB Garamond and Inter through Next.js fonts.
- M2: added the icon set (three end-mode icons, stacked cards, shuffle, help and the player icons) with a test that there are exactly three end modes and none is a pause icon.
- M2: added Button and Bar (gold hover wipe), the Logo component (gold gradient or flat, from assets/brand/svg), and a dev-only `/design` reference page (404 in production) showing tokens, logo, bars, buttons and icons. Checked visually at 1440px and 390px; e2e tests cover the end modes, the wipe and reduced motion.
- M2 differences from the prototype: none intended. The logo gradient stops are my approximation of the board's gold; confirm with the owner.
