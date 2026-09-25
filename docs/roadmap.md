# Roadmap

Written 2026-09-25, after PR #2 (archive and Top 100 history). Update it when a
phase ends or a decision changes. Each item names the file or rule it changes.

The order matters more than the dates. Phase 0 is the work that is cheap now
and costly later. Most of it is a lesson that Tally (`bbsbh`) paid for in weeks
4 to 11 of its life. Do Phase 0 before new features.

Timing: the MiLB regular season is over. Rosters and stats are quiet until
spring. October to February is the best time to fix foundations.

## Decisions made

Settled 2026-09-25. Write an ADR when one of these shapes code.

- **Brewers only, forever.** Org 158 is a constant. URLs carry no org prefix.
  Covering another org would be a new site.
- **Dark mode is planned.** New tokens are light and dark pairs from the start,
  and lint checks contrast in both themes (0.5). Shipping it is Phase 2.
- **A pure fan site, for now.** No ads and no email list at launch. This may
  change, so keep every MLB asset URL (logos, headshots) behind one function
  in `src/lib/`. A switch to self-hosted assets is then one edit.
- **One author.** No author model. One byline in `src/config/site.js`.

## Decisions still open

These block parts of Phase 1. They do not block Phase 0.

1. **Site name and domain.** `src/config/site.js` is still a placeholder.
2. **Risk appetite for MLB assets.** Hotlinked logos and headshots, and the
   Pipeline scrape (ADR-0004). This matters more once the site is public.
3. **Protect `main`?** If yes, the nightly job needs a bot token first (0.7).
4. **Analytics: none, or Vercel Analytics?** If yes, see 1.6.

## Phase 0: Set in stone now

### 0.1 Make local lint tell the truth
`scripts/checks/run-all.mjs` crashes on Windows. `new URL().pathname` gives
`C:\C:\...`, and `relative()` returns backslashes, so the `src/` tests would
fail silently. Only CI on Ubuntu enforces the caps today. Use `fileURLToPath`
and normalize separators. Add a test that runs the checks on this machine.

### 0.2 Repo hygiene that Windows needs
- `.gitattributes` with `* text=auto eol=lf`, and a lint check for CRLF. Tally
  lost a day to one CRLF file (a 2-line edit became a 684-line conflict).
- `.nvmrc` with the Node version CI uses.
- `npm test` fails when it finds zero tests.

### 0.3 URL contract (new ADR)
Every public URL is permanent once shared. Write down, in one ADR:
- `/players/{name-id}` (exists), `/clubs/{name-id}` (before any club page
  ships), `/seasons/{year}`, `/posts/{type}/{slug}`.
- A URL reads loosely (trailing id wins) and renders one canonical form.
- Set `site` in `astro.config.mjs` and emit `<link rel="canonical">` in
  `Base.astro`.
Tally lesson: ADR-0057 came after bare-id links were public.

### 0.4 Club identity is keyed on (id, season)
This is a live bug against ADR-0003. Team ids are reused:
- 249 was the Carolina Mudcats (2017 to 2025). It is the Wilson Warbirds now.
- Also 406, 607, 2101 and 5430. In Tally's data, 559 was the Brewers'
  Huntsville Stars through 2014.
`SeasonClub.astro` shows today's logo and accent on every past season. Fix:
- Each archive file stores the season's own club name (check this).
- A pure `clubIdentity(id, season)` in `src/lib/` returns the logo and accent
  only when the season's name matches the current name. Otherwise it returns
  none, or an entry from a small override table with provenance.
- A test for 249 in 2019 and for the Huntsville years.

### 0.5 Focus ring (done)
The focus ring was gold: 1.47:1 on paper, and invisible on the gold header.
It is now two-tone (`--focus` with a `--focus-halo` band), and a `FOCUS` line
in `tokens.css` makes lint check it at 3:1 on every surface.

The rest of the token work moved to Phase 2, item 7 (decided 2026-09-25). The
CSS is small, so the sweep stays cheap for a while.

### 0.6 The season is data, not the clock
- Store `season` inside `org.json` and `pipeline.json`.
- Add `src/data/seasons.json` with `current` and the archive list. Pages read
  it instead of `new Date()`.
- A test runs the generators with the clock at Jan 1 and at a thin spring
  roster, and asserts they write nothing (Tally ADR-0086).
- Decide what `gen-org` does from February to April while rosters fill. Today
  a count of 1 to 99 throws, so the job would be red for weeks.

### 0.7 Harden the nightly job
`.github/workflows/nightly-data.yml` today can put unbuilt data on `main`.
- Run `npm run build` before commit. Pushes made with `GITHUB_TOKEN` do not
  start `ci.yml`, so nothing else checks it.
- Make each source independent. A failed Pipeline scrape must not throw away
  a good `org.json`.
- `git pull --rebase` and one retry before push.
- A freshness check at the end: fail if a snapshot is older than N days in
  season.
- Keepalive. GitHub disables a schedule after 60 days with no commits, and
  the offseason has no data commits.
- If `main` will be protected, set up a bot token first.

### 0.8 Tests that catch API drift
- `test/fixtures/manifest.json`: capture date and source URL per fixture.
- A nightly, networked check that refetches each fixture and reports shape
  changes. This is Rule 2 of CLAUDE.md with a script behind it.
