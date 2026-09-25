# Historical Top 100 rows: where they come from

These three files are copied, unchanged, from the owner's other repo, bbsbh
(Tally), at `.scratch/top-prospects-history/` on 2026-09-25.

| File | What it holds |
| --- | --- |
| `rows.json` | 1,823 rows: `{ season, rank, mlbId, source }`, one per ranked player |
| `seasons.json` | Per-season coverage: status, list depth, row count, notes |
| `ba-non-debuts.json` | Baseball America ranks with no MLB id (never reached the majors), with BA's team label |

## Sources

- **MLB Pipeline, 2009–2024.** MLB.com's historical preseason lists at
  `https://www.mlb.com/prospects/{year}`, read by bbsbh's `pull.mjs`. 2009–2011
  are Top 50 lists. 2020 and 2021 have 99 names, as MLB published them.
- **Baseball America, 2005–2008.** A third-party CSV transcription of BA's
  preseason Top 100 lists (github.com/feralad/rostercrunch). It declares no
  licence. Its Retrosheet ids were joined to MLB ids through the Chadwick
  Bureau register (Open Data Commons Attribution License 1.0). The site owner
  states they have permission to use these rows; see docs/adr/0007.

## Rules

- Do not edit these files by hand. To update them, re-run bbsbh's
  `pull.mjs` / `pull-ba.mjs` and copy the output here.
- The rows name no team. `scripts/data/gen-prospect-history.mjs` decides which
  rows are Brewers (docs/adr/0007).
- The site shows 2006 on (the archive window), so the 2005 rows are unused.
- There is no 2025 list here yet.
