# Living Text — Project Brief

Scripture reading and Bible-memorization app. Two experiences: a **listener app** (read, memorize, flashcards, music) and a private **administrator workspace** (upload Scripture music, mark verse timing, publish).

Owner: glaspy21@gmail.com (sole admin). Claude acts as lead engineer, designer and architect. Status: **Phase 1 (desktop design prototype) complete; Phase 2 not started.** See `PROGRESS.md`.

Legend: **[C]** confirmed by the owner · **[A]** assumption, needs confirmation · **[R]** recommendation, not yet approved · **[?]** unrecovered / open.

## 1. Non-negotiables (owner rules)
- Do not invent recovered assets or requirements. Do not discard approved designs. Do not silently change established behavior.
- Do not publish or deploy without explicit owner approval.
- Four-step memorization method exactly: **Listen → Sing → Recall → Chain**.
- Exactly three playback-end modes (see §4). Stop After Verse is an outlined octagon, **never pause bars**.
- ESV text only through a licensed provider; never bundled/redistributed freely.
- No secrets or storage credentials in client code.
- Keep original uploaded audio separate from verse-timing metadata. Do not split chapter audio into files without a demonstrated need.
- Do not overwrite a recording because its Scripture reference matches another.
- Gaps/overlaps between verse timings may be intentional: flag, never auto-delete.
- Calendar-based memorization planning is post-MVP.
- Commit to GitHub after every reasonable feature.

## 2. Decisions
| # | Decision | Status |
|---|---|---|
| 1 | Greenfield: no prior code exists | [C] |
| 2 | Database: PostgreSQL (Prisma) | [C] |
| 3 | Admin access: single allowlist, `glaspy21@gmail.com` | [C] |
| 4 | Design first as an HTML prototype (`prototype/index.html`), then Next.js build | [C] |
| 5 | Translation target: ESV (licensed API); public-domain WEB as placeholder until key | [C] |
| 6 | Typeface: **EB Garamond** for all serif text and numerals (Cormorant rejected: its "1" read as "I"); Inter for UI sans | [C] |
| 7 | Repo: https://github.com/glaspy21/living-text-bible-memory | [C] |
| 8 | Stack: Next.js + TypeScript + Tailwind, Prisma/Postgres, WaveSurfer.js, Motion (Framer Motion) for component animation | [R] — approve at Phase 2 start |
| 9 | Hosting: Vercel + Neon Postgres + Cloudflare R2 (S3-compatible, no egress fees) | [R] |
| 10 | Playback-end defaults: Reader/Home = **Next Verse**; Steps/Flashcards = **Loop Verse** (from mockup captions) | [A] |
| 11 | Admin upload form shows **no track title or arrangement field** for now (overrides original brief §8 UI). The data model keeps both, defaulting to "Default"; they are reserved for future custom/user tracks | [C] 2026-10-20 |
| 12 | Genre options: Pop, Rock, R&B, **Custom**. Choosing Custom reveals a "Custom genre name" input, auto Title Case | [C] 2026-10-20 |
| 13 | Same passage + genre may have several recordings: automatic arrangement label by creation order — "Default", "Default 2", "Default 3"; title "Default". Listeners see genre first, and the label only when more than one exists | [C] 2026-10-20 |
| 14 | **Verse ranges may cross chapters.** A range can span several songs; the player chains the needed recordings in order | [C] 2026-10-20 |

## 3. Listener screens (desktop; mobile follows the mockups)
Home · Scripture Reader · Book/Chapter selector · Memorize choice · Memorization Steps · Flashcards · Verse-range selector.

- **Home**: hero (scenery + logo), Continue and Browse Scripture bars, long Recently Studied list. List rows **reveal progressively as they scroll up from the bottom edge** (opacity + 18px rise, scroll-linked, ~190px zone) — matches `docs/reference/motion/gradual-reveal.mp4`.
- **Bars** hover: gold fill wipes left→right, text flips dark (`docs/reference/motion/bar-fill-hover.mp4`). Applies to the primary full-width bars.
- **Reader**: the chapter, then the next one as you keep scrolling (within the book; the header, address and Recently Studied follow the chapter in view), hanging gold verse numbers, tapping a verse then a second one selects the memorize range (the whole range tinted, gold edge only on its first and last verse; ranges may cross chapters), Memorize button, right panel (selected passage, music availability, Edit range). Header reference opens the selector.
- **Book selector**: opens directly beneath the clicked control (no jump). **One continuous list, Old Testament then New Testament**; the Old/New tab underline follows scroll position and slides (~.17s); tab click smooth-scrolls to its section; opens at the current book's testament; chapter grid expands inline; scroll position survives expansion. **Choosing a chapter puts its number beside the book title and replaces the chapter numbers, in the same window, with that chapter's verse numbers; a verse opens the reader at that verse (`?v=`).** The header button always shows Scripture navigation (current chapter or passage), never a page name. A dot marks books with music.
- **Memorize choice**: Memorization Steps (list icon) or Flashcards (**stacked-cards icon**; the crossing-arrows icon is reserved for Shuffle).
- **Steps**: stepper with ◀ Listen Sing Recall Chain ▶; active step obvious (glowing gold dot). Top-left list button toggles **single ↔ multi-verse focus**: focused verse normal weight, others faded (~34%), **text size never changes**, others fade in/out in place with a staggered ripple from the focused verse (≈.45s per verse, 70ms stagger; leaving ≈.2s). Recall always shows one verse at a time (the toggle is disabled); Chain always shows the whole passage. Recall/Chain hide the text behind per-word dashes and share four buttons, **Reveal word / Reveal verse / Hide word / Hide verse**, that work through the whole passage in order (owner request 2026-10-21; replaced the single Reveal Scripture button). "Switch to Flashcards" button top right. Help icon (custom "?" glyph) toggles a one-line step explanation. Right panel: Passage, When the verse ends (mode), Genre.
- **Flashcards**: front = BOOK + chapter:verse + "Tap to reveal"; back = verse text; side arrows; Shuffle; "Switch to Steps". Audio plays only on Play, never on flip/next/shuffle.
- **Verse range**: book/chapter dropdown, verse grid, tap start then end; either endpoint editable afterwards; no length limit; cross-chapter selection **confirmed [C]**.
- Reduced motion: all animation/transition disabled.

