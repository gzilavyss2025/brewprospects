# MLB Pipeline is the rank source

**Status:** Accepted
**Date:** 2026-09-24

## Context

The MLB Stats API has no prospect rank. Tally already reads MLB Pipeline's
lists from `www.mlb.com/prospects/stats/top-prospects`, which embeds them as an
inline `var data = [...]` script.

## Decision

`scripts/data/fetch-pipeline.mjs` (adapted from Tally's
`fetch-top-prospects.mjs`) reads the per-org list (`?type=all&minPA=1`),
keeps the Brewers (`teamId` 158), and adds each player's overall Top 100 rank
from the bare URL. It runs server-side in GitHub Actions: `www.mlb.com` sends no
CORS headers.

## Risks, accepted

- The page structure is undocumented and can change without notice. Shape
  guards fail the job instead of writing wrong data; the last good file stays.
- The bare URL has at least once served the per-org list instead of the Top
  100; `assertTop100Shape` catches this.
- Reading an editorial page is a terms-of-use grey area. The site credits MLB
  Pipeline and states it is not affiliated.
- The list has no scouting grades or blurbs (checked 2026-09-24). Grades need a
  different source, which needs its own decision.
