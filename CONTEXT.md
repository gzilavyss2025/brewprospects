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

**Level**: where a club plays, by sportId: AAA (11), AA (12),
High-A (13), Single-A (14), Short-season A (15, before 2021), Rookie Advanced
(5442, 2019 only), Rookie (16). `src/lib/model/levels.js` holds the names, the
short labels for tables (AAA, AA, A+, A, SS-A, ROK+, ROK) and the order.
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
his whole minor-league career when `careers.json` has him, and says
"through {season}". With no entry it shows only his seasons with Brewers
affiliates, and says so. His major-league rows show every club.

**Player pages**: every org player and every past player. Each has a page
at `/players/{name-id}`. `playerPages()` in `src/lib/build/archive.js` is
the one list.

**Player index**: `/players/a-z`, one page that lists every player with a
page, grouped by the first letter of his last name. Each row shows his
position and his years in the Brewers system (first to last affiliate season,
plus this season for a current player). A player with no `lastName` goes under
"#". The grouping is in `src/lib/model/player/a-z-index.js`. A search box
(shown only when JavaScript runs) hides every row that does not match: each
word of the query must appear in the row's folded name (`data-search`), in any
order. A letter with no match hides, and the jump bar shows it as plain text.
`matchesQuery` is in the same file.

**Major-league rows**: a player's MLB year-by-year lines, from
`src/data/mlb.json` (`gen-mlb`). MLB is not a level: `LEVELS` and the level
path never hold it (ADR-0014).

**Reached MLB**: a player with an `mlbDebutDate` on file. The Stats API
sends it only for players who debuted. It decides whether the headshot
chain tries the MLB shots.
_Avoid_: "big-leaguer" in code. Rehab and debut are different questions.

**Headshot chain**: the photos a player page tries, in order: `silo` (the
studio shot) and then `67` (an older MLB shot) if he reached MLB, then
`milb`, then his initials. The last step never fails. `src/lib/identity/headshot.js` is the definition.

**Path map**: `/player-paths.json`, player id to current path, for every
player page. The 404 page reads it to send a stale `{name-id}` to the
current path (ADR-0009).

## Data

**Snapshot**: a JSON file in `src/data/` written by a generator. Pages read
snapshots at build time through `src/lib/build/`. A snapshot is replaced only
by a good run; a bad run keeps the last good file (ADR-0003).

**Level page**: `/levels/{level-slug}`, one per entry in `LEVELS`. It lists the
Brewers clubs at that level, one row per club-season, with each season's own
club name (ADR-0008) and its record. `levelHistory()` in
`src/lib/model/level-history.js` builds the rows. Slugs are in ADR-0009. The
API files the Pioneer League before 2019 under Rookie, so Helena is on the
Rookie page.

**Gap row**: a season with no Brewers club at the level being listed. It is
shown as "No {level} club", not as a blank or a guess. Not the same as 2020,
which has no minor-league season at any level.

**Current season**: the season in `org.json`. It changes when the new
season's rosters are complete, in spring, not on January 1.
_Avoid_: reading the season from the clock.

**Archive season**: one frozen file in `src/data/archive/`, for a season
before the current one (ADR-0006). It is packed: the roster is three tables,
`roster`, `hitting` and `pitching` (ADR-0015).

**Careers file**: `src/data/archive/careers.json`. The whole minor-league
career of every past player, with any club (ADR-0006). It is packed: each
club is stored once and each row is an array. `throughSeason` is the season
it was fetched for. Not a season file.

**Packed snapshot**: a file in `src/data/` whose rows are arrays, with the
column names stored once in `columns` and each club stored once in `clubs`
(ADR-0015). It stores counts, not rates. `org.json`, `mlb.json`,
`careers.json` and every archive season file are packed. `src/lib/build/`
unpacks each one.

