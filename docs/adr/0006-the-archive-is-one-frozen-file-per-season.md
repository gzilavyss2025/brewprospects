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
- Each season file also holds a `standings` block, each club's regular-season
  record. `gen-archive --standings` writes only that block into a file on
  disk, with no roster refetch.
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

## Amended 2026-09-29: careers.json, a second kind of file

A season file holds each player's line for the Brewers club only. A past
player's page could not show his other minor-league clubs. It now can.

- `scripts/data/gen-careers.mjs` writes `src/data/archive/careers.json`. It
  holds the whole minor-league career (`leagueListId=milb_all`, the hydrate
  gen-org uses) of every past player: an archive player who is not in this
  season's org. The rows are the rows gen-org stores, with any club, and
  no-team totals kept as the API sent them (ADR-0003).
- It is not a season file. It is one file that changes, not a frozen one, so
  `src/lib/build/archive.js` still loads only `[0-9]{4}.json` as seasons and
  reads `careers.json` on its own.
- **Refresh.** The file stores `throughSeason`, the season `org.json` held.
  A run fetches only past players with no entry. When gen-org moves to a new
  season, every entry is fetched again, because a past player can still play.
  A player who joins the org drops out of the file. Both rules are
  `careerTargets()` and `mergeCareers()` in `src/lib/model/careers.js`.
- **Guards.** More than 5% of the requested players missing, or most of a batch
  with no MiLB rows, throws and keeps the last good file.
- **An entry replaces the roster lines.** It does not add to them. Checked on
  2026-09-29: all 6,580 archive lines are in the entries, matched on season,
  level and club. A Brewers line keeps the club name the archive has for that
  season (ADR-0008): the career feed names team 406 "ACL Brewers" for 2016 to
  2018, and the roster feed says "AZL Brewers". A player with no entry keeps
  his roster lines, and the page says so.
- **Size.** 1,786 past players and 21,991 rows came to 5.3 MB as objects.
  That was too big, so the file is packed: each club (696 of them) is stored
  once, and each row is an array with its columns named in the file. It is
  1.7 MB, and `unpackCareers()` gives back the exact rows. A test checks the
  round trip on a captured response. A field with no column throws, so a new
  field cannot be dropped in silence. The season files stay as objects.
- The page says "through {season}" when it has an entry.

This replaces two lines above: a past-only player's page now says it shows
his minor-league seasons with any club when he has an entry, and the
Consequences line about other clubs holds only for a player with no entry.
