# Who counts as an org player

**Status:** Accepted
**Date:** 2026-09-24

## Context

The owner wants a page for every player in the org. The Stats API has no "org
players" list. Each affiliate has an `active` roster (who is there now) and a
`fullSeason` roster (everyone who was there this season, with a status code).
Status codes seen live on 2026 Brewers rosters: `A`, `ASG`, `D7`, `D60`,
`DEV`, `FA`, `NYR`, `RA`, `RL`, `TAX`.

## Decision

- An org player is anyone on any affiliate's `fullSeason` roster this season.
- A player whose only entries are `RA` (rehab assignment) is a big-leaguer
  passing through and is left out.
- A player's current club is the roster where his status is strongest:
  active > injured > other > rehab > moved (`ASG`) > gone (`RL`, `FA`). A
  promoted player is `ASG` on the old club and `A` on the new one.
- Released players keep their page, marked "Left the org".
- The depth chart shows `A` players by position, plus an injured list.
  Pitchers are starters when half or more of their games at that club were
  starts; the roster has no role field.

## Consequences

2026: 7 affiliates, 253 players. The rule lives in `src/lib/org.js` with tests.