**Game log**: one row for each game a player played in the current season,
at any club, in `src/data/gamelog.json` (#35). A row has the game's `gamePk`
(its key: a doubleheader has two rows with one date), the date as yyyymmdd,
the club, the opponent's team id and counts only. A game he missed has no
row. The file is packed and written by `scripts/data/live/gen-gamelog.mjs`;
`gamelogFor(id)` in `src/lib/build/data.js` reads it, newest game first. A
row can name a club outside the system: tell it apart by team id.
_Avoid_: "box score" (that is every player in one game).

**Rate stat**: a stat computed from counts, such as AVG, OPS, IP or ERA. It
is computed in `src/lib/model/player/rates.js` and never stored.
_Avoid_: "derived field" in docs; say rate stat.

**K%, BB% and K-BB%**: strikeouts, walks, and strikeouts minus walks, each as a
share of the batters a player faced, to one decimal. A hitter's share is of
plate appearances; a pitcher's is of batters faced. K-BB% is the exact
(K - BB) / batters faced, so it can sit 0.1 from the K% and BB% cells beside it.
K/9 is a different stat: strikeouts per nine innings.

**Peer percentile**: where a player's line for the current season ranks among
Brewers farm players at the same level, from `src/lib/model/player/percentiles.js`.
It is not a league percentile: the site cannot rank against all of MiLB.
- The pool is Brewers clubs only, by team id. A row at a club outside the
  system, a level total with no team and the all-MiLB total never count.
- One pool per level. The ACL Brewers and both DSL clubs are all sportId 16, so
  they share one Rookie pool. Hitters and pitchers have separate pools.
- The current season only. Earlier seasons get no percentile: `org.json` holds
  today's org players, so an earlier pool would miss everyone who left.
- The percentile is the mid-rank: the players below the line plus half of those
  that tie it (itself included), over the pool, floored to a whole number, so it runs
  from 0 to 99. Lines that show the same rate tie. A pool of one has none.
- A high percentile is always good. ERA, WHIP and a hitter's K% are flipped. A
  hitter's BB% is higher-is-better; a pitcher's BB% is lower-is-better.
- A player with two Brewers clubs at one level (or ACL and DSL) is ranked once,
  on the sum of his Brewers rows at that level, not once per club.
- Each percentile carries the pool size, so the page can say how small it is.

**Sample minimum**: the plate appearances or innings a line needs before it is
ranked: `MIN_PA` (100) and `MIN_IP` (30), in `src/lib/model/player/sample.js`.
Below it a player gets no rank and is not in the pool; the page shows `—`. A
test fails when a second copy of either number appears in `src/`.

**Stat definition**: the one sentence under a stat header on a player table,
from `src/lib/model/player/glossary.js`. A header with one is a button: a tap,
a click or a keyboard focus shows the sentence under the table, and a screen
reader reads it with the header. Add an entry when a column lands; a test fails
when a stat column has none. A label can mean two things by group (R is runs
scored for a hitter, runs allowed for a pitcher), so each group has its own list.

**Club record**: one club's regular-season wins, losses, win percentage,
division rank, runs scored and runs allowed in one season. It lives in the
`standings` block of a season file and of `org.json`, keyed by team id, and is
null when the API has none. The postseason is not in it. `src/lib/model/standings.js`
is the definition.
_Avoid_: "standings" for one club's line. Standings are the whole league's table.

**Fixture**: a captured API response in `test/fixtures/`, listed with its
date and source URL in `manifest.json`.

**RSS feed**: the site's own feed at `/rss.xml`, built by `@astrojs/rss`
from the posts `/posts` shows. Not "feed" alone: in this repo, a bare "feed"
means an MLB Stats API response.

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
`brand` (navy, gold), `club` (bar, on-bar) and `chart` (four OPS bands and
two lines). Each role has a light and a dark value (ADR-0012).
_Avoid_: naming a color token for its hue alone, such as `--blue`.

**Brand color**: Brewers navy or gold, the same in every theme. Gold means
"Brewers" and nothing else.

**Chart color**: a color in the `chart` role (`--chart-band-*` and
`--chart-line-*`). It draws a bar or a line, so it needs 3:1 on paper and on
card in both themes (the `GRAPHIC` line in `tokens.css`). Unlike a brand or
club color, it may differ between themes.

**OPS band**: one of four ranges of a game's OPS: below .500, .500 to .799,
.800 to 1.099, and 1.100 and up. The edges live in
`src/lib/model/player/gamelog/ops-band.js`. Each band has a key and a text
label, so it reads without color. Its colors are the `chart` role. It is not
the club bar.
_Avoid_: "club bar band", and naming a band for its color.

**OPS chart**: the bar chart on a hitter's page, one bar for each game in his
game log, oldest on the left (#37). A static SVG drawn at build time by
`OpsChart.astro`, with the math in
`src/lib/model/player/gamelog/ops-chart-layout.js`. The scale is fixed, 0 to
2.000: a game above it is clipped at the top and marked. A game with no value
(missing) has no bar, only a tick under the baseline. A game for a club
outside the system has a diamond above its bar. Each band also has a fill
pattern, and a closed table of every game sits under the chart, so it reads
without color.

**Season OPS line**: the level line across the OPS chart. It is the OPS of the
summed counts of every charted game, never the mean of the game OPS values.
It is drawn solid.

**Rolling OPS**: the OPS of the last 10 games, drawn as a dashed line on the
OPS chart. A point needs at least 30 plate appearances in those games, and the
line breaks where a point is missing. `ROLLING_GAMES` and `ROLLING_MIN_PA` are
in `ops-chart.js`; they are not the season minimum in `sample.js`.

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
