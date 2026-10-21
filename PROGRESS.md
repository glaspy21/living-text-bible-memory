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
- M2: owner supplied the mockup gold colors. Added `--gold-bright` and `--gold-shade`, moved `--gold` and `--gold-dim` to the midpoints of the owner's ranges, and used the palette for the logo gradient. **Open:** the owner says headings use the main gold, but the prototype uses the lighter `--gold2` (`#e8cb8a`) for headings; left as is until confirmed. The hover-wipe and solid-button gradients still use the prototype's colors.
- M2: headings now use the main gold (`--heading`, owner trial). Revert by pointing `--heading` back at `--gold2`.

## 2026-10-20 — M3 app shell (branch `m3-app-shell`)
- Added the app shell: header (logo, reference button, ESV, •••), listener and admin sidebars, and a static player bar (end mode, skip back, ring play, skip forward, genre; disabled until M10). Desktop grid 240 / main / 300 with a 56px header and 124px player; sidebar and right panel collapse at ≤1100px; phone layout at ≤520px with the transparent gear-only header on Home.
- Added placeholder pages for every listener route (Home, Reader, Memorize choice, Steps, Flashcards, Verse range) and admin route (Dashboard, Upload, Library, Timing editor, Preview & publish). Each placeholder names the milestone that fills it.
- Admin pages call a server-side `requireAdmin()`; until sign-in (M5) any production build answers 404.
- Tests: route table unit tests; e2e for the player, redirects, sidebar highlighting, admin nav and the phone layout. Checked visually at 1440, 900 and 390px.
- Open: player shows the Next Verse icon per the [A] end-mode defaults (PROJECT.md #10). Sidebar "Recently studied" is empty until M8.

## 2026-10-20 — M4 database (branch `m4-database`)
- Added the Prisma schema (translations, books, genres, recordings, audio assets, versioned timing sets, verse timings, editor sessions, users) and the first migration.
- Seed loads the 66 books (OSIS codes, URL slugs, chapter counts), WEB and ESV translations (with the ESV copyright notice) and the Pop, Rock and R&B genres. It can be re-run safely.
- Tests: book data (66 books, 1,189 chapters); database tests for seeding, multiple recordings per passage and genre, unique timing versions, cascade of verse timings, published-timing link. CI now runs them against Postgres.
- Reader header now uses the real book name ("Song of Solomon 2").
- Setup for the owner: start Docker, `docker compose up -d`, make sure `.env.local` has the `DATABASE_URL` line from `.env.example`, then `npm run db:migrate` and `npm run db:seed`.
- Note: `npm audit` reports 5 high warnings, all from one dev-only lint dependency (`eslint-config-next` → `braces`); the suggested fix downgrades to Next 14, so left as is.

## 2026-10-20 — M5 admin sign-in (branch `m5-auth`)
- Added Google sign-in for administrators (Auth.js). Only verified Google accounts listed in `ADMIN_EMAILS` can sign in. Admin pages are checked twice on the server: by the proxy for every `/admin` request and by `requireAdmin()` in the admin layout and every page. Signed-out visitors go to `/sign-in`; anyone else gets a 404.
- New `/sign-in` page in the app's style, with a clear message for a rejected account. Admin header shows the signed-in email; sidebar has Sign out.
- Each admin sign-in records a `User` row (role ADMIN) so later uploads can name their author.
- Tests: allowlist, redirect safety, sign-in rules, the gate (unit); browser tests for signed-out, non-admin, forged-cookie and admin access.
- Owner setup needed: create a Google OAuth client and put `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and `AUTH_SECRET` in `.env.local` (see `.env.example`).

## 2026-10-20 — M6 audio storage (branch `m6-storage`)
- Added the storage layer: one interface, a local-disk driver for development and a Cloudflare R2 driver for production, picked by `STORAGE_DRIVER`.
- Admin-only upload routes: request a one-file upload link (MP3 or WAV, up to 300 MB), upload straight to storage, then confirm. The server checks the size and the file's real type from its first bytes, and deletes anything that doesn't match. Originals are never overwritten.
- Audio playback route with HTTP Range support, so seeking will work in the player. Listeners can reach only published recordings; drafts are admin-only.
- Tests: upload rules and Range parsing, signed links, local driver (including path-escape attempts), upload checks, Range serving, R2 signed URLs; browser tests against a running server for 401/403, the full upload, fake files, forged links, Range 206/416 and draft versus published access.
- Found and fixed before it could bite: the AWS SDK's default checksum would have made every real R2 upload fail; turned off and covered by a test.
- **Not verified:** the R2 driver has not talked to a real bucket. When the owner creates one, set the R2 variables, `STORAGE_DRIVER=r2`, and a CORS rule (see ARCHITECTURE.md §6), then try one upload.
- Next (M13): the upload page itself, duration probe and waveform peaks, which create the database rows.

## 2026-10-20 — M7 Scripture provider (branch `m7-scripture`)
- Added the Scripture provider: one interface, a WEB adapter that reads the public-domain World English Bible (all 66 books, imported from ebible.org into the repo), and an ESV adapter that talks to Crossway's API from the server only.
- ESV is off by default (`ESV_ENABLED` plus a key) and limited to John 1–2; anything else is refused before any request. ESV text is held in memory for an hour and never stored. Nothing here claims Crossway permission exists.
- Passages can cross chapters. Added reference helpers ("John 1:51–2:5") and an `Attribution` component showing the right copyright notice (also on `/design`).
- Tests: USFM import, references and the ESV scope, WEB reads of real text (including all 66 books), the ESV adapter with a fake service (scope, caching, errors, no key leaks), the flag.
- Open: the ESV adapter has never talked to the real service (no key yet). Footnotes and Psalm titles are not in the WEB import.


## 2026-10-20 — M8 Reader and selector (branch `m8-reader`)
- Reader: `/read/[book]/[chapter]` shows the whole chapter with hanging verse numbers (WEB for now), the copyright notice, Prev/Next (across books) and a right panel with the selected passage, a music note and Memorize / Edit verse range.
- Tap a verse, then another, to select a range (either direction; a third tap starts over). The selection lives in the URL (`?p=john 1:3-7`) so reload and sharing keep it, and the Memorize buttons carry it on. With nothing selected, Memorize uses the whole chapter.
- Music availability reads published recordings from the database; if the database is unreachable the reader still works and shows no music.
- Phones: the chapter title row is hidden (the header already names it, as in the mockups) but Prev/Next stay, and a full-width Memorize button replaces the hidden right panel. These two are my additions.
- Header badge still says "ESV" (to be made truthful in the translation switch step).
- Book and chapter selector: the header reference button opens one continuous Old → New Testament list directly beneath it. The tab underline follows the scroll and slides; clicking a tab scrolls to that testament; it opens at the current book's testament; a book expands to its chapter grid in place and the current chapter is marked. A dot marks books with published music. Escape, the backdrop or choosing a chapter closes it.
- Translation switch: the header badge now tells the truth. It shows WEB (plain label) until the ESV is switched on, then a menu. The choice is remembered in a cookie. Outside the ESV's permitted chapters (John 1–2) the reader shows the WEB with a plain note, and the copyright notice always matches the text on screen.
- Recently Studied: chapters you open are remembered on this device only (no account). Home shows them newest first with "Today / Yesterday / N days ago", revealed progressively as they scroll up (scroll-linked, reduced motion respected); the sidebar shows the last four; Continue returns to the most recent chapter (John 1 on a first visit). Thumbnails are plain numbered tiles until the photography decision.
- Fixed: the header now sits above the page, so its menus are not covered by the right panel.
- Open: Continue goes to the last chapter read; once Steps remember progress (M11) it can return to the exact step.

