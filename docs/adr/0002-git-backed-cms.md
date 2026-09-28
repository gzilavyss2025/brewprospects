# Posts live in git, edited through Keystatic

**Status:** Accepted
**Date:** 2026-09-24

## Context

The owner wants to write posts in a browser, including on a phone, and to be
creative with page types. A hosted CMS would add an account, a free-tier limit,
and content outside the repo.

## Decision

Keystatic runs at `/keystatic`. It stores each post as a Markdoc file in
`src/content/{type}/`. In dev it writes to the local checkout. In production
(`PUBLIC_KEYSTATIC_STORAGE=github`) it commits through a GitHub App to a
branch prefixed `post/`, so a draft never reaches `main` until the owner merges
it.

Amended 2026-09-28: `branchPrefix` does not do this alone. The first live
save went straight to `main`. Keystatic asks for a new branch only when
GitHub refuses a save to `main`. So the repo is public, and a ruleset on
`main` requires a PR, with no admin bypass (Keystatic saves as the owner).
The nightly data job pushes with a deploy key, the ruleset's one bypass.

Data blocks inside a post are Keystatic content components mapped to Markdoc
tags of the same name. The first is `prospect-card`.

## Consequences

- Every post has git history, and Claude can read and edit posts like code.
- Publishing is a merge, and a merge is a deploy.
- The Keystatic schema and the Astro content schema must match field for field.
- Production editing needs a one-time GitHub App setup (see README).
- Drafts on `post/*` branches are public, because the repo is. Only the
  site hides them.
