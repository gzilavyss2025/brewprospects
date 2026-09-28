# A class is named for its job, never its shape

**Status:** Proposed
**Date:** 2026-09-28

ADR-0011 and ADR-0012 reserved this number for the naming decision in the
third token PR (roadmap Phase 2, item 7C). This is C1, docs only: the rule,
the census and the ledger. C2 renames the classes; C3 adds the lint check.
Nothing here changes CSS, markup or a check.

## Context

Adapted from Tally's `bbsbh` ADR-0084, "A block is named for its job, never
its shape," which found the same drift at a much larger scale: 156 of
Tally's classes broke its rule. This site is far smaller — the census below
counts 32 stylesheet classes in total — but the drift is the same shape.
`.rank-chip` names a pill nobody owns. `.pcard` names a box that its own
`.card` co-class draws, not `.pcard` itself — bbsbh's `.chalcard` case,
where a BEM-style name claims a shape one level down. `.club-body` and
`.table-scroll` redraw `.card`'s white ground and navy edge under names
that say nothing about a box at all.

This ADR keeps bbsbh's clause 1 (the rule) and part of clause 6 (the
word-matching test), restated for this site's own vocabulary. It leaves out
bbsbh's element grammar (`__head`, `__body`, `--variant`, `.is-state`) and
its ledger: this site has no BEM elements or UI states to name yet, and its
ledger is short enough to hold here instead of a separate file.

## Decision

### The rule

A class is named for its job — `club-head`, `rank`, `coverage` — never for
its shape. A shape word belongs only to the one class that owns the base
rule for that shape: the declarations that actually draw it. A class whose
name claims a shape it does not draw sends the next reader looking for a
box that lives somewhere else, which is exactly how `.pcard` reads today.

### Shape words

| Word | Status | Reason |
| --- | --- | --- |
| `card` | owned by `.card` | the white-stock box with the hard navy shadow; drawn once, reused by every post, player, season and club card |
| `pennant` | owned by `.pennant` | the clip-path ribbon; drawn once, reused by the level badge and the post-type label |
| `pill` | reserved, unowned | the full-round `--radius-pill` badge; drawn twice today (`.rank-chip`, `.site-nav a`) with no shared owner |
| `chip` | reserved, unowned, same shape as `pill` | `.rank-chip`'s own name already claims it for the pill shape above; this site draws one round-badge shape, not two, so the word stays retired until a `.pill` primitive exists to take it |
| `notice` | reserved, unowned | the gold-stripe callout box; drawn today by `.note`, and after the split below, by `.coverage` and `.player-note` together |
| `tag` | dropped | nothing on this site draws a label shape distinct from the pill above |
| `btn` | dropped | every control here is a plain link (`.site-nav a`) or the card itself; nothing draws a separate button chrome |
| `door` | dropped | bbsbh's reveal-panel shape; this static site has no panel that opens |
| `sheet` | dropped | no modal, drawer or bottom sheet exists here |

Started from bbsbh's list (`card`, `pill`, `chip`, `tag`, `btn`, `door`,
`sheet`, `notice`) and added `pennant`, this site's one other drawn shape.

### Owners

`.card` and `.pennant`, and no others yet. A future primitive — a `.pill`,
should one get built — takes `pill` and `chip` together, since this site
has never drawn two different round-badge shapes.

### The matching rule

A shape word matches only as the whole class name, a hyphen-delimited
segment, or a suffix — `.card`, `.club-card`, `.eventcard` — never as a run
of letters inside an unrelated word. `card` does not match inside
`cardinal` (a rival club's name, should one ever land in a slug or a
comment); `pill` does not match inside `pillar`. A future guard that reads
names at all must read a word, not a substring.

## Census

Measured on `e4e3355`, 2026-09-28. Scope: `src/styles/*.css` and every
`<style>` block (none exist in this codebase); `class=` and `className=` in
`src/components`, `src/layouts` and `src/pages`, including a class name
built inside a string (`Headshot.astro`'s `onerror` handler sets
`className: 'initials'`); `scripts/`, `test/`, `markdoc.config.mjs` and
`keystatic.config.jsx` (none of the four name a CSS class — `note` in
`scripts/checks/content-config.mjs` and in both collection configs is a
Keystatic field, a different thing with the same English word).

**32 classes**, all defined in `src/styles/components.css` (29) and
`src/styles/base.css` (3).

