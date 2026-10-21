# Living Text — Architecture

Status: **proposed, not yet approved.** Items marked [R] are recommendations; confirm at Phase 2 kickoff. Record each accepted decision in `docs/DECISIONS.md`.

## 1. Stack [R]
- **Next.js (App Router) + TypeScript + React**, Tailwind CSS with design tokens from `DESIGN_SYSTEM.md`.
- **PostgreSQL + Prisma.** Dev: local Postgres (docker compose). Prod: Neon (or any Postgres).
- **Auth.js (NextAuth)** with Google sign-in; admin = email in server-side allowlist (`ADMIN_EMAILS`, initially `glaspy21@gmail.com`). Listener accounts are post-MVP; listener app works anonymously, progress stored locally until accounts exist.
- **Object storage** behind an interface; Cloudflare R2 (S3 API) in prod, local disk/MinIO in dev.
- **WaveSurfer.js** for waveform/regions (evaluate Regions plugin + custom numeric panel in a spike before committing; fall back to canvas peaks + own handles).
- **Motion** for component animation. **Vitest** (unit), **Playwright** (e2e), ESLint/Prettier, Zod for validation.
- Hosting: Vercel (app), Neon (DB), R2 (audio). **Nothing is deployed without owner approval.**

## 2. Repo layout (approved structure)
Frontend, backend and shared code live in separate folders. ESLint blocks imports across the boundary (client ↔ server; shared imports neither).
```
/assets/brand         owner-supplied logo SVGs and brand board
/prototype            approved HTML design (reference; do not ship)
/docs                 decisions, reference images, motion clips
/prisma               schema.prisma, migrations, seed
/tests                e2e (Playwright) and cross-cutting tests
/src
  /app                routing only: (listener)/, admin/, api/ (route handlers)
  /client             FRONTEND: components/{ui,listener,admin}, hooks
  /server             BACKEND: db, auth, storage, scripture, services (server-only)
  /shared             pure logic + types used by both: timing, audio, scripture, schemas, text
```
Unit tests sit beside the code they test. Each of `src/app`, `src/client`, `src/server`, `src/shared` has a README stating its rules.

