# A ranked player is a Brewer when the rosters say so

**Status:** Accepted
**Date:** 2026-09-25

## Context

The historical Top 100 rows come from bbsbh (`data/sources/top-prospects-history/`,
see its PROVENANCE.md): Baseball America 2005–2008, MLB Pipeline 2009–2024.
Each row is `{ season, rank, mlbId, source }`. There is **no team**, so the
rows alone cannot say which players were Brewers prospects.

Two shortcuts were rejected:

- **The player's roster history (`hydrate=rosterEntries`).** It has gaps.
  Josh Hader's 2015 Brewers minor-league stints are missing from it (checked
  live). A gap would silently drop a Brewer.
- **Crediting the club he was with when the list came out.** Nothing in the
  data records that date's club.

## Decision

A ranked player counts as a Brewer for a season when the archive shows him in
the Brewers system **that season**: on an affiliate roster, or on Milwaukee's.
That is a statement the rosters prove.

- A prospect traded during the season counts for the Brewers and is marked
  with the other clubs he played for that year, read from his year-by-year
  splits (LaPorta 2008, Segura 2012, Santana 2015, Brinson and Ortiz 2016).
  So "Lewis Brinson, #16, 2016" is shown with "also played for Frisco
  RoughRiders", not as if the Brewers owned him when he was ranked.
- 2020 has no farm rosters. For that year only, Milwaukee's roster and its
  non-roster invitees to big-league camp count, and the page says the list
  may be incomplete. No 2020 Top 100 player appears on a Brewers roster in
  2019 or 2021 either, so the empty 2020 result is consistent.
- Baseball America players who never reached the majors have no MLB id. They
  are shown by name with BA's own team label (one Brewer: Will Inman, #91,
  2007), and marked as such.
- Every list names its source. There is no 2025 list in the source files yet;
  the page says so.

## Licence

The Baseball America rows are editorial content from a transcription that
declares no licence. On 2026-09-25 the site owner stated they have permission
to use them, and asked for them to be published. The site credits Baseball
America on every list that uses them and in the footer.

## Consequences

2006–2024: 48 ranked Brewers (plus one BA non-debut). The rule lives in
`src/lib/archive.js` (`brewersRanked`, `otherClubs`) with tests.
