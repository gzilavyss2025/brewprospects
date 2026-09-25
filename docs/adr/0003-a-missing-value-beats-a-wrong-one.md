# A missing value beats a wrong one

**Status:** Accepted
**Date:** 2026-09-24

## Context

This rule comes from Tally (bbsbh ADR-0078). There, a winter league's feed kept
about 1.7 pitches per play against about 3.9 everywhere else. The numbers were
consistent with each other and wrong, and nothing about them looked wrong. A
site can hide a stat it does not have. It cannot hide one it was handed wrong.

MiLB data is thin in many places: lineups, photos, logos, tracking data at
untracked parks, and whole older seasons.

## Decision

- Every reader of a field shows `—` or a sentence ("No MiLB games on record")
  when the field is missing. Placeholder strings such as `.---` are stored as
  missing.
- Nothing is invented: no guessed colors (a club with no researched color uses
  Brewers navy), no derived stat the API did not send.
- Generators check their output (affiliate count, player count, list shape)
  and throw on a bad response. They write to a temp file and rename, so a
  failure leaves the last good snapshot in place.
- New data (a season in the archive, a new source) ships only after a check
  that it is complete enough not to state something false.

## Consequences

Some pages look sparse, and that is correct. The archive backfill must measure
each old season before it ships.
