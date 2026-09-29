# Snapshots are packed and store counts, not rates

**Status:** Accepted
**Date:** 2026-09-29

## Context

The player-page issues (#35 to #57) add new data: a game log, splits,
fielding and a Pipeline log. The game log alone is about 15,000 rows a
season. As objects with the API's field names, that is about 20 MB (an
estimate).

The snapshots we had wasted space in two ways:

- **Names on every row.** A row was an object, so each row repeated its field
  names and its club's name and league.
- **Rates next to the counts they come from.** Each row stored AVG, OBP, SLG,
  OPS, IP, ERA, WHIP, K/9 and BB/9 as strings. We could not recompute them,
  because we did not keep HBP, SF or earned runs.

`careers.json` already fixed the first problem (ADR-0006). The other files
did not follow it.

## Decision

- **Counts only.** A snapshot stores counting stats, never a rate. The
  generator keeps the counts each rate needs: HBP and SF for OBP, outs for IP,
  and earned runs for ERA. `src/lib/model/player/rates.js` computes every rate
  a page shows. Each rate function returns the exact string the API sends.
- **A missing count gives a blank rate.** When a count a rate needs is
  missing, the rate is null and the page shows `—` (ADR-0003).
- **Packed.** `columns` names each group's columns once, and a row is an
  array. Each club is stored once in `clubs`, and a row holds its index.
  `src/lib/snapshot/pack.js` packs and unpacks. A field with no column throws,
  so the generator keeps the last good file.
- **Numbers over strings.** A season is a number on disk, and so are outs.
  An id beats a name.
- **One entry per line** in the big tables (`clubs`, `players`), written by
  `scripts/data/lib/by-line.mjs`. A nightly diff shows only the players that
  changed, and a reviewer can read it.
- **Unpacked once.** `src/lib/build/` unpacks each file when it loads.
  Pages and models see plain rows, as before.
- **A new file starts packed.** Lint (`scripts/checks/snapshots.mjs`) fails a
  JSON file in `src/data/` that has no `columns`, stores a rate as a column
  or key, or has a row of the wrong width or a club index out of range. A file
  may skip the rule only when `EXEMPT` names it with a reason. An `EXEMPT`
  line for a file that is gone also fails lint.
- **Compute, don't store, what comes from other rows.** Streaks, bests,
  percentiles and teammates come from the rows at build time, each computed
  once per build and not once per page.

## Verification

Checked on 2026-09-29 against a live `gen-mlb` fetch of 2,042 players:

- All 25,056 rate values the API sent matched the computed strings.
- The API rounds OBP and SLG first, then adds them for OPS. Rounding the
  exact sum was off by .001 on 1,167 rows, so `ops()` adds the rounded values.
- When the denominator is 0, a hitting rate is ".000" (for example, a
  pitcher with no at bats). A pitching rate with 0 outs is "-.--", which we
  store as null.
- Every cell of every MLB row a page shows (129,384) was the same before and
  after the change.

`test/rates.test.js` repeats this check on every split in three captured
responses, MiLB and MLB.

## Consequences

- `mlb.json` went from 1,463,427 bytes to 306,979 (79% less). Gzipped, it
  went from 188 KB to 84 KB.
- `careers.json` uses the same packer. It still stores rates, because its
  rows have no HBP, SF or earned runs. It stays exempt until those counts are
  fetched.
- `org.json` and the season files are exempt until they are converted.
  `pipeline.json`, `prospect-history.json` and `people.json` hold no stat
  rows and stay exempt.
- ADR-0014 said `mlbRows` "derives nothing". Now it adds each row's rates,
  from that row's counts. It still adds nothing up.
- A new rate (ISO, K%, BB%, BABIP in #38) is a function in `rates.js` with
  a fixture test, not a new column.
