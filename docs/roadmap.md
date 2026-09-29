# Roadmap

Written 2026-09-25, after PR #2. Reviewed 2026-09-28, after PR #18. Update it
when a phase ends or a decision changes. Each item names the file or rule it
changes.

The order matters more than the dates. **Foundations come first** (decided
2026-09-28): finish the work that is cheap now and costly later before new
features, even when a feature is timely. Most of it is a lesson that Tally
(`bbsbh`) paid for in weeks 4 to 11 of its life.

## Decisions made

Settled 2026-09-25 unless dated. Write an ADR when one of these shapes code.

- **Brewers only, forever.** Org 158 is a constant. URLs carry no org prefix.
  Covering another org would be a new site.
- **Dark mode shipped** (2026-09-28). Every color token is a light and dark
  pair, and lint checks contrast in both themes (ADR-0012). The reader picks
  the theme (ADR-0013).
- **A pure fan site, for now.** No ads and no email list at launch. This may
  change, so keep every MLB asset URL (logos, headshots) in one module,
  `src/lib/identity/affiliates.js`. A switch to self-hosted assets is then
  one file.
- **One author.** No author model. One byline in `src/config/site.js`.
  The byline stays empty (2026-09-29), so post JSON-LD has no `author`.
- **Foundations first** (2026-09-28). This offseason goes to Phase 1 and the
  foundation items of Phase 2. The 2026 Arizona Fall League and Rule 5 dates
  may pass without a feature. That is accepted.
- **Vercel project** (2026-09-28): `brewprospects` in the `gareedge` team,
  linked to this repo. Every merge to `main` deploys to
  `https://brewprospects.vercel.app`, a placeholder until the domain is
  chosen. `SITE_URL` stays unset until then (ADR-0009).
- **The repo is public, and `main` is protected** (2026-09-28). A ruleset
  requires a PR and the `ci` check, with no admin bypass. That is what sends
  Keystatic saves to `post/*` branches (ADR-0002). The nightly job pushes
  with a deploy key, the one bypass. Drafts on `post/*` branches are public.

## Decisions still open

1. **Site name and domain.** Deferred (2026-09-28). `src/config/site.js` is
   still a placeholder. Blocks Phase 1 item 2 and the canonical parts of 1.
2. **Risk appetite for MLB assets.** Hotlinked logos and headshots, and the
   Pipeline scrape (ADR-0004). The placeholder URL is public now, so this
   matters now.
3. **Analytics: none, or Vercel Analytics?** If yes, see Phase 1 item 3.

## Done

- **Club records and level pages** (2026-09-29). Each club on
  `/seasons/{year}` shows its record, or "not on record". `/levels/{level-slug}`
  lists the Brewers clubs at each level, season by season (ADR-0009,
  `src/lib/model/level-history.js`).
- **Full careers for past players** (2026-09-29). A past player's page
  shows his whole minor-league career, with any club, from `careers.json`
  (ADR-0006). MLB rows are unchanged (ADR-0014).
