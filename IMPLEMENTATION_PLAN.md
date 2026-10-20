# Implementation Plan

Each milestone = one or more feature commits pushed to GitHub (never straight to a deploy). Update `PROGRESS.md` at the end of every milestone. Port visuals from `prototype/index.html`; match `docs/reference/prototype-*` screenshots.

## Phase 1 — Design (DONE)
Interactive desktop + mobile prototype of all listener and admin screens; docs recovered/created.

## Gate 0 — owner approval needed before Phase 2
Approve stack & hosting ([R] items in `ARCHITECTURE.md`); confirm end-mode defaults and the proposed cross-chapter playback rules (`ARCHITECTURE.md` §5). Cross-chapter ranges and the "Default / Default 2" arrangement labels are already confirmed; start ESV key application; choose photography path; supply production logo when available.

## Phase 2 — Foundation
- **M1 Scaffold**: Next.js+TS+Tailwind, ESLint/Prettier, Vitest, Playwright, CI (lint, type-check, unit), `.env.example`, docker-compose Postgres.
- **M2 Design tokens & primitives**: tokens from `DESIGN_SYSTEM.md`, EB Garamond via `next/font`, Sun layer, Button/Bar with hover wipe, Icon set (incl. 3 end-mode SVGs, stacked-cards, custom help), `prefers-reduced-motion`.
- **M3 App shell**: desktop grid (sidebar/main/right/player), mobile layout, header, routing skeleton for all listener + admin routes.
- **M4 Database**: Prisma schema per `ARCHITECTURE.md`, migrations, seed (books/chapters, translations, genres).
- **M5 Auth**: Auth.js Google, allowlist guard in middleware + handlers, tests for non-admin rejection.
- **M6 Storage abstraction**: interface, local + R2 adapters, presigned upload route (admin only).
Acceptance: app boots, shell matches prototype, admin routes locked to allowlist, DB migrates and seeds.

## Phase 3 — Functional MVP
- **M7 Scripture provider**: interface, WEB adapter, cache; ESV adapter behind flag once key exists; attribution component.
- **M8 Reader + selector**: chapter text, hanging verse numbers, verse tap-to-select, continuous OT/NT selector with scroll-linked tab underline, Prev/Next chapter, translation switch, Recently Studied (local storage) with scroll reveal on Home.
- **M9 Verse-range selector** (reusable): start/end, editable endpoints, no limit; **cross-chapter ranges supported** (confirmed).
- **M10 Audio engine**: segment resolver for cross-chapter/multi-recording ranges (with preload of the next recording), playback state machine + rAF boundary detection, three end modes, player UI + menus, genre menu; unit tests for every transition.
- **M11 Memorization Steps**: Listen/Sing/Recall/Chain, single↔multi focus with staggered fade, reveal, help, passage/mode/genre panel, Switch to Flashcards.
- **M12 Flashcards**: front/back flip, advance/back, shuffle, Switch to Steps, audio only on Play.
- **M13 Admin: upload**: wizard shell, direct-to-storage upload, metadata form (genre incl. Custom → Title Case input), duration probe, peaks generation.
- **M14 Admin: library & dashboard**: list/filter by status, multiple recordings per passage, replace audio (new asset + seeded timing draft).
- **M15 Admin: timing editor**: WaveSurfer waveform, ruler, zoom, scrub, draggable handles, numeric entry, per-verse preview, autosave + session history.
- **M16 Validation & publish**: pure validation module + UI flags/acknowledge, Draft→Ready→Published, versioned timing sets, atomic publish.
- **M17 Listener music selection**: genre + recording chooser, graceful no-recording state, playback from published timings.
Acceptance: end-to-end flow upload → publish → listener plays verse-accurate audio.

## Phase 4 — Integration & testing
Verse seeking accuracy; three end modes; step transitions; flashcard behavior; arbitrary passage selection; chapter-length upload; timestamp persistence; multiple versions; draft→publish lifecycle; admin authorization; desktop/mobile responsive checks; accessibility pass; visual comparison to reference screenshots; performance (peaks, large files). Fix, then request owner review. **Deployment only on explicit owner approval.**

## Post-MVP
Listener accounts + memorization progress; calendar-based memorization planning; additional translations; analytics.

## Working agreement
Small commits, conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), tests with each feature, docs updated in the same commit when behavior changes.