## 3. Data model (Prisma sketch)
```
Translation   id, code (ESV|WEB), name, licenseNote, providerKey
Book          id (= canonical order 1–66), osis, slug, name, testament, chapterCount   -- verse counts come from the scripture provider (M7)
Passage ref   (not a table) = bookId + chapter + verseStart + verseEnd (+ optional endChapter for cross-chapter)

Genre         id, slug, name (Title Case), isCustom, createdAt
Recording     id, translationId, bookId, chapter, verseStart, endChapter, verseEnd,   -- endChapter always set (= chapter when single-chapter)
              genreId, title (default "Default"), arrangementNo (auto, per passage+genre; label "Default", "Default 2", ...),
              description?, status (DRAFT|READY|PUBLISHED),
              originalAssetId, publishedTimingId?, createdAt, updatedAt, createdBy
AudioAsset    id, storageKey, mime, bytes, durationMs, sha256, peaksKey?, derivativeKey?, uploadedAt   -- original is immutable
TimingSet     id, recordingId, version, state (DRAFT|PUBLISHED|ARCHIVED), createdAt, createdBy, basedOnId?, audioAssetId?   -- audio this timing was made for (null = recording's original asset)
VerseTiming   id, timingSetId, chapter, verse, startMs?, endMs?, ackGap bool, ackOverlap bool, note?
EditSession   id, recordingId, timingSetId, savedAt, snapshot(JSON)       -- "return to previous sessions"
User          id, email, name, role (ADMIN|LISTENER), createdAt
MemProgress   (post-MVP) userId, passage ref, step, lastStudiedAt
```
Rules: unique (recording, timingSet.version); **no uniqueness on passage+genre** (multiple recordings allowed); original `AudioAsset` is never mutated — replacing audio creates a new asset and a new TimingSet draft seeded from the old one (old sheets are pinned to their own audio via `audioAssetId`; a published recording keeps serving its published timing's audio until the new draft is published). Times stored as integer **milliseconds**. Schema lives in `prisma/schema.prisma`; the generated client is in `src/server/db/generated` (git-ignored, rebuilt on `npm install`).

`title` and arrangement label are not shown in the admin form yet; they exist for future custom/user-uploaded tracks. Arrangement number is assigned server-side in a transaction (max+1 per translation+passage+genre) so concurrent uploads can't collide.

Genre options in UI: Pop, Rock, R&B, Custom. Custom creates a `Genre` row (`isCustom=true`) with Title Case enforced server-side too.

## 4. Admin workflow & states
Upload → Metadata → Verse timing → Validation → Preview → Publish.
- Recording `DRAFT` → `READY` (validation passes with all warnings acknowledged) → `PUBLISHED`.
- Publishing promotes a TimingSet to `PUBLISHED` and sets `Recording.publishedTimingId` in one transaction. Editing a published recording creates a new DRAFT TimingSet; listeners keep reading `publishedTimingId` until the new one is published. Previous set is `ARCHIVED` (retained for rollback).

### Timing validation (pure functions in `/src/lib/timing`, 100% unit-tested)
Errors (block READY): missing start or end for a verse in range; `end <= start`; `start < 0` or `end > durationMs`; verse outside recording range.
Warnings (require acknowledge, never auto-fixed): gap between consecutive verses > tolerance (default 250 ms); overlap of any amount; incomplete coverage. Acknowledgements are stored per verse pair and invalidated if either boundary changes.

## 5. Playback engine (listener) [R]
- Single `<audio>` element per player, source = published recording asset (derivative if present). Seek by `currentTime = startMs/1000`.
- **Verse boundary detection**: `requestAnimationFrame` loop comparing `currentTime` to `endMs` with a lookahead of one frame (~16 ms) — `timeupdate` (~250 ms) is too coarse. If testing shows audible overshoot/loop gaps, move verse playback to Web Audio API (`AudioBufferSourceNode` with `loopStart/loopEnd`) for sample-accurate looping.
- **State machine** (`xstate` or hand-rolled reducer) with states `idle | loading | playing | paused | verseEnded`; events `PLAY, PAUSE, SEEK_VERSE(n), SKIP(±1), TICK(t), ENDED`; end-mode policy:
  - `loop` → seek to current verse start and continue.
  - `stop` → pause at verse end (never auto-advance), state `paused`.
  - `next` → seek to next verse start (if last verse: stop).
- Gaps: seeking always goes to the next verse's **start**, so gaps are skipped; overlaps are honored (a verse may begin before the previous ends).
- Range requests (HTTP 206) required for seeking: R2 supports it; local dev server must too.
- Audio only starts on explicit Play (never on flip/next/shuffle).
- Passages without recordings: UI shows "No recording yet"; Steps still work silently.

### Cross-chapter ranges (confirmed) — proposed playback rules [R, confirm]
- Verse refs are (chapter, verse) pairs ordered canonically; a selection is any contiguous run, possibly across chapters.
- The player resolves, per verse, which published recording covers it for the chosen genre (preferring the selected arrangement), producing an ordered **segment list**: `[{recordingId, chapter, verse, startMs, endMs}]`. Consecutive verses from the same recording stay on one `<audio>` source; crossing to another recording swaps the source and preloads the next one a few seconds early to avoid a gap.
- End modes work on segments: Next Verse at a recording boundary loads the next recording and continues; Loop/Stop behave per verse as before; the final verse of the selection always stops.
- If a verse in the range has no recording for the chosen genre: Next Verse skips silently to the next covered verse; the UI marks uncovered verses (no music) and offers the genres that cover the whole range, falling back to partial coverage with a visible note. Never silently substitute another genre.
- Memorization steps and flashcards work for the full range regardless of audio coverage.

**As built (M10):**
- *Logic (pure, in `src/shared/audio`):* `playlist.ts` resolves a passage's verses against published recordings into one segment per verse (chosen or earliest arrangement; uncovered verses stay uncovered, never filled from another genre) and reports genre coverage. `player-machine.ts` is the state machine, `(state, event, segments) → (state, effects)`, with ~45 tests.
- *Data:* `GET /api/playback?p=<passage>` returns the passage's verses and every published recording (with published timing) that touches it. Choosing a genre needs no new request.
- *Browser (`src/client/player`):* `PlayerProvider` sits in the listener layout so audio survives page changes. It owns one `<audio>` element, runs the machine, detects verse ends every animation frame (plus a 100 ms timer for hidden tabs), and preloads the next recording 5 s early. Pages declare their passage with `<PlayerPassage passage context>`; `context` picks the default end mode (reader = Next Verse, practice = Loop Verse) and the user's choice is remembered per context.
- *UI:* the player bar shows progress and time within the current verse, an end-mode menu (exactly Loop / Stop / Next, active one checked and its icon on the button), skip, play/pause and a genre menu that notes partial coverage. Without music it says "No recording yet" and the controls are off. In the reader the verse being sung is highlighted.
- *Known limit:* in a background tab, browsers slow timers, so verse ends can be caught up to about a second late. If that matters on phones, move verse playback to the Web Audio API (risk 2 above).

## 6. Audio pipeline
1. Admin requests a **presigned upload URL** (server verifies admin) → browser uploads direct to R2 (no secrets client-side, no function-size limit).
2. Server job: probe duration, compute sha256, generate **waveform peaks JSON** (e.g. `audiowaveform` or ffmpeg) → stored beside asset; editor loads peaks, not the whole decoded file.
3. WAV: keep original; produce MP3/AAC derivative for streaming. **Risk:** Vercel functions can't run ffmpeg reliably → run transcoding in a small worker (container/queue) or restrict MVP uploads to MP3. [Decision needed]
Do not split chapter audio into per-verse files.

**As built (M6):** `src/server/storage` has one `StorageDriver` interface with two drivers, chosen by `STORAGE_DRIVER`.
- *Upload:* `POST /api/admin/uploads {mime, bytes}` → checks type (MP3/WAV) and size (≤ 300 MB) and returns a one-file target (`key` is generated, never from the file name: `recordings/<uuid>/original.<ext>`). The browser PUTs the file to the target. `POST /api/admin/uploads/complete {key, bytes}` then confirms the file exists, matches the declared size and really is MP3/WAV by its first bytes; anything else is deleted. Originals are create-only, never overwritten. All three upload routes are admin-only (401 signed out, 403 otherwise).
- *Local driver:* files in `.local-storage/` (git-ignored); the upload target is a signed, 15-minute link to `PUT /api/admin/uploads/local`.
- *R2 driver:* presigned 15-minute PUT (create-only via `If-None-Match: *`) straight to the bucket; playback redirects to a presigned 1-hour GET. **Bucket CORS must allow PUT/GET/HEAD from the app origin with headers `Content-Type` and `If-None-Match`.** Not yet exercised against a real bucket.
- *Playback:* `GET /api/audio/<assetId>` serves published recordings to anyone and drafts to admins only (404 otherwise). Local files stream with HTTP Range (206) so seeking works; R2 redirects to the signed URL.
- Still to do (M13): duration probe, sha256, waveform peaks, and creating the `AudioAsset`/`Recording` rows after upload.

## 7. Scripture provider abstraction
`ScriptureProvider { getChapter(translation, book, chapter): Promise<Verse[]>; getPassage(ref): Promise<Verse[]> }`.
- **WEB** (public domain) adapter first; **ESV** adapter via Crossway API (`api.esv.org`), key in `ESV_API_KEY` (server env only), server-side calls only.
- Cache per Crossway's current terms (see `PROJECT.md` §7; re-verify before building the cache). Initial scope is **John 1–2 only**: add a server-side allowlist of permitted ESV ranges (config) so the adapter refuses anything outside it. Render the required copyright notice with ESV text. Respect query/length limits. Never bundle ESV text in the repo or ship it to the client beyond what is displayed.
- Reader/Steps/Flashcards consume the interface only, so translation is swappable.

**As built (M7):** `src/server/scripture` holds the provider interface (`getChapter`, `getPassage`, `verseCount`) and two adapters. Pages ask `getProvider("WEB" | "ESV")` and never touch a source directly.
- *WEB:* reads per-book JSON in `web-data/` (31,098 verses, imported once with `npx tsx scripts/import-web.ts <folder of USFM>`). Verse numbers are real numbers, not positions: the WEB leaves out some verses (for example Acts 8:37).
- *ESV:* calls `api.esv.org` server-side with the key in a header. Asks for plain text with no headings, footnotes or references. Refuses anything outside the scope in `src/shared/scripture/esv-scope.ts` (John 1–2) before any request is made. Only available when `ESV_ENABLED=true` and a key exist (`availableTranslations()`). Cached in memory for an hour, never stored.
- *Passages* can cross chapters; both adapters build them from chapter reads.
- *Attribution:* `<Attribution translation="ESV" />` shows Crossway's notice (text in `src/shared/scripture/translations.ts`); render it wherever ESV text appears.

## 8. Security
- Admin guard enforced **server-side** in the proxy (`src/proxy.ts`, Next 16's name for middleware) **and** inside every admin layout, page, route handler and server action via `requireAdmin()` / `getAdminEmail()` (never UI-only). Allowlist from env. Sessions are signed, encrypted JWT cookies (no session tables); sign-in is limited to verified Google accounts on the allowlist, and a `User` row (role ADMIN) is upserted on each sign-in.
- No secrets in client bundles; storage credentials server-only; presigned URLs short-lived; validate MIME + size + magic bytes on upload; Zod on all inputs; CSRF via Auth.js defaults; rate-limit upload and auth endpoints.
- `.env*` never committed; `.env.example` documents variables.

## 9. Environment variables (`.env.example`)
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `STORAGE_DRIVER` (`local|r2`, default `local`), `LOCAL_STORAGE_DIR?` (default `.local-storage`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE?`, `ESV_API_KEY`, `ESV_ENABLED` (default off), `NEXT_PUBLIC_APP_URL`.

## 10. Testing strategy
- Unit: timing validation edge cases (missing, reversed, out-of-range, gaps, overlaps, acknowledgement invalidation, cross-chapter), playback state machine (all three end modes, last verse, skip while playing, seek during loop), verse-range selection logic, Title Case util.
- Integration: Prisma against a test DB (publish transaction atomicity, versioned edits).
- E2E (Playwright): upload → timing → validate → preview → publish; listener plays verse N and lands within tolerance of `startMs`; flashcard flip/shuffle never starts audio; admin routes reject non-allowlisted users; mobile + desktop viewports.
- Visual: screenshot comparison against `docs/reference/prototype-*` for key screens.

## 11. Key risks
1. ESV license/caching terms and approval time.
2. Sample-accurate verse looping in browsers (mitigation above).
3. Transcoding/peaks generation off-Vercel.
4. WaveSurfer ergonomics for precise handle editing + numeric entry (spike first).
5. Missing production logo and photography.
6. Cross-chapter playback (swapping recordings mid-range, mixed genre coverage) needs a spike in M10 before the player UI is finalized.
