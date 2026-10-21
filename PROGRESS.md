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


## 2026-10-20 — M9 Verse-range selector (branch `m9-verse-range`)
- `/memorize/range?p=…` lets you pick any run of verses in one book: tap a start verse, then an end verse; tap Start or End to move just that endpoint; no length limit; ranges can cross chapters (use the chapter arrows or the dropdown while you pick). Choosing another book starts a fresh selection there.
- Matches the prototype: gold dropdown, verse grid (5 across on phones), bright endpoints with a tinted run between, Start/End chips, "Selected" line with the verse count. The passage is kept in the URL, so reload and links keep it; Memorize carries it on.
- The book/chapter panel is now reusable (choose without leaving the page). The verse grid uses the WEB's numbering for every translation.
- Tests: the selection rules (all tap sequences, endpoints dragging each other, cross-chapter, verse counts) plus browser tests of the whole screen.
- Note for next steps: don't run `npm run build` while `npm run dev` is running; it overwrites the dev server's files.

## 2026-10-20 — M10 Audio engine (branch `m10-audio-engine`)
- Step 1 (logic, no UI yet): the segment resolver turns a passage plus published recordings into one segment per verse (earliest arrangement or the chosen one; a verse nothing covers stays uncovered and is never filled from another genre; works across chapters and across recordings), and reports which genres cover the whole passage.
- The playback state machine is a pure function with 40+ tests: idle/loading/playing/paused/verse-ended; Loop Verse, Stop After Verse and Next Verse (skips gaps, honors overlaps, last verse always stops, uncovered verses skipped); skip and seek while playing or looping; preload of the next recording; errors and retry; audio never starts without Play.
- Step 2 (the working player): the player bar now plays real audio. Verse-end detection runs every animation frame; Loop Verse, Stop After Verse and Next Verse behave as specified (checked in the browser with a generated WAV: next plays through and stops after the last verse with music, stop pauses at the verse end, loop keeps repeating, skip works while playing). Audio never starts on its own. The end-mode menu shows exactly the three modes; the genre menu lists genres that cover the passage and says when only some verses have music. The verse being played is highlighted in the reader.
- Added `GET /api/playback` (published recordings with published timing only) and DB tests for it.
- Open: a hidden tab can catch verse ends up to about a second late (browsers slow timers); if it matters on phones the fix is Web Audio. Nothing can be published yet (the timing editor and publish are M15–M16), so for now music only appears in tests.

