# Glossary

The terms this site uses, what each one means here, and the words to avoid.
Code, docs and page copy use the same words. Add a term when a PR introduces
one. Format from bbsbh's `CONTEXT.md`.

## The organization

**Org**: the Milwaukee Brewers organization, MLB team id 158 (`ORG_ID`). The
site covers this org only.
_Avoid_: "team" for the whole org. A team is one club.

**Affiliate**: a minor-league club whose `parentOrgId` is 158 in a given
season. The set changes by season. Read it per season from the API, never
from today's list (`docs/api.md`).
_Avoid_: "farm team" in code. It is fine in page copy.

**Club**: one affiliate in one season, with that season's name. A team id is
not a club: the id can pass to another club (ADR-0008).

**Level**: where a club plays, by sportId: AAA (11), AA (12), High-A (13),
Single-A (14), Rookie (16). `src/lib/model/levels.js` holds the names, the short
labels for tables (AAA, AA, A+, A, ROK) and the order.
_Avoid_: "Low-A" and "Class A Advanced". Those are the old names.

**Complex club**: a Rookie-level club at the org's complex: the ACL Brewers
(Arizona) and the DSL clubs (Dominican Republic). No ballpark guide and no
researched colors.

**Full-season club**: an affiliate at AAA, AA, High-A or Single-A.

## Players

**Org player**: a player on any affiliate's full-season roster in the current
season, except a big-leaguer there only on a rehab assignment. `src/lib/model/org.js`
is the definition (ADR-0005).
_Avoid_: "prospect" as a synonym. Not every org player is a prospect.

**Prospect**: a player on a ranked list: the MLB Pipeline Brewers list, or
the Top 100.

**Spotlight**: a player featured in a post's live prospect card (`.spotlight`,
ADR-0010). Not "prospect": not every spotlighted player is on a ranked list.

**Pipeline rank**: a player's place on the MLB Pipeline Brewers list (org
rank, about 30 names) or on its overall Top 100 (top rank) (ADR-0004).

**Top 100 history**: which Brewers were on each preseason Top 100 list, from
2006 (ADR-0007). A ranked player counts as a Brewer for a season only when
the rosters show him in the system that season.

**Past player**: a player who appears only in the archive. His page shows
only his seasons with Brewers affiliates, and says so.

## Data

**Snapshot**: a JSON file in `src/data/` written by a generator. Pages read
snapshots at build time through `src/lib/build/`. A snapshot is replaced only
by a good run; a bad run keeps the last good file (ADR-0003).

**Current season**: the season in `org.json`. It changes when the new
season's rosters are complete, in spring, not on January 1.
_Avoid_: reading the season from the clock.

**Archive season**: one frozen file in `src/data/archive/`, for a season
before the current one (ADR-0006).

**Fixture**: a captured API response in `test/fixtures/`, listed with its
date and source URL in `manifest.json`.

**Drift**: a field a fixture has and a fresh API response lacks. The nightly
job checks for it.

## Words

**Spacing step**: one unit of the 4px spacing scale, named `--space-*`.
Step 4 is 16px. Fractional steps keep the existing compact spacing; a hyphen
marks the decimal (`--space-1-5` is 6px). See ADR-0011 for the full audit.

**Radius token**: a shared corner radius in `tokens.css`, named `--radius-*`.
The pill radius is 999px; the round radius is 50%.

**Duration token**: a shared motion time, named `--dur-*`. The current card
hover uses `--dur-fast` (160ms).

**Primitive**: a class that owns the base rule for a drawn shape — the one
place its CSS lives. `.card` and `.pennant` are today's primitives
(ADR-0010).

**Shape word**: a word in a class name that names a drawn shape (`card`,
`pill`, `notice`, `pennant`) instead of a job. Reserved for whichever class
owns that shape (ADR-0010).
_Avoid_: giving a class a shape word it does not own.

**Coverage note**: the site's own caveat about what a page's data does or
does not cover ("no season on record," "seasons since 2006 only"), styled
`.coverage`. Not a player note: an author's own words about a player, from
the `playerNotes` collection, styled `.player-note`.

**Color role**: a color token named for its job, `--{role}-{name}`, in
`tokens.css`. The roles are `surface` (paper, card, logo plate), `text` (ink,
ink-soft, link, on-navy), `line` (rule, stitch, edge), `focus` (ring, halo),
`brand` (navy, gold) and `club` (bar, on-bar). Each role has a light and a
dark value (ADR-0012).
_Avoid_: naming a color token for its hue alone, such as `--blue`.

**Brand color**: Brewers navy or gold, the same in every theme. Gold means
"Brewers" and nothing else.

**Club bar**: the band in an affiliate's own color at the top of its section
or card (`--club-bar`), with readable text on it (`--club-on-bar`). A club
with no researched color, or one that fails 4.5:1, gets Brewers navy.
_Avoid_: "club accent" as a token. There is no `--club-accent`.

**Theme**: a set of color role values, light (`:root`) or dark
(`[data-theme="dark"]`, navy-black). The reader's stored choice picks one;
with none, the OS setting does. Without JavaScript the page is light
(ADR-0013).

**Postseason**: baseball's October, and every league's post-regular-season
rounds. Lint fails on the other word.

**Missing**: a value the source did not send. Show `—` or a sentence. Never
fill it (ADR-0003).
_Avoid_: "N/A", `0`, or a guess.
