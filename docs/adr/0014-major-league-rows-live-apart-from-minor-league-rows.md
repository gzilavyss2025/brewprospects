# Major-league rows live apart from minor-league rows

**Status:** Accepted
**Date:** 2026-09-29

## Context

A fan who opens a retired prospect's page asks two things: did he reach the
majors, and how did he do? `org.json` holds MiLB rows only, because the
`leagueListId=milb_all` hydrate returns no MLB rows (`docs/api.md`).

The first idea was to add MLB (sportId 1) to `LEVELS`. `LEVELS` drives the
level path, the sort order, the depth chart, and the prospect card's choice of
season line. An MLB entry there would change all of them: MLB would rank above
Triple-A, and the card could pair a MiLB total with an "AAA/MLB" label.

## Decision

- MLB rows are their own snapshot, `src/data/mlb.json`, written by
  `scripts/data/gen-mlb.mjs`. The hydrate is `sportId=1`.
- MLB is **not** a level. `LEVELS` holds MiLB levels only, and a test says so.
- The file covers every player with a page: org players and past players.
  It keeps only players who have MLB rows.
- `src/lib/model/mlb.js` orders the rows. It sums nothing and derives nothing.
- A player page shows them in a "Major leagues" section, after the MiLB
  tables. The level path and the MiLB tables never read the file.
- A traded player's total row (no team, `numTeams` set) is kept and labeled
  "2 teams". It is what the API sent (ADR-0003).

## Consequences

- Nothing that computes from MiLB rows can change because of an MLB row.
- One more nightly step, about 50 requests, and one more file in `src/data/`.
- MLB rows show every club he played for, not only Brewers affiliates. The
  archive coverage note on a past player's page says so.
- Career totals are not shown. The API has a `career` stat type; add it in a
  later change if readers ask.
