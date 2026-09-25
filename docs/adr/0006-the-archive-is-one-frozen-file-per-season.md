# The archive is one frozen file per season

**Status:** Accepted
**Date:** 2026-09-25

## Context

The owner wants past seasons back to 2006, with a page for every player in
that window. Measured on 2026-09-25: Brewers affiliate rosters with full stat
lines exist in the Stats API from 1988 (1986–87 return clubs with empty
rosters). 2006–2025 holds 20 seasons, 1,956 players, and 3.1 MB of JSON.
2020 has no minor-league season.

## Decision

- `scripts/data/gen-archive.mjs` writes `src/data/archive/{season}.json` for
  every season from `ARCHIVE_FIRST_SEASON` (2006) to the season before the
  current one, plus `people.json` (a short bio per player).
- A season file holds each affiliate's full-season roster and each player's
  line **for that club only**. When a player changed clubs at one level, the
  API returns a no-team total plus one split per club (checked live: Raúl
  Alcantara, Biloxi 2025); only the split for the affiliate is kept.
- Past seasons do not change, so a file on disk is never refetched unless
  `--refetch` or `--season` says so. The nightly job runs the generator; on
  most nights it makes no requests. A season joins the archive when
  `gen-org` moves to the next season. That happens once the new season's
  rosters pass gen-org's guard (about March), so until then the finished
  season stays the "current" one.
- Guards: a season with fewer than 4 clubs, fewer than 100 players, or more
  than half its clubs empty throws and writes nothing. A club the teams list
  names but that fielded no roster (the DSL clubs before 2010) is dropped.
  2020 is written as a record of why it is empty.
- Every archive player gets a page. A player in this season's org keeps his
  full-career page. A past-only player's page is built from his archive
  lines and says it shows only his seasons with Brewers affiliates.

## Consequences

- About 2,000 static pages; the build takes seconds.
- A past player's page does not show his time with other clubs or in the
  majors. That is stated on the page rather than filled from another source.
- 1988–2005 can be added by lowering `ARCHIVE_FIRST_SEASON` and running the
  generator; the guards apply to each added season.
