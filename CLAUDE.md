# CLAUDE.md

Guidance for Claude Code in this repo. Keep it lean: `scripts/checks/run-all.mjs`
caps every `CLAUDE.md` at 150 lines. Put detail in `docs/` and leave a pointer here.

## What this is

A fan site about the **Milwaukee Brewers farm system**: every affiliate, every
player, MLB Pipeline ranks, and a blog whose posts can hold live data blocks.
It is **Brewers-first**: Brewers navy and gold lead, and an affiliate's own
color appears only as an accent on its own sections. Audience: casual Brewers
fans, prospect readers, and fans of the affiliate clubs. Results are open;
there is no spoiler seal (unlike Tally, the sibling repo `bbsbh`).

The site name is a placeholder in `src/config/site.js` until the owner picks one.

## Stack

Astro 7, static-first (ADR-0001). React only for islands. Keystatic is the
browser CMS at `/keystatic`, Git-backed (ADR-0002). Hosted on Vercel.

```bash
npm install
npm run dev      # http://127.0.0.1:4321  (editor: /keystatic)
npm run build    # static pages + the Keystatic function, via the Vercel adapter
npm run data     # refresh src/data/*.json from the live sources
npm run lint     # eslint + structural checks
npm test         # node:test unit suite, no network
```

## Workflow

Work on a branch and open a PR. Never push to `main`: every merge to `main`
deploys. The nightly data job is the one planned exception.

## Data

- `scripts/data/gen-org.mjs` writes `src/data/org.json`: affiliates
  (`parentOrgId` 158), full-season rosters, and every player's MiLB
  year-by-year stats (`leagueListId=milb_all`, one batched request per 40
  players).
- `scripts/data/fetch-pipeline.mjs` writes `src/data/pipeline.json`: the MLB
  Pipeline Brewers list. It reads an undocumented MLB.com page (ADR-0004).
- `scripts/data/gen-archive.mjs` writes `src/data/archive/{season}.json` for
  2006 to last season, one frozen file each, plus `people.json` (ADR-0006).
- `scripts/data/gen-prospect-history.mjs` writes `src/data/prospect-history.json`
  from the bbsbh Top 100 rows in `data/sources/` (ADR-0007). Never edit
  `data/sources/` by hand; see its PROVENANCE.md.
- Both **fail loudly and keep the last good file** when a response looks wrong.
- Pages read the snapshots only through `src/lib/build/data.js` and
  `src/lib/build/archive.js`.
- The one live read is the prospect-card island (`src/components/ProspectCard.jsx`),
  which calls `statsapi.mlb.com` from the browser (CORS is open) and keeps the
  snapshot on any error.

## Rules

1. **A missing value beats a wrong one** (ADR-0003). Show `—` or "not on
   record"; never fill a gap with a guess, an invented color, or a stat the API
   did not send. MiLB feeds are often thin; every reader must survive a blank.
2. **Verify a new API field against a live response** before you use it, and
   note which response you checked in a comment. A captured response goes in
   `test/fixtures/` with its date and URL in `manifest.json`; the nightly
   `scripts/data/drift.mjs` refetches each one and fails on a missing field.
3. **Who counts as an org player** is defined in `src/lib/org.js` (ADR-0005).
   Change it there, with a test.
4. **Pure logic lives in `src/lib/`** and has tests. Modules that read
   `astro:content` or the JSON snapshots live in `src/lib/build/`.
5. **Colors are tokens** in `src/styles/tokens.css`. A raw hex in a page or
   component fails lint. New token pairs go on the `PAIRS` line, which lint
   checks for WCAG AA.
6. **Caps are enforced, not suggested**: 10 files per code folder, 300 lines
   per file. When one fails, split. Do not raise the cap.
7. **A convention without a check is a wish.** When you add a rule here, add
   the lint check or test that enforces it, in the same PR.
8. **Tests stay honest.** A bug fix ships with a test that fails without it.
   Never loosen or skip a test to get green.
9. **Public URLs are permanent** (ADR-0009). Build every path with `paths` in
   `src/lib/slug.js`; a new kind of page adds its row to the ADR's table.
10. **Spacing and radii use tokens** (ADR-0011). Lint rejects raw px in
    `padding`, `gap`, `margin`, `border-radius` and their longhands, including
    inline styles in styles, components, layouts and pages. Only 0, 1px, 2px
    and `tokens.css` are exempt. Border widths and font sizes are outside
    this check.

## Content

Keystatic collections (`keystatic.config.jsx`) must match the Astro schemas in
`src/content.config.js` field for field. Post types: `recaps`, `features`,
`lists`, `guides`, plus `playerNotes`. The `prospect-card` block is a Markdoc
tag (`markdoc.config.mjs`); a player page lists every post that names him in
`players` or in a card.

## Map

- `src/pages/` — home, `/depth-chart`, `/players`, `/players/{name-id}`, `/seasons`,
  `/seasons/{year}`, `/prospects` (Top 100 history), `/posts`
- `src/layouts/Base.astro` — the one page shell: head tags, nav, footer
- `src/components/` — `StatTable`, `Headshot`, `RankedList`, `SeasonClub`, `ProspectCard` (+ its tag)
- `src/lib/` — pure model (`org`, `archive`, `levels`, `card`, `posts`, `slug`, `format`, `color`, `affiliates`)
- `scripts/checks/` — lint's structural checks; `scripts/data/` — generators, drift, freshness
- `docs/adr/` — the why behind each decision. Read before you change one.
- `docs/api.md` — every Stats API call we make, and its quirks
- `CONTEXT.md` — the glossary. Use its words; add a term when you add one.
- `docs/roadmap.md` — what is next, and what was decided

## Writing style

Plain, short sentences (ASD-STE100 style, as in Tally). Baseball's October
is the "postseason"; lint enforces the word list in `scripts/checks/docs.mjs`.
