# A team id is not a club

**Status:** Accepted
**Date:** 2026-09-25

## Context

The Stats API reuses team ids. In our archive, id 249 was the Carolina Mudcats
from 2017 to 2025 and is the Wilson Warbirds in 2026. Id 559 was the Brewers'
Huntsville Stars through 2014 and is another org's club today. Complex clubs
change names too: 406 was the AZL Brewers and is the ACL Brewers.

The logo CDN (`team-logos/{id}.svg`) and our researched accents describe only
the club that holds the id now. The season pages showed the Warbirds' logo and
color on every Mudcats season. That breaks ADR-0003.

## Decision

- A past club gets today's logo and accent only when its name that season, as
  stored in `src/data/archive/{season}.json`, equals its current name in
  `org.json`. `clubIdentity()` in `src/lib/identity/affiliates.js` holds this rule.
- Otherwise the club gets no logo and the Brewers fallback accent.
- A club that is no longer an affiliate never gets a logo.
- Exact name match, no fuzzy match. "AZL Brewers" and "ACL Brewers" may be the
  same club, but we do not guess.

## Consequences

Many older seasons show no logos. To add a logo for a past club, add a table
keyed on (id, season range) with a source for each entry, in a new PR. Do not
loosen the name match.
