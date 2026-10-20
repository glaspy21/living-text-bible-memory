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
Book          id, osis, name, testament, chapterCount, sortOrder
Passage ref   (not a table) = bookId + chapter + verseStart + verseEnd (+ optional endChapter for cross-chapter)

Genre         id, slug, name (Title Case), isCustom, createdAt
Recording     id, translationId, bookId, chapter, verseStart, endChapter, verseEnd,   -- endChapter always set (= chapter when single-chapter)
              genreId, title (default "Default"), arrangementNo (auto, per passage+genre; label "Default", "Default 2", ...),
              description?, status (DRAFT|READY|PUBLISHED),
              originalAssetId, publishedTimingId?, createdAt, updatedAt, createdBy
AudioAsset    id, storageKey, mime, bytes, durationMs, sha256, peaksKey?, derivativeKey?, uploadedAt   -- original is immutable
TimingSet     id, recordingId, version, state (DRAFT|PUBLISHED|ARCHIVED), createdAt, createdBy, basedOnId?
VerseTiming   id, timingSetId, chapter, verse, startMs?, endMs?, ackGap bool, ackOverlap bool, note?
EditSession   id, recordingId, timingSetId, savedAt, snapshot(JSON)       -- "return to previous sessions"
User          id, email, name, role (ADMIN|LISTENER), createdAt
MemProgress   (post-MVP) userId, passage ref, step, lastStudiedAt
```
Rules: unique (recording, timingSet.version); **no uniqueness on passage+genre** (multiple recordings allowed); original `AudioAsset` is never mutated — replacing audio creates a new asset and a new TimingSet draft seeded from the old one. Times stored as integer **milliseconds**.

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

## 6. Audio pipeline
1. Admin requests a **presigned upload URL** (server verifies admin) → browser uploads direct to R2 (no secrets client-side, no function-size limit).
2. Server job: probe duration, compute sha256, generate **waveform peaks JSON** (e.g. `audiowaveform` or ffmpeg) → stored beside asset; editor loads peaks, not the whole decoded file.
3. WAV: keep original; produce MP3/AAC derivative for streaming. **Risk:** Vercel functions can't run ffmpeg reliably → run transcoding in a small worker (container/queue) or restrict MVP uploads to MP3. [Decision needed]
Do not split chapter audio into per-verse files.

## 7. Scripture provider abstraction
`ScriptureProvider { getChapter(translation, book, chapter): Promise<Verse[]>; getPassage(ref): Promise<Verse[]> }`.
- **WEB** (public domain) adapter first; **ESV** adapter via Crossway API (`api.esv.org`), key in `ESV_API_KEY` (server env only), server-side calls only.
- Cache per Crossway's current terms (see `PROJECT.md` §7; re-verify before building the cache). Initial scope is **John 1–2 only**: add a server-side allowlist of permitted ESV ranges (config) so the adapter refuses anything outside it. Render the required copyright notice with ESV text. Respect query/length limits. Never bundle ESV text in the repo or ship it to the client beyond what is displayed.
- Reader/Steps/Flashcards consume the interface only, so translation is swappable.

## 8. Security
- Admin guard enforced **server-side** in middleware **and** inside every admin route handler/server action (never UI-only). Allowlist from env.
- No secrets in client bundles; storage credentials server-only; presigned URLs short-lived; validate MIME + size + magic bytes on upload; Zod on all inputs; CSRF via Auth.js defaults; rate-limit upload and auth endpoints.
- `.env*` never committed; `.env.example` documents variables.

## 9. Environment variables (`.env.example`)
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `STORAGE_DRIVER` (`local|r2`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE?`, `ESV_API_KEY`, `NEXT_PUBLIC_APP_URL`.

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