- **Phase 0** (PRs #4 to #11, #18). Lint runs true on Windows (0.1). LF
  line endings, `.nvmrc`, and a test runner that fails on no tests (0.2).
  The URL contract, ADR-0009 (0.3). Club identity keyed on (id, season),
  ADR-0008 (0.4). A two-tone focus ring checked at 3:1 (0.5). The season is
  data, not the clock: `snapshotAction()` keeps last season while spring
  rosters fill in (0.6). A hardened nightly job with a freshness check
  (0.7). Fixture drift checks and content schema lint (0.8). `CONTEXT.md`,
  `docs/api.md` and doc lint (0.9). `src/lib/` split into `model/` and
  `identity/` (0.10).
- **Design tokens and dark mode** (was Phase 2, item 7; PRs #12 to #18).
  A: spacing, radius and duration tokens, and raw-px lint (ADR-0011).
  B: color roles in light and dark pairs, checked in both themes (ADR-0012).
  C: classes named for their job, and the shape-word lint (ADR-0010). Then
  the theme toggle (ADR-0013).
- **Keystatic in production** (was Phase 1, item 1; 2026-09-28). The
  GitHub App `brewprospects-keystatic`, its Vercel env vars, and one post
  saved from the live editor end to end. README has the steps.
- **Post paths are checked** (was Phase 1, item 2; 2026-09-28). Lint fails
  when a post published on `main` loses its path (ADR-0009).
- **The 404 page** (was Phase 1, item 1; 2026-09-28). It sends a stale
  player path to the current one through the path map (ADR-0009).
- **Smoke tests** (was Phase 1, item 3; 2026-09-28). `npm run e2e` serves
  the build the way Vercel does. It checks every internal link in every
  page, loads eleven routes in both themes with third-party requests blocked,
  runs axe on each, and checks the 404 page and its redirect. Screenshot
  baselines later.
- **Levels list is complete** (2026-09-29). `LEVELS` holds SS-A (15)
  and ROK+ (5442), so player pages show those stat rows.
- **Club records in the data** (2026-09-29). The archive holds the 2019 Rocky
  Mountain Vibes (sportId 5442). Every archive season file and `org.json` has
  a `standings` block: each club's regular-season record, keyed by team id
  (`gen-archive --standings`). Data only; the pages that show it are a later PR.
- **LICENSE and credits** (was Phase 1, item 4; 2026-09-28). MIT for the
  code only. `/about` names each data source and who owns it.
- **Headshot fallback** (was Phase 2, item 5; 2026-09-28). The player
  page tries `silo`, then `67`, for a player with an `mlbDebutDate`, then
  `milb`, then initials. The chain and its `onerror` handler are pure functions in
  `src/lib/identity/headshot.js`; no island. The prospect card still uses
  `milb` only.
- **Build time** (was Phase 1, item 9). CI runs lint, test and build in
  under a minute. `pastPlayers()` runs once per build. No cache needed.
- **RSS feed** (was Phase 1, item 3; 2026-09-28). `/rss.xml`, built with
  `@astrojs/rss`, lists the same posts as `/posts`: recaps, features, lists
  and guides, newest first, with no post body (ADR-0009).
- **SEO pack** (was Phase 1, item 1; 2026-09-29). Head tags, `robots.txt`,
  the sitemap, one static `og-image.png`, and `Person` / `Article` JSON-LD on
  player and post pages. Nothing renders in a function. These wait for
  `SITE_URL`: the sitemap, the robots `Sitemap` line, canonical, `og:url`,
  `og:image`, `twitter:card` and the JSON-LD `url`. `public/og-image.png`
  carries the placeholder site name. Run `npm run og-image` again when the
  name is chosen (open decision 1). The Article has no `author`: `BYLINE`
  in `src/config/site.js` stays empty by choice. It has no `dateModified`
  until posts have an `updated` field.

## Phase 1: Ready to go public

The site is live at the placeholder URL. This phase makes it safe to share.
Most of what is left needs the site name (open decision 1).

2. **Name, domain, `site` config, favicon and logo** in `public/`. Stop
   hotlinking the Brewers logo for the site's own mark. Blocked on open
   decision 1.
3. **Analytics**, if chosen: one `track()` wrapper with an allowlist and a
   test (Tally ADR-0028).

## Phase 2: Content and finding things

1. Real posts. Delete the sample post: it is published, so list its path in
   `RETIRED` in `scripts/checks/post-paths.mjs`. Start with a guide per
   affiliate.
2. Club pages at `/clubs/{name-id}`, with the affiliate accent.
3. Find any player: an A to Z index of all ~2,200 players, then search. Today
   about 1,700 past players are reachable only through season pages.
4. Prospect cards for past and traded players, from the archive, not only
   `org.json`.
5. The Top 100 gaps. `prospect-history.json` ends at 2024; 2025 has no list,
   and 2026 is missing (ADR-0007 source). Add each new year's list as it
   comes out (see the calendar).

## Phase 3: Offseason features

Timely, but after the foundations (decided 2026-09-28).
- **Arizona Fall League** (October to November, sportId 17). A full-season
  roster call gives players with their real affiliate.
- **40-man and Rule 5 protection** (November). Which prospects are eligible.
- **Transactions**: promotions, trades, releases. Sort feed rows by id before
  grouping; the feed order is not stable (Tally ADR-0064).

## Calendar

Dates are approximate. Check each one every year.

- **October to mid-November:** Arizona Fall League.
- **About November 20:** 40-man protection deadline.
- **December:** Rule 5 draft.
- **January to February:** new Top 100 and Pipeline Top 30 lists. Refresh
  `pipeline.json` and add the year to the Top 100 history.
- **March:** spring rosters fill in. This is the first real run of the
  "keep last season" path in `snapshotAction()`. Watch the nightly job.
- **May 1:** `freshness.mjs` starts to fail if `org.json` still holds last
  season.

## Later, maybe

- Scouting grades (needs a source and an ADR, per ADR-0004).
- Per-player share images, rendered at build time only.
- A byte budget for data shipped to islands.
- `people/changes?updatedSince=` to cut nightly fetches.
- Past club logos from a sourced table keyed on (id, season) (ADR-0008).

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