| Class | Job | Owns a base rule | Draws a shape | Shape word | Verdict |
| --- | --- | --- | --- | --- | --- |
| `bucket` | one roster group inside a club body (active, injured, other) | no (styles only its own children) | no | none | keep |
| `buckets` | lays a club's roster buckets out side by side | yes (grid layout) | no | none | keep |
| `brand` | the site logo and wordmark link | yes | no | none | keep |
| `card` | the card primitive: white stock, hard navy shadow, lift on hover | yes | yes (the box) | `card` (owns it) | keep — primitive |
| `club` | wraps one affiliate section, anchors `#club-{id}` | yes (margin only) | no | none | keep |
| `club-body` | the roster or table box under a club head | yes | yes (redraws `.card`'s ground and edge) | none | keep name — collapse follow-up |
| `club-head` | the accent band above `club-body`: logo, name, meta line | yes | no (accent fill, no box recipe) | none | keep |
| `club-logo-none` | a same-size blank plate when a club has no logo | yes | no | none | keep |
| `facts` | the player bio definition list | yes | no | none | keep |
| `grid` | the auto-fill card-grid layout | yes (layout only) | no | none | keep |
| `headshot` | the bordered player photo tile | yes | yes (bordered tile, gold ground — not the card's white ground) | none | keep |
| `hero` | the player-page identity block: photo, name, rank | yes (layout only) | no | none | **rename → `.player-head`** |
| `initials` | the bordered fallback avatar tile when no photo is on file | yes | yes (same recipe as `headshot`) | none | keep |
| `jersey` | the jersey-number label in a roster row | no (`.bucket .jersey`, scoped) | no | none | keep |
| `line` | the score-line text in the live prospect card | no (`.pcard .line`, scoped) | no | none | **hold** |
| `muted` | de-emphasized secondary text | yes | no | none | keep |
| `note` | two jobs today: the site's own coverage caveats, and (once written) an author's note about a player | yes | yes (gold-stripe callout box) | none (word is "note," not "notice") | **rename → split into `.coverage` and `.player-note`** |
| `num` | tabular-numeral formatting for stats and seasons | yes | no | none | keep |
| `path` | the season-by-season pennant trail on a player page | yes (layout only) | no | none | keep |
| `pcard` | the live prospect-card island shown inside a post | yes (layout only; its `.card` co-class draws the box) | no (shape belongs to the co-class) | `card` (suffix; does not own it) | **rename → `.spotlight`** |
| `pennant` | the clip-path level badge and post-type ribbon | yes | yes | `pennant` (owns it) | keep — primitive |
| `prose` | constrains post and note body width for reading | yes | no | none | keep |
| `rank-chip` | the gold rank-number pill | yes | yes (the pill) | `chip` (unowned) | **rename → `.rank`** |
| `ranked` | the `<ol>` wrapper for a ranked prospect list | yes (list reset) | no | none | keep |
| `section` | vertical spacing before a page section | yes | no | none | keep |
| `site-footer` | the navy page footer | yes | no | none | keep |
| `site-header` | the gold page header with the stitched edge | yes | no | none | keep |
| `site-nav` | the header's nav-link row | yes (layout only) | no (its `a` draws a pill — see the deferred shape count) | none | keep |
| `stats` (`table.stats`) | the stat table: alignment, sticky head, zebra rows | yes | no (table styling is not a reserved shape here) | none | keep |
| `sub` | the club-head's meta line: level, league, venue | no (`.club-head .sub`, scoped) | no | none | **rename → `.club-meta`** |
| `table-scroll` | the horizontal-scroll wrapper around a stat table | yes | yes (redraws `.card`'s ground and edge) | none | keep name — collapse follow-up |
| `wrap` | the page's max-width content gutter | yes | no | none | keep |

## Rename ledger

| Old name | New name | Files | Reason |
| --- | --- | --- | --- |
| `.pcard` | `.spotlight` | `src/styles/components.css`, `src/components/ProspectCard.jsx` | carries `card` as a suffix while its `.card` co-class draws the box (the `.chalcard` case); and "prospect" is the wrong word — CONTEXT.md already reserves "prospect" for a ranked player, and not every spotlighted player is ranked |
| `.rank-chip` | `.rank` | `src/styles/components.css`, `src/components/ProspectCard.jsx`, `src/components/RankedList.astro`, `src/pages/depth-chart.astro`, `src/pages/prospects.astro`, `src/pages/players/index.astro`, `src/pages/players/[slug].astro`, `src/pages/seasons/index.astro` | drops `chip`, a word this site retires until a `.pill` primitive exists (see shape words); `rank` states the job |
| `.club-head .sub` | `.club-meta` | `src/styles/components.css`, `src/components/SeasonClub.astro`, `src/pages/depth-chart.astro` | names the job instead of a positional abbreviation; bbsbh's five spellings of one head line (`__sub`, `__lede`, `__kicker`, `__eyebrow`, `__note`) is what a name like `sub` invites once a second one shows up |
| `.hero` | `.player-head` | `src/styles/components.css`, `src/pages/players/[slug].astro` | pairs with `.club-head`, which already names the same kind of block for a club section; "hero" is a generic web-design word that does not say this is the player identity block |
| `.note` | `.coverage` (site caveats) and `.player-note` (author notes) | `src/styles/components.css`, `src/components/ProspectCardTag.astro`, `src/components/RankedList.astro`, `src/pages/seasons/[season].astro`, `src/pages/players/[slug].astro` | one name covers two voices today: `.coverage` for the site's own words about what a page does not have (`ProspectCardTag`'s snapshot caveat, `RankedList`'s incomplete-season caveat, the season page's no-season caveat, the past-player page's archive-only caveat), `.player-note` for an author's words about a player (`players/[slug].astro`'s `NoteContent` render, currently unused — `src/content/player-notes/` holds only `.gitkeep`) |

`players/[slug].astro` gets both new classes: `.coverage.section` where
`.note.section` marks the archive-only caveat, and `.player-note.prose`
where `.note.prose` wraps `NoteContent`.

## Held rows

`.line` (`.pcard .line`, soon `.spotlight .line`) is a generic word — the
same kind of vagueness as bbsbh's `__sub`/`__lede`/`__kicker` collision —
but it has exactly one use and nothing else named "line" to be confused
with. Held rather than renamed: there is nothing to disambiguate yet.
Revisit if a second "line" class is ever proposed.

## Collapse follow-ups

Renaming is not collapsing. `.club-body` and `.table-scroll` both draw
`.card`'s white ground (`background: var(--surface-card)`) and navy edge
(`border: 2px solid var(--line-edge)`) in their own rules, independent of
`.card`. Neither carries a shape word — their names already say their job —
so this ADR does not rename either. A follow-up should let them compose
`.card`'s declarations instead of repeating them, so the box recipe has one
home; that is a CSS change, not a naming one, and it waits for its own PR.

`.note` does not join this list. It shares `.card`'s white ground
(`background: var(--surface-card)`) and a radius, but not the navy edge — it
has a one-sided gold accent border instead — and no shadow. A shared
background and a radius are not "the card shape" on their own; several
things use `--surface-card` (the table head's even rows, for one) without
redrawing a card.

`.headshot` and `.initials` also do not join this list, for a matching
reason in the other direction: both have the edge, the radius and the
shadow, but their ground is `--brand-gold`, a photo frame, not `.card`'s
white ground. Same recipe, different fill; not the same box.

## The note stripe

`.coverage` and `.player-note` both keep `.note`'s gold left stripe, in one
rule with both selectors. This is the one chrome exception to "gold means
Brewers only" (ADR-0012, CONTEXT.md's "Brand color"): the stripe is not a
Brewers mark, it is the site's own chrome, and ADR-0012 already recorded
that it stays gold "until the class-naming PR looks at notes." This is that
look, and the answer is still gold, for the reason ADR-0012 gave: it keeps
the light theme pixel-identical. Recoloring the stripe would be a visual
change riding along inside a rename-only PR, which this pass avoids on
principle (see Consequences).

## The shape count, deferred

A stricter guard — one that counts declarations actually drawn (a
`border-radius: var(--radius-pill)`, the card's four-declaration recipe)
instead of reading class names — is not built here. Recording why: run
today, it would fail `.rank-chip` and `.site-nav a` (both draw the pill
shape; neither is its one owner) and `.club-body` and `.table-scroll` (both
draw the card's ground and edge; neither is `.card`). It could only pass
with a list of known, allowed redraws — bbsbh's own shape guard needed
exactly that kind of allowlist for its BEM box prefixes — and this repo
does not copy Tally's ratchets (`docs/roadmap.md`, "Do not copy from
Tally"). The shape count can land once the collapse follow-ups above are
done and there is nothing left it would have to allow.

## What C3 does not cover

C3's lint check is a text check over `src/styles/*.css`, `class=` and
`className=`. It cannot see a class name assembled at runtime. This site
has exactly one such case today: `Headshot.astro`'s `onerror` handler
builds `className: 'initials'` inside a JS string bound to a DOM API call,
not JSX or Astro markup. The census above found it by reading the string by
hand, not by the pattern C3's guard will use. `.initials` is not renamed by
this ADR, so the gap costs nothing today — but C3 should say, the way
ADR-0011's raw-value check does, exactly which patterns it reads and which
it cannot: a class name built by string interpolation or `Object.assign`
is invisible to it.

## Consequences

- **The renames ride along with nothing else.** This ADR renames nothing
  itself; C2 does the five renames above, file by file, with no CSS or
  behavior change bundled in. A pure rename sweep is the hardest change to
  review and the easiest to get wrong, because nothing on screen moves and
  a missed call site fails silently — exactly the risk `checkContentConfig`
  and the raw-value check exist to catch for other kinds of drift.
- **The held row and the collapse follow-ups are not renames.** `.line` is
  held because there is no second "line" to disambiguate from yet.
  `.club-body` and `.table-scroll` keep their names and wait for a CSS
  change that gives `.card`'s box recipe one home instead of three.
- **The shape count is future work, not this PR's job.** It needs the
  collapse follow-ups done first, or it starts by failing four classes this
  ADR just decided not to rename.
- **The lint check is C3's, and it has a known blind spot.** A class name
  built at runtime — today, only `.initials` — will not be seen by a guard
  that reads `class=` and `className=` in source text.
