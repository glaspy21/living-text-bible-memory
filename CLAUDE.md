# CLAUDE.md — Living Text

Scripture reading + Bible-memorization app (listener app + private admin music workspace). You are lead engineer/designer/architect; the owner (glaspy21@gmail.com) is the lead.

## Read first, every session
`PROGRESS.md` (where we are) → `PROJECT.md` (decisions, legend [C]/[A]/[R]/[?]) → `IMPLEMENTATION_PLAN.md` (next milestone) → `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `ASSET_INVENTORY.md` as needed. Run `/resume` to do this.

## Hard rules (owner's, never break)
1. **No deploy/publish** (Vercel, npm publish, DNS, public buckets, production DB) without explicit owner approval in this session.
2. Do not invent assets or requirements; do not discard approved designs; do not silently change established behavior. If something differs from `PROJECT.md`, ask or record a decision first.
3. Four steps exactly: Listen, Sing, Recall, Chain. Exactly three end modes: Loop Verse (loop icon), Stop After Verse (unlettered outlined octagon, **never pause bars**), Next Verse (single forward-curving arrow). The end-mode button shows the active mode's icon; never confuse it with play/pause.
4. ESV text only via the licensed API, server-side; never commit ESV text; show the copyright notice; initial ESV scope = John 1–2 (see `PROJECT.md` §7). Use WEB placeholder otherwise. Don't claim Crossway permission exists until the owner confirms it.
5. **No secrets in client code or git.** Never read, print or commit `.env*`/credentials. Update `.env.example` only.
6. Original audio is immutable and separate from timing metadata; don't split chapter audio into files; never overwrite a recording because the reference matches; gaps/overlaps are flagged, never auto-removed; published timing changes go through a new draft version.
7. Admin authorization is enforced **server-side** on every admin route/action (allowlist `ADMIN_EMAILS`), never UI-only.
8. Calendar planning and listener accounts are post-MVP — don't start them.

## Design rules
Match the prototype (`prototype/index.html`) and `docs/reference/prototype-*` screenshots; the owner's mobile mockups are the baseline (`docs/reference/mobile-mockups/`). Black + metallic gold, sunlight upper-right, **EB Garamond** for Scripture/headings/numerals, thin gold borders. Desktop is not an enlarged phone. Respect the motion specs in `DESIGN_SYSTEM.md` (verse fade changes opacity only — never text size; hover wipe; scroll reveal; sliding tab underline) and `prefers-reduced-motion`. Stacked-cards icon = Flashcards; crossing arrows = Shuffle only. Logo files in repo are reference renders, not production assets.

## Working style
- Be proactive on small decisions; concise, actionable updates; prefer simple, reliable solutions.
- Plan from `IMPLEMENTATION_PLAN.md`; one milestone/feature at a time; **commit after every reasonable feature** and push the working branch (not to a deploy).
- Commit messages: `feat|fix|docs|test|chore: summary`. Keep PROGRESS.md updated (date, what changed, open items) in the same commit.
- Write tests with the feature: timing validation edge cases and the playback state machine are mandatory. Run lint, type-check and tests before committing.
- Prefer editing files over pasting large code into chat. Record architectural decisions in `docs/DECISIONS.md`.
- Verify UI changes visually (Playwright screenshots) against the reference screenshots; check both desktop and mobile widths.
- Surface risks early (see `ARCHITECTURE.md` §11). If the owner reports a bug you can't reproduce, say so and ask for the step/browser.

## Commands
`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run format` · `docker compose up -d` (local Postgres) · (after M4) `npx prisma migrate dev` · `npx prisma studio`. Update this list when scripts change.

## Repo map
`prototype/` approved design (reference only) · `docs/` decisions + reference media · `src/app` routes · `src/client` frontend · `src/server` backend · `src/shared` logic used by both (lint enforces the boundaries) · `assets/brand` logos · `tests/` e2e · `prisma/` schema · root `*.md` project docs.
