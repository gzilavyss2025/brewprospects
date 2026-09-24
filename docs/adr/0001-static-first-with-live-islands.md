# Static-first pages with live islands

**Status:** Accepted
**Date:** 2026-09-24

## Context

The site is a farm-system tracker and a blog. Rosters, ranks and season stats
change about once a day. Posts change when the owner writes. Tally, the sibling
app, is a client-rendered React PWA because it follows games pitch by pitch;
this site does not.

## Decision

Astro builds every page as static HTML at build time from nightly JSON
snapshots. Interactive or live parts are **islands**: small React components
that hydrate in the browser. The first one is the prospect card, which reads
`statsapi.mlb.com` directly (that API sends `Access-Control-Allow-Origin: *`,
checked live).

An island always renders the snapshot first and keeps it on any fetch error, so
a page is complete with JavaScript off or the API down.

## Consequences

- Pages are fast and readable by search engines.
- The owner can design one-off page types freely: an Astro page is a file.
- Data is as fresh as the last build, except inside islands.
- One production deploy per nightly data refresh, plus one per published post.
