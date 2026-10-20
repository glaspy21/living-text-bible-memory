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
