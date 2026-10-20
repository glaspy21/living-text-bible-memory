# Decision log
Newest last. Status: [C] confirmed by owner · [R] recommended, pending approval.

| Date | Decision | Status |
|---|---|---|
| 2026-10-19 | Greenfield; HTML prototype before Next.js build; repo `glaspy21/living-text-bible-memory` | [C] |
| 2026-10-19 | PostgreSQL; single-admin allowlist `glaspy21@gmail.com`; ESV is the target translation | [C] |
| 2026-10-20 | EB Garamond for all serif text (Cormorant's "1" read as "I") | [C] |
| 2026-10-20 | Playback-end defaults: Reader = Next Verse; Steps/Flashcards = Loop Verse (from mockup captions) | assumption — confirm |
| 2026-10-20 | Single/multi verse toggle changes opacity only, never text size; staggered ripple | [C] |
| 2026-10-20 | Flashcards icon = stacked cards; crossing arrows only for Shuffle | [C] |
| 2026-10-20 | Admin upload: no track title / version fields; genre Custom reveals a Title-Case name input | [C] |
| 2026-10-20 | Book selector: one continuous OT→NT list, tab underline follows scroll | [C] |
| 2026-10-20 | Mobile layout mirrors owner mockups; admin desktop-only | [C] |
| 2026-10-20 | Stack/hosting: Next.js+TS+Tailwind, Prisma/Postgres, WaveSurfer, Motion; Vercel+Neon+R2 | [R] |
| 2026-10-20 | Verse boundary detection via rAF (Web Audio loop if needed); presigned direct uploads; peaks JSON | [R] |
| 2026-10-20 | Verse ranges may cross chapters; ranges can span multiple songs (player chains recordings) | [C] |
| 2026-10-20 | Title/arrangement hidden in upload UI; stored as title "Default" + auto arrangement "Default", "Default 2", "Default 3" per passage+genre; reserved for future custom tracks | [C] |
| 2026-10-20 | Initial ESV scope: John 1–2 only; ask Crossway about music/audio permission before publishing ESV-based tracks | [C] scope / open question |
| 2026-10-20 | Stack and hosting approved by owner (Next.js, Prisma/Postgres, Motion; Vercel + Neon + R2; nothing deployed without approval) | [C] |
| 2026-10-20 | Folder structure: `src/client` (frontend), `src/server` (backend), `src/shared` (pure logic), `src/app` (routing only); boundaries enforced by lint | [C] |
| 2026-10-20 | Gold palette taken from the owner's mockup colors: bright `#edbf64`, main `#d0a34f`, shade `#ae8640`, dim `#8e6c34` (midpoints of the supplied ranges). `--gold2` `#e8cb8a` kept for headings pending owner answer | [C] ranges / midpoints are mine |
| 2026-10-20 | Headings use the main gold via a `--heading` token (trial; owner: "try the main gold, then we can work from there"). Easy to revert in one place | [C] trial |
| 2026-10-20 | Routes: listener `/`, `/read/[book]/[chapter]` (`/read` → John 1 until M8), `/memorize` (choice), `/memorize/steps`, `/memorize/flashcards`, `/memorize/range`; admin `/admin`, `/admin/upload`, `/admin/library`, `/admin/timing`, `/admin/publish`. Book selector is a popover, not a route | [R] |
| 2026-10-20 | App shell: layouts own header, sidebar, sun and player (stay mounted so audio and animation never restart); each page declares its layout by rendering `<Main player>` / `<RightPanel>`, and the grid adapts with CSS `:has()`. Keeps pages prerenderable | [R] |
| 2026-10-20 | Admin gate `requireAdmin()` (server) called in the admin layout and every admin page; until sign-in (M5) it returns 404 in any production build | [R] |
| 2026-10-20 | Tablet (≤1100px) header uses `auto 1fr auto` columns; the prototype's `1fr auto` wraps the reference button onto a new line | [R] small fix |
| 2026-10-20 | Prisma 7.10.1 (stable; npm's `latest` tag is an 8.0 release candidate) with the `pg` driver adapter; generated client in `src/server/db/generated` | [R] |
| 2026-10-20 | No Chapter table: Book stores `chapterCount`; per-chapter verse counts come from the scripture provider (they differ slightly between translations) | [R] |
| 2026-10-20 | Database tests run against a separate `livingtext_test` database and refuse any database not ending in `_test`; CI runs them against a Postgres service | [R] |
