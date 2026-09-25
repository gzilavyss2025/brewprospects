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
3. **Protect `main`?** Deferred until Vercel is set up. When yes, the nightly
   job needs a bot token first (0.7).
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

### 0.6 The season is data, not the clock (done)
Most of this was already true. `org.json` stores `season`, the archive takes
its last season from `org.json`, and pages never read the clock for a season.
The gap was spring. A new season's rosters fill in a few players at a time,
and any count from 1 to 99 threw, so the nightly job would have been red for
weeks. `snapshotAction()` in `src/lib/org.js` now keeps the last season while
a new one fills in. It still fails on a thin roster for the season already on
disk. `pipeline.json` gets no `season`: it is a rolling list, and its date is
the honest label. The freshness check in 0.7 catches a job stuck on "keep".

### 0.7 Harden the nightly job (done)
`.github/workflows/nightly-data.yml` now:
- Runs each generator on its own. A failed source keeps its last good file,
  the others still commit, and the job fails at the end so it is seen.
- Runs `npm test` and `npm run build` before it commits. Pushes made with
  `GITHUB_TOKEN` do not start `ci.yml`, so this is the only check.
- Rebases and retries the push up to three times.
- Runs `scripts/data/freshness.mjs`, which fails when `org.json` still holds
  last season after May 1.

Not done, on purpose:
- **Keepalive.** GitHub disables schedules after 60 quiet days only in public
  repos. This repo is private. Add a keepalive if it goes public.
- **Bot token.** Protecting `main` is deferred until Vercel is set up
  (decided 2026-09-25). Before protection goes on, give the job a token that
  may push to `main`, or it will fail every night.

### 0.8 Tests that catch API drift (done)
- `test/fixtures/manifest.json`: capture date and source URL per fixture.
  Each URL names a finished season, so its content cannot change. A test
  fails when a fixture has no entry.
- `scripts/data/drift.mjs` runs in the nightly job. It refetches each source
  URL and fails on any field path the fixture has and the API no longer
  sends. Adapted from bbsbh's `check-feed-shape-drift.mjs`, with arrays
  compared over every element so trimmed fixtures work.
- Lint checks that Keystatic and `src/content.config.js` declare the same
  fields, and that the guide club list is exactly the current affiliates. It
  had drifted (six clubs, no DSL Brewers Blue); fixed. This is lint, not a
  unit test, so an affiliate change never blocks the nightly data.

### 0.9 Docs that stay true (done)
- `CONTEXT.md`: the glossary, in bbsbh's format.
- `docs/api.md`: every Stats API call we make, the parameters that matter,
  sportIds and known quirks. Trimmed from bbsbh's `docs/MLB_STATS_API.md`;
  rows checked only there are marked.
- Lint: ADR numbers are unique, and the word list ("postseason"). Both
  adapted from bbsbh.
- Fixed stale references: `color.js` and the CLAUDE.md map.
- CLAUDE.md rule 7: a convention without a check is a wish.

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
7. Design tokens, then dark mode. Split into three PRs (2026-09-25), each
   from main after the previous one merges: A = scale and lint, B = color
   roles, theme pairs and affiliate contrast, C = naming ADR and classes.
   - **Done (A):** a spacing scale (`--space-*` on a 4px step), `--radius-*`
     and `--dur-*`. Lint rejects raw px in `padding`, `gap`, `margin` and
     `border-radius`, including longhands and inline styles. It allows 0,
     1px, 2px and tokens.css. Counts and preserved steps are in ADR-0011.
   - Every color token is a light and dark pair, and the contrast check runs
     on both themes.
   - Run the contrast check over every entry in `ACCENTS`, not only `PAIRS`
     (Tally: 15 of 67 hand-picked club pairs failed on the first run).
   - Name color roles for their job (`bar`, `accent`, `onBar`). Gold means
     "Brewers" and nothing else.
   - A naming ADR (0010, reserved for C): a class is named for its job
     (`.roster`), never its shape. Keep `.card` as the one card primitive.

   B uses navy-black, selected from the
   [palette study](https://brewprospects-palette-study.gary-zilavy.chatgpt.site).
   Keep brand navy and gold unchanged. Use `--surface-card`, omit
   `--club-accent`, and fail lint plus fall back to Brewers navy on a failed
   affiliate pair. Gold means Brewers only.

   **Open, separate work:** the dark theme toggle. The token PRs prepare
   for it; they do not activate a dark theme on any page.

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
