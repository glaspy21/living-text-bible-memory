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