- A test that the Keystatic fields match `src/content.config.js`. They have
  already drifted: the guide `affiliateId` options list 6 clubs, omit DSL
  Brewers Blue (607) and mislabel 2101. Build the options from
  `src/lib/affiliates.js`.

### 0.9 Docs that stay true
- `CONTEXT.md`: a glossary (org player, affiliate, level, complex club,
  Pipeline rank, snapshot, archive season).
- `docs/api.md`: start from Tally's `docs/MLB_STATS_API.md`, trimmed to MiLB,
  people and stats. Include the known quirks (listed below).
- Checks: ADR numbers are unique, and a word list ("postseason", not
  "playoffs").
- Fix the stale references now: `color.js` names a missing
  `check-contrast.mjs`; the CLAUDE.md map leaves out `src/layouts/`,
  `RankedList` and `SeasonClub`.
- A rule for CLAUDE.md: a convention without a check is a wish.

### 0.10 Cap pressure
`src/lib/` has 9 of 10 files. Plan the split before the next module lands.
For example: `src/lib/identity/` (color, affiliates, club identity) and
`src/lib/model/`.

## Phase 1: Ready to go public

1. Name, domain, `site` config, favicon and logo in `public/`. Stop hotlinking
   the Brewers logo for the site's own mark.
2. Keystatic in production: the GitHub App, env vars and the Vercel project
   (README steps). Save one real post end to end.
3. SEO pack, static only: `@astrojs/sitemap`, `robots.txt`, one static
   `og-image.png`, `og:url`, a Twitter card, and `Person` / `Article` JSON-LD
   on player and post pages. Never render OG images in a function (Tally
   went over the Vercel CPU limit this way).
4. `@astrojs/rss` for posts.
5. `404.astro`.
6. Analytics, if chosen: one `track()` wrapper with an allowlist and a test
   (Tally ADR-0028).
7. A Playwright smoke test over `dist/`: a few routes load, no broken internal
   links, and axe finds no violations. Screenshot baselines later.
8. LICENSE for the code, and a clear credits and disclaimer page.
9. Confirm the build time is acceptable. `pastPlayers()` rebuilds the archive
   index on each call (about 1,700 players). Cache it if the build is slow.

## Phase 2: Content and finding things

1. Real posts. Delete the sample post. Start with a guide per affiliate.
2. Club pages at `/clubs/{name-id}`, with the affiliate accent.
3. Find any player: an A to Z index of all ~2,200 players, then search. Today
   about 1,700 past players are reachable only through season pages.
4. Prospect cards for past and traded players, from the archive, not only
   `org.json`.
5. Headshot fallback as a pure, tested function: `silo` first for players who
   reached MLB, then `milb`, then initials.
6. The Top 100 gaps: 2025 and 2026 preseason lists (ADR-0007 source).
7. Design tokens, then dark mode. Do the tokens first, in one PR:
   - A spacing scale (`--space-*` on a 4px step), `--radius-*` and `--dur-*`.
     Lint fails a raw px in `padding`, `gap`, `margin` or `border-radius`.
   - Every color token is a light and dark pair, and the contrast check runs
     on both themes.
   - Run the contrast check over every entry in `ACCENTS`, not only `PAIRS`
     (Tally: 15 of 67 hand-picked club pairs failed on the first run).
   - Name color roles for their job (`bar`, `accent`, `onBar`). Gold means
     "Brewers" and nothing else.
   - A naming ADR: a class is named for its job (`.roster`), never its shape.

   Then add the dark theme toggle over the paired tokens. Do the token PR
   earlier if the CSS grows past about 1,000 lines.

## Phase 3: Offseason features

These fit the calendar.
- **Arizona Fall League** (October to November, sportId 17). A full-season
  roster call gives players with their real affiliate. Timely content now.
- **40-man and Rule 5 protection** (November). Which prospects are eligible.
- **Transactions**: promotions, trades, releases. Sort feed rows by id before
  grouping; the feed order is not stable (Tally ADR-0064).

## Later, maybe

- Scouting grades (needs a source and an ADR, per ADR-0004).
- Per-player share images, rendered at build time only.
- A byte budget for data shipped to islands.
- `people/changes?updatedSince=` to cut nightly fetches.

## Do not copy from Tally

- The spoiler seal and everything around it.
- SQLite and DuckDB layers. JSON snapshots are enough at this size.
- The Redis copy store, `/admin` and the Blob store. Keystatic covers it.
- The runtime identity overlay and Identity Lab. Seven affiliates fit in one
  static table.
- Dynamic OG rendering, the PWA service worker and live polling.
- Ratchet budgets for oversized files. Keep the hard caps.

## MLB Stats API notes to carry forward

- `fields=` prunes a response and documents which paths we use.
- `/stats` returns 50 rows unless you pass `limit`.
- Postseason game logs: use `gameType=F,D,L,W`, not `P`.
- sportIds: 11 AAA, 12 AA, 13 High-A, 14 A, 16 Rookie (ACL, DSL), 17 winter.
- Read parent orgs per season from `teams?sportIds&season` (2021 reorg).
  `teams/affiliates` shows only the current state.
- A level's season ends when its leagues' `seasonDateInfo` says so, not on a
  calendar date (Tally ADR-0074, 0079).
- No club colors, historical logos, uniforms or Statcast for most MiLB parks.
