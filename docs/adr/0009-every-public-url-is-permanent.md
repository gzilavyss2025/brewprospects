# Every public URL is permanent

**Status:** Accepted
**Date:** 2026-09-25

## Context

A URL is a promise once someone shares it. Tally (bbsbh ADR-0057) set its
address rules after bare-id links were public, and then had to read old forms
forever. This site has no public links yet, so we can fix the rules now.

## Decision

These are the public paths. `paths` in `src/lib/slug.js` builds every one of
them; no page writes a path by hand.

| Path | Example |
| --- | --- |
| `/players/{name-id}` | `/players/jesus-made-815908` |
| `/clubs/{name-id}` | `/clubs/wilson-warbirds-249` (reserved, no page yet) |
| `/seasons/{year}` | `/seasons/2019` |
| `/posts/{type}/{slug}` | `/posts/features/welcome-to-the-farm` |
| `/depth-chart`, `/players`, `/seasons`, `/prospects`, `/posts` | list pages |
| `/about` | credits and disclaimer |
| `/player-paths.json` | the path map: a data file for the 404 page |

- **Name and id.** The id makes the address unique. The name makes it
  readable. Only the trailing id is trusted. A name change makes a new
  canonical path; the old one must still reach the page (see below).
- **No trailing slash.** `trailingSlash: 'never'` in `astro.config.mjs`.
- **Canonical link.** Each page names its own address in
  `<link rel="canonical">` and `og:url`, built from `SITE_URL`. When
  `SITE_URL` is unset, pages emit neither (ADR-0003).
- **A club page is keyed on the id but shows only the seasons the id was a
  Brewers affiliate**, each under that season's own name (ADR-0008).
- **A post's type and slug are fixed once published.** Do not move a post to
  another type or edit its slug in Keystatic after it is live.
- **Brewers only.** No org prefix in any path.

## Consequences

- A static site cannot read a stale `{name-id}` by itself. The 404 page
  (`src/pages/404.astro`, 2026-09-28) reads the trailing id, looks it up
  in the path map, and sends the reader to the current path. That also
  covers a wrong case, a trailing slash and a bare id. It needs
  JavaScript; without it, the reader gets the 404 page and its links.
  The map and the player pages come from one list, `playerPages()`.
- Lint checks that a published post keeps its path
  (`scripts/checks/post-paths.mjs`, 2026-09-28). A post that is on
  `origin/main` and not a draft is published. A branch that deletes it,
  renames its file, moves it to another type or sets it back to a draft
  fails. A post may leave only through that file's `RETIRED` list, with a
  reason. CI fetches `main` so the check has a base.
- A new kind of page adds its row to the table above and a builder to
  `paths`, in the same PR.