## 2026-10-20 — M11 Memorization Steps (branch `m11-steps`)
- `/memorize/steps?p=…&step=…`: Listen · Sing · Recall · Chain with the glowing-dot stepper (◀ ▶ wrap around), the single/several-verse toggle at the top left (others fade in place, text size never changes, staggered ripple), Chain always showing the whole passage, dashed placeholders with Reveal/Hide Scripture in Recall and Chain, the one-line help, Switch to Flashcards, and a right panel with the passage (Edit range), the end mode and the genre.
- Listen and Recall start on one verse, Sing on several, until you use the toggle. The practice end mode starts as Loop Verse (the assumption in PROJECT.md #10).
- Music and text move together: choosing a verse moves the music to it; skipping or the next verse playing moves the focus. Audio never starts by itself.
- The step is kept in the link, and Home's Continue now returns to it ("John 1:3–6 · last: Recall"). The Memorize choice page carries the passage to both methods.
- A passage is always in one translation: if the ESV can't supply all of it, the whole passage is the WEB with a note.
- Tests: the step rules (four steps exactly, defaults, wrap, focus modes, dashes) plus browser tests of every behavior above, including playing real audio through the steps.

## 2026-10-20 — M12 Flashcards (branch `m12-flashcards`)
- `/memorize/flashcards?p=…`: one card per verse. The front shows BOOK, chapter:verse and "Tap to reveal"; tapping (or Enter/Space) turns the card over in 3D to the verse; back/next arrows (and the left/right arrow keys) move through the deck and wrap around; Shuffle makes a new random order and always changes it; "Switch to Steps" carries the passage; "CARD n OF m" counter; phone layout with a shorter card.
- Audio plays only on Play: flip, next, back and shuffle never start the music (browser test with real audio). If the music is already playing it follows you to the next card's verse. Keyboard focus stays on the card as you move.
- Home's Continue returns to the flashcards ("John 1:3–6 · Flashcards").
- **Open (owner decision, [A]):** the flip gesture is a tap on the card; confirm or tell me a different gesture.
- Tests: deck rules (wrap, shuffle contents, forced change) and browser tests of every behavior above.

## 2026-10-20 — M13 Admin upload (branch `m13-admin-upload`)
- `/admin/upload` is now the real Upload → Metadata steps (with the full workflow bar): drop or choose an MP3/WAV, watch it upload straight to storage with progress, and have the server verify it is really that kind of audio. The browser decodes it to read its length and draw a waveform (a bonus: if it can't, the recording is still saved and says the waveform will be made later).
- The metadata form: translation, genre (Pop, Rock, R&B, or Custom, which reveals a name field that fixes itself to Title Case), book, chapter, from/to verse, "continues into a later chapter", optional description. Mistakes (a verse that doesn't exist, a last verse before the first) are shown before saving.
- Saving creates a **draft** recording, never replacing an existing one: the same passage and genre becomes "Default 2", "Default 3". It also saves the length, a SHA-256 fingerprint of the file, the waveform, and an empty timing sheet with one blank row per verse (across chapters too), ready for the timing editor. Drafts are invisible to listeners.
- Length is read from the file itself (WAV header; MP3 frame count or constant-bitrate estimate), so no audio tools are needed on the server.
- New admin-only routes: `POST /api/admin/recordings`, `GET /api/admin/recordings/[id]/peaks`; public `GET /api/scripture/verse-counts`.
- `/admin/timing?recording=…` shows the saved recording (the editor itself is M15).
- Tests: WAV/MP3 length probes (header, Xing frame count, ID3 tags, junk), waveform peaks, passage and genre checks, service tests against the database (arrangements, custom genres, cross-chapter rows, rejection leaves nothing behind), and browser tests of the whole wizard with a real WAV.
- Not verified: very large files (the browser skips the waveform above 200 MB), and real R2 uploads (see M6).


## Handoff note (2026-10-20, after M13) — superseded by the 2026-10-21 note at the end of this file
- **Where we are:** M1–M13 are done and pushed as chained branches (`m1-scaffold` … `m13-admin-upload`, tip `59d47e1`). The owner merges them into main; I can't push to main. Next is **M14 Admin library & dashboard**, then M15 timing editor, M16 validation and publish, M17 listener music selection, then Phase 4 testing. Nothing is half-done; the working tree is clean.
- **M14 design question to settle first:** "replace audio" (ARCHITECTURE.md §3: new asset + a new timing draft seeded from the old one). The schema ties the audio to the recording, not to a timing set, so replacing audio on a *published* recording would break what listeners hear. Plan: allow replace on Draft/Ready recordings (keep the old asset untouched, archive the old timing and seed a new draft from it), and for a Published recording create a new draft version that only goes live on publish (may need an asset link on the timing set: a migration). Decide, record in docs/DECISIONS.md, then build the library list (filter All/Published/Ready/Drafts, several recordings per passage) and the dashboard (counts, "Needs attention").
- **Working rules to keep:** one branch per milestone off the previous one; commit with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; push with exactly `git push -u origin HEAD` (other forms trigger a permission prompt); run `npm run lint`, `typecheck`, `npm test`, `npm run test:db`, `npx playwright test` before committing; update PROGRESS.md in the same commit.
- **Gotchas:** don't run `npm run build` while `npm run dev` runs (it clobbers the dev server's files); after CSS/layout changes restart the dev server if pages look stale; browser tests call `streamed(page)` (tests/e2e/helpers.ts) after `goto`/`reload` because streamed pages briefly have a hidden duplicate; browser tests that play audio use `tests/e2e/audio-fixture.ts` and a book no other spec uses.
- **Open owner items:** merge the branches; put the Google OAuth values, `AUTH_SECRET`, `ADMIN_EMAILS` and `DATABASE_URL` in `.env.local`; create the R2 bucket with CORS before real uploads; decisions on end-mode defaults, flashcard flip gesture, ESV key and Crossway terms (and whether the music needs its own permission), photography, cross-chapter playback rules, WAV→streaming conversion, final logo, and gold gradients for the wipe and solid buttons.

## 2026-10-21 — M14 Admin library and dashboard (branch `m14-admin-library`)
- **Replace audio (decision recorded in docs/DECISIONS.md):** the old file is never touched. The new upload becomes a new audio asset; every earlier timing sheet is pinned to the audio it was made for (migration: `TimingSet.audioAssetId`, restrict-on-delete); a new draft sheet is seeded from the latest one with the same boundaries (acknowledgements cleared). A published recording keeps playing its published audio and timing until the new draft is published; draft/ready ones go back to draft. Playback and the audio route now follow the published timing's audio.
- `/admin/library`: filter All / Published / Ready for review / Drafts (kept in the URL), one row per recording (passage, genre with "Default 2"-style label, status, timing progress, length, upload date), several recordings of one passage and genre side by side, **Timing** and **Replace audio** buttons (confirm, upload with progress, then opens the timing page). Published rows with a waiting draft say so.
- `/admin` dashboard: counts (Published, Ready for review, Drafts, Passages with music), a **Needs attention** list with the reason and an Open editor link, and recent activity. Both match the prototype screenshots.
- New admin-only route `POST /api/admin/recordings/[id]/audio` (401 signed out, 403 non-admin).
- Tests: filter/label/attention rules (unit); replace audio against the database (draft, ready, repeated, published stays live, new audio private until publish, refusals leave nothing behind); library and dashboard queries; browser tests of the library, filters, dashboard, the replace flow with real audio, a refused fake file and access control.
- Dev note: `.env.local` has no `DATABASE_URL` yet, so I ran the migration with the local Docker URL from `.env.example`. Run `npm run db:migrate` after merging.
- Open: "Ready" status is only reachable once M16 (validation) exists; until then everything shows as Draft or Published. The timing editor itself is M15. Next: **M15 Timing editor**.

## 2026-10-21 — Flashcards: Shuffle switch and Restart (branch `m12b-flashcard-shuffle`, off `m14-admin-library`)
- Owner request. Shuffle is now an on/off switch, lit (gold border, fill, glow) when on. Turning it on keeps the card you are on and then goes through every other card once, at random; turning it off keeps the card and carries on in sequence from it. After the last card it wraps to the first, as before.
- New **Restart** button under Shuffle: back to CARD 1 OF n. In shuffle mode it starts a fresh random pass and stays shuffled. **Confirm:** is that the right reading, or should Restart in shuffle mode replay the same order?
- With Shuffle on, "CARD n OF m" counts your place in the current random pass, so turning it on shows CARD 1 OF m on the same verse.
- Audio still starts only on Play (flip, next, back, shuffle and restart never start it). Tests: deck rules (unit) and browser tests on desktop and phone (off by default, sequence, on keeps card and covers every card, real randomness, off keeps card, Restart in both modes, layout order).
- Layout change (owner): Restart and Shuffle now sit on one centred line beneath the cards, **Restart on the left**, spaced apart. Restart has the same gold outline as a lit Shuffle but only lights up (fill and glow) while pressed; Shuffle stays lit while on.

## 2026-10-21 — Header navigation down to the verse (branch `m8b-verse-navigation`, off `m12b-flashcard-shuffle`)
- Owner request. The header's centre button now always shows Scripture navigation: the chapter in the reader, the passage on Memorize/Steps/Flashcards/Range, and elsewhere the last chapter read on this device (John 1 on a first visit). "Home", "Memorize", "Flashcards" and "Verse range" no longer appear there. (Phone Home keeps its header without the button, as in the mockups.)
- The selector: books → chapters as before; picking a chapter puts its number beside the book title (and in the header button) and swaps the chapter numbers for that chapter's verse numbers in the same window. Pick a verse to open the reader there: scrolled into view and marked briefly (no animation under reduced motion). Each step has a centred title ("Chapter", then "Verse"); "← Chapters" goes back; verse 1 opens the chapter from its start (no separate Read chapter button); Escape or the backdrop closes and drops the unopened pick.
- Chapter cells in the header selector are now buttons (they were links); the range selector's use of the panel is unchanged.
- Tests: header-label rules (unit); browser tests for the whole flow on desktop and phone, back, close, read chapter, and the header on every screen.
- Open: `?v=` scrolls once per arrival; picking the same verse again while already there does not re-scroll. Memorize screens link to the reader's chapter only (not a verse) for now.

## 2026-10-21 — Continuous reading and range highlight (branch `m8c-continuous-reader`, off `m8b-verse-navigation`)
- Owner request. **Scrolling goes on into the next chapter**: near the end of a chapter the next one loads below it (own heading), and so on to the end of the book, where "Continue to <next book> 1 ›" appears. Loading failures say so and offer Try again. New route `GET /api/scripture/chapter` (translation fallback as on the page, never cached).
- The chapter in view (about a third down the screen, once the reader has actually scrolled) updates the address (`/read/john/2`, rewritten in place, no extra history), the header button, Recently Studied, the whole-chapter default for Memorize and the right panel's music note (it now knows which chapters have music, `chaptersWithMusic`). Prev/Next at the top still belong to the chapter the page was opened on.
- **Range highlight**: all verses of a range get the same tinted background; only the first and last verse (or a single tapped verse) get the gold edge on the left. Ranges work across chapters that have been scrolled into view (e.g. John 1:50–2:3).
- Tests: marking rules (unit); chapters-with-music (database); browser tests for loading on scroll, address/header/panel following, recents, end of book, failure and retry, `?v=` with chapters below, ranges (tint vs edge, across chapters) and the new route. Existing reader tests now tolerate several chapters on the page.
- Open: only forwards (scrolling up past the opened chapter does not load the previous one; use Prev). Memorize screens still start from the passage, not from continuous reading. Scroll position when a chapter is appended is untouched (nothing above moves).

## Handoff note (2026-10-21, latest) — start here after clearing context
- **Where we are:** M1–M14 are done, plus three owner-requested reader/flashcard changes. Nothing is half-done; the working tree is clean and every branch below is pushed. **Next milestone: M15 Admin timing editor** (then M16 validation and publish, M17 listener music selection, then Phase 4 testing).
- **Branch chain** (each is off the one before; the owner merges, I can't push to main): `m1-scaffold` … `m13-admin-upload` (`59d47e1`) → `m14-admin-library` (`305f715`: library, dashboard, replace audio) → `m12b-flashcard-shuffle` (`68cf82e`: Shuffle switch, Restart) → `m8b-verse-navigation` (`5ff7930`: header always Scripture navigation, book→chapter→verse in one window) → **`m8c-continuous-reader` (`b496961`, current)**: scroll on into the next chapter, range tint with gold edges only on first/last verse. Start M15 from a new branch off the current tip unless the owner has merged some of these.
- **What the owner asked for most recently** (all done, recorded in docs/DECISIONS.md): flashcard Shuffle is an on/off switch with Restart to its left; the header centre is never a page name; the selector shows "Chapter" then "Verse" titles in one window (no Read chapter button, verse 1 opens the chapter); continuous scrolling within a book; range tinted with a gold edge on the two end verses only.
- **Open questions waiting on the owner:** (1) Restart while Shuffle is on starts a fresh random pass (my reading; say if it should replay the same order). (2) Continuous reading stops at the end of a book and offers the next book (a recording and a selection belong to one book). (3) Scrolling goes forward only; Prev still goes back a chapter. (4) Everything from earlier: merge the branches; put Google OAuth values, `AUTH_SECRET`, `ADMIN_EMAILS` and `DATABASE_URL` in `.env.local`; create the R2 bucket with CORS; end-mode defaults, flashcard flip gesture, ESV key and Crossway terms (and whether the music needs permission), photography, cross-chapter playback rules, WAV→streaming conversion, final logo, gold gradients for the wipe and solid buttons, heading gold trial.
- **M15 starting points:** `/admin/timing?recording=<id>` already shows the saved recording and its empty draft timing sheet (one blank row per verse, `VerseTiming`); original audio is served to admins at `/api/audio/<assetId>` (Range supported) and the waveform peaks at `/api/admin/recordings/<id>/peaks`. The editor works on the newest `DRAFT` timing set; "replace audio" already seeds a new draft from the old boundaries (`TimingSet.audioAssetId` says which audio a sheet was made for). Needs WaveSurfer, ruler, zoom, scrub, draggable handles, numeric entry, per-verse preview, autosave and `EditSession` history. Gap/overlap/validation rules belong to M16 (pure module, 100% tested); published timing is never edited in place (new draft version).
- **Working rules to keep:** one branch per feature off the previous one; commit as `feat|fix|docs|test|chore: …` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; push with exactly `git push -u origin HEAD`; before committing run `npm run format -- --check` (or `npx prettier --write`), `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npx playwright test`; update PROGRESS.md and docs/DECISIONS.md in the same commit; check UI changes in screenshots at desktop and phone widths (admin is desktop-only).
- **Gotchas:** don't run `npm run build` while `npm run dev` runs. `.env.local` has no `DATABASE_URL`, so run Prisma commands as `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/livingtext npx prisma migrate dev --name …` (the value is the public local Docker default from `.env.example`). Browser tests call `streamed(page)` after `goto`; they share the test database, so each spec uses books no other spec uses (taken: Obadiah, Nahum, Habakkuk, Micah 33, Haggai 37, Zephaniah, Ruth/Esther/Isaiah in DB tests). Keep new e2e cleanup to your own rows (`TestDb.cleanup`), never `removeRecordingsCreatedBy` for rows you didn't create through the app. Reader pages can now hold several chapters, so tests use `[data-chapter="n"] [data-verse="v"]` and `.first()` for `chapter-text`. Next doesn't update `usePathname` when the address is rewritten with `history.replaceState`; the reader tells the header with the `lt:chapter-view` event. A selected range shows `data-edge="true"` on its two end verses. Admin pages are checked server-side with `requireAdmin()` and API routes with `rejectUnlessAdmin()`.
- **Test counts at this point:** 291 unit, 36 database, 257 browser (59 skipped by design on one project or the other); lint, typecheck and format clean.

## 2026-10-21 — Reading in both directions, from book to book (branch `m8d-reader-backward`, off `m8c-continuous-reader`)
- Owner request. The reader now scrolls **up as well as down**, and runs on **across books** in the order of a modern Bible: the end of Obadiah continues into Jonah 1, the start of Jonah goes back into Obadiah 1; Genesis 1 and Revelation 22 are the two ends. This replaces the earlier "stops at the end of a book, offers Continue to…" (removed).
- Earlier chapters are added above only once the reader goes up (wheel, upward scroll, touch, ↑/PgUp/Home), and the page is shifted by the added height so nothing jumps. Opening a chapter still shows it at the top; scrolling down to a verse from the header menu is undisturbed. The opened chapter keeps its title and Prev/Next.
- The chapter in view in any book drives the address (`/read/jonah/1`), header, Recently Studied, Memorize's whole-chapter default and the music note. A selection never crosses books: tapping a verse in another book starts a new selection there.
- New: `chaptersWithMusicByBook` (music note for any book). Tests: browser tests for up-scroll without a jump, address following up, Genesis 1 / Revelation 22 ends, book-to-book both ways, selection across books; a database test. Unit 291, database 37, browser 267 pass; lint, typecheck, format clean.
- Open: Memorize screens still start from a passage, not from continuous reading. Very long scrolls keep every chapter in memory (fine for now).


## 2026-10-21 — Reader heading follows the top verse; selector opens on the chapter view
- Header chapter now follows the verse at the top of the screen (first verse with any part in view): it changes the instant an earlier chapter's verse appears above, and holds until the top verse has scrolled completely out.
- Choosing a verse in the selector scrolls it to the top of the screen (nothing of the previous verse showing).
- The header selector opens already on the current book's chapters with the current chapter marked (header only; the range picker is unchanged).
- Tests updated/added in `continuous-reader.spec.ts` and `book-selector.spec.ts`.
- Verse arrival no longer highlights the verse (it is already at the top of the screen).
- Tapping the one selected verse again switches it off (the `?p=` selection is dropped and Memorize uses the whole chapter). Ranges still start over on a tap.
- Fix: a verse chosen in the selector now reaches the top even near the chapter's end (it retries once the next chapter has loaded below), after tapping a verse, and when the same verse is chosen twice (the selector tells the reader directly).

## 2026-10-21 — Cross-book ranges and chapter triangles
- A passage can now run across books (`?p=luke 24:50-john 1:3`): reader taps, the range picker, Memorize text (Steps, Flashcards) and the player (per-verse segments from each book's own recording; a new song at the book boundary). See `docs/DECISIONS.md`.
- Previous/Next chapter buttons are now left/right triangles in the chapter title colour on the title line, also on every chapter scrolled on to.
- Open: a cross-book range in the ESV (only John 1–2 is licensed) falls back to the WEB as a whole, as for any out-of-scope passage. Not tested with real multi-book recordings (the test library has none): the per-book matching is unit-tested only.
- Fix: on the Memorize screens the header names only the book and chapter where the passage starts (e.g. "Luke 23"), never the verse numbers.
- Steps: the single/several-verses toggle no longer lights up (it looks the same in both views); its icon now shows the current view — one dot with one line for a single verse, three dots with three lines for several (and for Chain's whole passage). The Flashcards "Switch to Steps" link keeps the three-line icon.
- Steps, single-verse view: verses out of view now fade and then give up their space, so the focused verse moves up beneath the toggle / Switch to Flashcards row, the page doesn't scroll and Listen · Sing · Recall · Chain stay in view (unless one verse is itself taller than the screen).
- Steps: the help button, the Listen · Sing · Recall · Chain bar and the translation notice are pinned to the bottom of the scrolling area; long text scrolls away behind them (soft fade above). Checked at desktop and phone widths.
- Steps: the black panel behind the steps bar is gone. The passage now scrolls in its own area above the steps and fades out toward them (and slightly at the top), so the steps are the focus.
- Steps: going from one verse to several keeps the focused verse exactly where it was on screen; the verses after it appear below and the earlier ones are above, to scroll up to.
- Steps, several → one verse: the other verses fade out while the chosen verse stays completely still; after a clear pause (~0.4s) they close up and the verse glides to the top beneath the toggle row. One → several keeps the verse still while the others open around it. Reduced motion swaps instantly.
- Open: `admin-library.spec.ts` fails against the shared test database when recordings from earlier runs are left behind (Micah 1:1–3 appears twice); unrelated to the reader/steps work. Clean the `livingtext_test` recordings or let me add per-run cleanup.

## 2026-10-21 — Steps verse arrows, flashcard flip fix, button polish
- Steps: the "Focus verse · click a verse to move focus" line is gone. Plain gold left/right triangles (same as the reader's chapter arrows) now sit centred on the toggle row and move the focus to the previous/next verse (disabled at the ends and in Chain). In the single-verse view the verse is replaced at once, so two verses never show together; several-verse and Chain transitions are unchanged. Removed `focusLabel`.
- Flashcards: the previous/next arrows are the filled triangles. Fix: after moving to another card the card could not be turned over (the slide-in animation kept a `transform` that overrode the flip); the slide-in no longer holds its end state. Regression e2e test added.
- The solid "Memorize" buttons (reader panel, range picker) use EB Garamond 19px like the other buttons.
- Open: the owner reported the card still not flipping after the fix; could not reproduce in Playwright (desktop and mobile). Dev server restarted; if it recurs we need the browser and whether music is playing.

## 2026-10-21 — Passage card, range picker, Recall/Chain reveal buttons
- Reader right panel: the shared Passage card (live reference + Edit range), then Memorize and Music. Edit range opens the range picker with `from=read|steps|flashcards`; its **Select range** button returns to that screen (Steps keeps its step).
- Range picker: one scrolling list of chapters that runs on across books in Bible order (books load as you near either end); Start/End buttons, hint and verse count removed; big range text above the button. Select range stays pinned at the bottom.
- Recall always shows one verse (toggle disabled). Recall and Chain share Reveal word / Reveal verse / Hide word / Hide verse that run through the whole passage in order; hidden words show as per-word dashes. See `docs/DECISIONS.md`.
- Flashcards: the "Audio plays only when you press Play…" line is removed.
- Open: scrolling the range list through a very long run of books keeps every loaded book in the page (no trimming yet). The owner reported flashcards not turning after the arrows; fixed the animation that blocked it, could not reproduce afterwards.
- Sidebar: "Memorize" replaced by **Memorization Steps**; it and Flashcards open the range picker directly and Select range returns to the screen. The method-choice page now only follows the reader's Memorize button. Bare Steps/Flashcards URLs redirect to the picker. The player bar no longer shows on the picker (a hidden previous page was keeping it on). Reader → Edit range opens the picker on the selected range (test added).
- Open: `admin-library.spec.ts` still fails when earlier runs left recordings in the shared test database (see above); unrelated.
- Range picker → reader: Select range returns to `/read/<book>/<chapter>?p=…&v=<first verse>&jump=1`; the first verse of the range is at the top at once (no smooth scroll). The picker also restarts on a new passage (Next kept its old range when revisited).


## 2026-10-21 — M15 Admin timing editor (branch `m15-timing-editor`, off `m8d-reader-backward`)
- `/admin/timing?recording=…` is now the editor: waveform with a time ruler and verse regions, play/pause, click or drag to scrub, **draggable start/end handles**, zoom (buttons, Ctrl/⌘+wheel, Fit) with a scroll bar, **Mark at playhead** (key M, Space plays), a table with typed times (`m:ss.mmm`, ↑/↓ nudges), "Start here / End here" at the playhead and a **per-verse Preview** that stops where the verse ends.
- **Autosave** into the draft sheet (one request at a time) with a visible state, a warning if you leave with unsaved changes, and **Earlier sessions** to return to a previous state (the current state is kept first). A published recording opens read-only until you **Start a new draft version**; the published timing is never edited in place.
- Server: `createTimingEditor` (load, startDraft, save, sessions, restore) behind admin-only routes `GET/PUT/POST /api/admin/recordings/[id]/timing` and `GET/POST …/timing/sessions`; the peaks route can fetch a specific audio file (`?asset=`) so a draft made for replaced audio draws its own waveform.
- Tests: timing rules (unit, 36), editor service (database, 15), browser tests of entry, autosave, bad times, nudging, marking, dragging, zoom, preview, sessions, the published flow and access. Also made `admin-library.spec.ts` clear its books first (it failed when earlier runs left rows behind).
- Open: validation flags and the Ready/Publish flow are M16 (the sheet already stores acknowledgements). Not verified with a real full-length chapter recording or an MP3 (tests use a 12 s WAV); a very long recording at the widest zoom is drawn per pixel column and should be fine, but was not measured.

## 2026-10-21 — M16 Validation and publish (branch `m16-validation-publish`, off `m15-timing-editor`)
- **Validation** (pure, tested): errors that block (missing boundary, end not after start, outside the recording, verse starting before the one above) and warnings you acknowledge (any gap or overlap). Shown live under the timing editor, with tick boxes and "Acknowledge all gaps / overlaps"; moving a boundary next to an acknowledged gap asks again (also enforced by the server).
- **Lifecycle:** `/admin/publish?recording=…` (Preview & publish): validation summary, a preview that plays each verse or all verses in order using the draft timing, and **Mark ready for review / Back to draft / Publish**. Publishing is one transaction (draft → published, old published sheet archived, status and link together) and re-checks everything on the server. A published recording's new draft version is published the same way ("Publish new version"); until then listeners keep the old timing and audio. Any timing change sends a Ready recording back to Draft.
- `POST /api/admin/recordings/[id]/status` (admin only; 422 with the validation result when invalid). Buttons now look disabled (dimmed) everywhere.
- Tests: validation rules (unit, 16), publisher and acknowledgement rules (database, 66 total), browser tests of the whole flow (blank → errors, gaps/overlaps and acknowledging, server refusal, Ready → Draft → Ready → Publish with listeners then receiving the recording from `/api/playback`, preview, new draft version replacing the live timing, access).
- Open: no **unpublish** yet (ask if wanted). The browser suite has two timing-sensitive tests that sometimes fail only when the whole suite runs in parallel (`steps` single-verse glide; occasional `streamed()` timeouts on admin pages); each passes on its own, repeatedly.
- Next: **M17 Listener music selection**.

## 2026-10-21 — M17 Listener music selection (branch `m17-music-selection`, off `m16-validation-publish`)
- The player's genre menu now has a **Version** section ("Default", "Default 2", …) when the chosen genre has more than one version for the passage, with a note when a version covers only part of it. A choice plays that version's recordings for the verses they cover and the earliest version for the rest (never another genre). The Steps panel shows the genre and, when there is a choice, the version ("Pop · Default 2"); with no music it says "No recording yet" and Play and the genre menu stay off, while reading works as before.
- **Bug fixed:** switching genre while playing used to stop the music (a "new passage" reset ran after the switch). A switch by the listener now keeps the verse and keeps playing.
- Playback has always come only from published recordings with published timing (`/api/playback`); drafts and unpublished new versions never reach listeners (covered end to end in M16's tests).
- Tests: arrangement rules (unit), browser tests of the menu (versions only when there is more than one, coverage notes, choosing, genre switch keeps the verse, no autoplay, switching while playing, the Steps panel, a passage with no music). Specs that create recordings through the app now sign in as a second e2e admin so other specs' cleanup can't delete their rows.
- Open: the version choice is per passage and session; it is not remembered (say if it should be).
- Next: **Phase 4 testing and polish** (see IMPLEMENTATION_PLAN.md), then the owner's review. Nothing is deployed.
