# Living Text — Design System

Source of truth for visuals is the owner's mobile mockups (`docs/reference/mobile-mockups/`) plus the approved desktop prototype (`prototype/index.html`, screenshots in `docs/reference/prototype-desktop/`). Tokens below are copied from the prototype; port them 1:1 to Tailwind theme / CSS variables.

Character: deep black, metallic gold, sunlight from the **upper-right**, serif Scripture, thin gold borders, restrained motion. Desktop is **not** an enlarged phone: sidebar + central workspace + contextual right panel.

## Color tokens
| Token | Value | Use |
|---|---|---|
| `--bg` | `#070707` | app background |
| `--panel` | `#121212` | panels/cards base |
| `--line` | `rgba(201,164,92,.28)` | thin gold borders, dividers |
| `--line2` | `rgba(201,164,92,.55)` | emphasized borders |
| `--gold-bright` | `#edbf64` | selected verse buttons, play triangle, glowing step dot (owner range `#ecba5b`–`#eec56d`) |
| `--gold` | `#d0a34f` | primary accent, icons, borders, verse numbers (owner range `#cfa854`–`#d19e4a`; was `#d4a84f`) |
| `--gold-shade` | `#ae8640` | gradient shadows (owner range `#ae803a`–`#af8c46`) |
| `--gold2` | `#e8cb8a` | headings, highlights |
| `--gold-dim` | `#8e6c34` | inactive dots, subdued labels, thin lines, glow edges (owner range `#8e6830`–`#8f6f38`; was `#8f7440`) |
| `--text` | `#ece6d8` | body/Scripture |
| `--muted` | `#948c7a` | secondary text |
| `--ok` `#8bb27a` · `--warn` `#d9a441` · `--err` `#d86a5a` | validation / status |

Sunlight layer (`.sun`): conic rays + two radial glows anchored at `100% -6%`, slow opacity pulse (9s). Persistent node: **do not re-create on route/render changes** or the animation restarts.

## Typography
- Serif (Scripture, headings, numerals, buttons): **EB Garamond** 400/500/600. Self-host via `next/font` in production (Google Fonts is only used by the prototype).
- UI sans (admin tables, labels): Inter 400/500/600. Base size 14px.
- Scripture 22px/1.6 desktop, 17.5px/1.5 mobile. Verse numbers gold, hanging, 21px (17px mobile). H1 34px (24 mobile), H2 22px (19 mobile). Small caps labels: 10.5–11px, letter-spacing .12–.16em, uppercase, `--gold-dim`.
- Flashcard reference numeral 82px (60 mobile), book label letter-spacing .3em.

## Layout
- Desktop grid `#app`: columns **240 / 1fr / 300**, rows **56 header / 1fr / 124 player**. Variants: `noright`, `noplayer`, `admin` (230 / 1fr, no player). Max width 1440.
- Header: brand (LT mark + LIVING TEXT, letter-spacing .22em) · reference button (opens selector) · ESV + `•••`.
- Mobile (≤520px or prototype Mobile toggle): single column, header 54px = mark · reference · ESV ⋯, player 128px, sidebar/right panel hidden, Home header transparent with gear over hero, verse grid 5 columns scrolling in a 236px area.
- Breakpoint ≤1100px: sidebar and right panel collapse.

## Components
- **Bar / `.opt` / `.btn`**: 1px `--gold` border, radius 9–12px, translucent dark fill. **Hover wipe**: cloned content layer clipped `inset(0 100% 0 0)` → `inset(0)` over **.5s `cubic-bezier(.22,.7,.2,1)`**, gold gradient `#e2c37e→#cfa44f`, text/icons flip to `#16110a`.
- **Player**: bar 4px with glowing thumb; times 12px; transport = end-mode ico, skip back, ring play (60px, 1.5px gold ring, filled gold glyph), skip fwd, genre ico. Menus open upward, `pop` .16s.
- **End-mode icons** (custom SVG, 1.5px stroke, round caps): loop (two arrows), stop (unlettered octagon outline), next (single forward-curving arrow). Keep identical across desktop/mobile.
- **Stepper**: panel `rgba(22,19,13,.85)`, 1px `--line`, radius 14; dots 22px, active = radial gold gradient + glow; triangle arrows ◀▶ gold; labels EB Garamond 17px.
- **Verse row** `.v`: grid 46px/1fr (34/1fr mobile). States: `sel` (range highlight, inset 2px gold bar), `cur` (gold border + glow), `fade` (opacity .34, hover .6), `gone` (opacity 0, pointer-events none). Fade state toggles **in place** (no re-render, no size change).
- **Recall/Chain placeholders**: dashed lines, brightened so they stay visible against black.
- **Flashcard**: 330px tall (230 mobile), 1.5px gold border, radius 16, 3D flip `rotateY` .6s `cubic-bezier(.2,.7,.2,1)`; slide-in `cardin` .4s on advance.
- **Verse grid**: 48px buttons, `range` = translucent gold, `end` = solid gold gradient with dark text.
- **Book selector panel**: anchored under trigger (explicit left/top/width, **no CSS transform centering**), tabs with sliding 2px underline (.17s `cubic-bezier(.4,0,.2,1)`), single scrolling OT+NT list, chapter grid `repeat(auto-fill,minmax(46px,1fr))`.
- **Thumbnails**: 40px, 5px radius, gold-tinted; scenery drawn in SVG (`scene()` in prototype) until real art is approved.
- **Admin**: tables with uppercase gold-dim headers, status pills (draft/review/published), wizard stepper (6 steps), waveform panel, timing rows (`#`, start, end, preview, flags).
- **Icons**: list, cards (stacked), shuffle (crossing arrows, Shuffle only), note, book, eye, loop/stop/next, custom help "?" glyph (replaces the previous icon-font question mark), triangles.

## Motion
| Effect | Spec |
|---|---|
| Page/main enter | `rise` .45s, translateY 10px→0 |
| Single↔multi verses | opacity only; ease-in .45s + 70ms × distance from focused verse; leave .2s + 25ms stagger (farthest first); else .25s |
| Recently Studied reveal | scroll-linked, opacity 0→1 + translateY 18px→0 over 190px from the scroller's bottom edge; rAF-throttled |
| Bar hover wipe | .5s as above |
| Testament tab underline | .17s slide; follows scroll |
| Selector open | `pop` .2s once (not on re-render) |
| Ambient | rays sway 11s, mist drift 20s, sun pulse 9s |
| Reduced motion | `prefers-reduced-motion`: disable all animation/transition |
Library choice: CSS for ambient/hover; **Motion (Framer Motion)** for React component transitions (stagger, presence). GSAP only if a hero timeline is needed.

## Accessibility
Visible focus ring (gold), keyboard-operable flashcards and selector, `aria-pressed` on the single/multi toggle, labelled icon buttons, contrast of `--muted` on `--bg` checked ≥4.5:1 for body-size text, reduced-motion honored. Faded verses (opacity .34) are decorative state, not the only indicator of focus.