## 4. Playback-end modes
| Mode | Icon | Behavior |
|---|---|---|
| Loop Verse | loop/repeat | replay current verse continuously |
| Stop After Verse | outlined octagon, no letter | stop when verse ends |
| Next Verse | single forward-curving arrow derived from loop | advance to next verse at end |

Player layout (matches mobile): progress + times; transport row = **end-mode icon (far left), skip back, ring play/pause, skip forward, genre note (far right)**. End-mode button shows the icon of the active mode; click opens a labeled menu with icons and a gold check on the active one. Genre note opens genre menu. Never confuse with play/pause.

## 5. Admin workspace
Dashboard · Upload music · Track library · Timing editor · Preview & publish. Workflow: **Upload → Metadata → Verse timing → Validation → Preview → Publish**; states Draft / Ready for Review / Published.
- Upload: MP3/WAV; chapter, passage or single-verse recordings; alternates allowed.
- Metadata: translation, book, chapter, from/to verse, genre (+custom), optional description, upload date, status.
- Timing editor: waveform, ruler, play/scrub, zoom, draggable start/end handles, **direct numeric entry**, per-verse preview, autosave, return to earlier sessions, later revisions.
- Validation: missing boundaries; end < start; outside duration; gaps/overlaps (acknowledgeable); incomplete coverage.
- Published timing edits create a **new draft version**; listeners keep the current published version until publish. Replacing audio must not silently lose timing or published content.
- Admin is desktop-only (mobile toggle falls back to desktop).

## 6. Mobile
Phone layout mirrors the owner's mockups (`docs/reference/mobile-mockups/`): header = LF mark · reference · ESV · ⋯, Home has gear over hero, 5-column verse grid, same player. Additions not in the mockups (owner-requested later): Switch to Flashcards/Steps buttons, help icon.

## 7. ESV licensing (summary of Crossway's published policy, fetched 2026-10-20 from crossway.org/permissions — not legal advice; re-verify before launch)
- Without written permission: up to **500 verses**, not more than **one-half of any single book**, and under **25% of the total work**; not in a commentary/reference work. Digital works (apps) need the **copyright notice**.
- **ESV API (api.esv.org)**: register for a key; free for **non-commercial** display on a site/app. Commercial use or anything beyond these guidelines needs written permission/license via crossway.org/permissions/digital/.
- Notice text: "The ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. ESV Text Edition: 2025. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated in whole or in part into any other language. Used by permission. All rights reserved." "ESV" / "English Standard Version" are registered trademarks (use needs permission).
- **Owner scope (2026-10-20): initially only the first couple of chapters of John** (~76 verses, far under the limits) — fits the standard-use rules while non-commercial/unreleased.
- **Open question — music:** Scripture songs set the ESV text to audio. Crossway lists audio and music as separate permission categories (audio products carry the full notice and verbal credit to the "ESV"). Ask Crossway whether the recordings need their own permission before publishing any ESV-based track. Until answered: develop with WEB text/placeholders, publish nothing publicly.
- Scope guard: keep ESV text limited to the allowed range in the dev/early build; do not bulk-import or cache beyond Crossway's terms; display the notice in-app (About/footer and wherever ESV text appears).

## Secrets handling (ESV key etc.)
Owner holds the ESV API key and does **not** paste it into chat. It lives only in `.env.local` on the owner's machine (git-ignored; Claude Code is configured not to read it) and, at deploy time and only with owner approval, in the host's encrypted environment variables. Code reads `process.env.ESV_API_KEY` server-side; Claude never needs the value. Verify with a script that prints only the HTTP status. If a key is ever pasted into chat, a commit or a log, rotate it.

## 8. Open items / unrecovered
- [?] ESV API key and Crossway terms (caching, attribution, display rules). Apply early.
- [~] Logo: owner supplied four SVGs (`assets/brand/svg/`), flat single-color redraws of the board; usable as production vectors pending owner confirmation that they are final. Earlier PNG renders in `prototype/assets/reference/` remain reference only.
- [?] Photography for hero/thumbnails: prototype draws scenery in SVG. Owner to choose: originals / cropped placeholders / commissioned licensed art.
- [?] Original PROJECT/DESIGN_SYSTEM/ASSET_INVENTORY recovery drafts from Drive were partial; Drive FlashCard pages had no readable text; "Memorization Page" HTML not inspected.
- [A] Flashcard flip gesture; end-mode defaults (see table).
- [?] Cross-chapter playback rules for mixed coverage (verses without music, different genres per chapter): proposed in `ARCHITECTURE.md` §5; owner to confirm.
- [?] Bug report "verses aren't appearing" on single→multi toggle: never reproduced. If seen again, capture step + browser.
- [?] Audio transcoding plan (WAV → streaming MP3/AAC) — see `ARCHITECTURE.md` risks.
- Post-MVP: memorization progress tracking, calendar planning, public sign-up/auth for listeners.
