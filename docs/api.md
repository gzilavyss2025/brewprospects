# MLB Stats API: what this site uses

Base URL: `https://statsapi.mlb.com/api/v1`. No key and no login. CORS is open,
so a browser may call it (the prospect card does).

The API has no official documentation. The community wiki at
https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints is the usual map, and
it says it is not official. MLB changes the API without notice. Use of MLB data
is subject to http://gdx.mlb.com/components/copyright.txt.

Parts of this file come from bbsbh's `docs/MLB_STATS_API.md` (audited live on
2026-08-26). Rows marked **(bbsbh)** were checked there, not here.

## Every call this site makes

| Caller | Request | Why |
| --- | --- | --- |
| `gen-org` | `/teams?sportIds=11,12,13,14,16&season={y}` | Affiliates: filter `parentOrgId === 158` |
| `gen-org` | `/teams/{id}/roster?rosterType=fullSeason&season={y}` | Each affiliate's roster |
| `gen-org`, `gen-archive` | `/standings?leagueId={id}&season={y}&standingsTypes=regularSeason` | Each club's record (`src/lib/model/standings.js`). One request per league. The league id is `league.id` on the `/teams` row |
| `gen-org` | `/people?personIds={40 ids}&hydrate=draft,stats(group=[hitting,pitching],type=[yearByYear],leagueListId=milb_all)` | Bio and every MiLB season |
| `gen-archive` | `/teams?sportIds=11,12,13,14,15,16,5442&season={y}` | Affiliates for a past season, and each club's league id |
| `gen-archive` | `/teams/{id}/roster?rosterType=fullSeason&season={y}&hydrate=person(stats(type=season,group=[hitting,pitching],sportId={s},season={y}))` | A past roster with each line |
| `gen-archive` | `/teams/158/roster?rosterType={fullSeason,nonRosterInvitees}&season={y}` | Milwaukee's roster (ADR-0007) |
| `gen-archive` | `/people?personIds={40 ids}&hydrate=draft` | Bios for past players |
| `gen-careers` | `/people?personIds={40 ids}&hydrate=stats(group=[hitting,pitching],type=[yearByYear],leagueListId=milb_all)` | A past player's whole MiLB career (ADR-0006) |
| `gen-prospect-history` | `/people?personIds={ids}` | Names the archive does not know |
| `gen-mlb` | `/people?personIds={40 ids}&hydrate=stats(group=[hitting,pitching],type=[yearByYear],sportId=1)` | Every MLB season (ADR-0014) |
| `ProspectCard` (browser) | `/people/{id}?hydrate=currentTeam,stats(group=[hitting,pitching],type=[season],leagueListId=milb_all)` | The live card (`src/lib/model/card.js`) |

Not the Stats API:

- **MLB Pipeline ranks** come from an MLB.com page, not an API (ADR-0004).
- **Team logos:** `https://www.mlbstatic.com/team-logos/{teamId}.svg`. Only
  the current logo for an id (ADR-0008).
- **Headshots:** `https://img.mlbstatic.com/mlb-photos/image/upload/w_{w},q_auto:best/v1/people/{id}/headshot/{kind}/current`,
  where `kind` is `silo` (the studio shot, for players who reached MLB), `67`
  (an older MLB shot; some retired players have it and no `silo`) or `milb`.
  A player with no photo of that kind returns 404. We never add the `d_`
  default parameter: it turns a miss into a generic silhouette.
  `headshotUrl()` in `src/lib/identity/affiliates.js` builds each kind.

Each test fixture's source URL is in `test/fixtures/manifest.json`. The
nightly `scripts/data/drift.mjs` refetches them and fails on a missing field.

## Parameters

- **`hydrate`** pulls related objects into one response. Pass
  `hydrate=hydrations` to have an endpoint list the hydrations it accepts
  **(bbsbh)**.
- **`fields`** prunes a response to the keys you name, for example
  `fields=people,id,fullName`. We do not use it yet. Using it would also
  document which paths we read **(bbsbh)**.
- **`personIds`** takes a batch. We send 40 per request.
- **`leagueListId=milb_all`** puts every MiLB level into one stats block.
  Without it, a stats hydrate returns MLB rows only. Checked 2026-09-25:
  person 815908's `yearByYear` has no rows without it, and six with it.
- **Club names in `yearByYear`** can be today's name, not the season's.
  Checked 2026-09-29: team 406 is "ACL Brewers" in 2016 to 2018, and the
  roster feed says "AZL Brewers". A Brewers line keeps the archive's name.
- **`sportId=1`** in the same hydrate returns MLB rows only. A player with
  none has no stats block. Checked 2026-09-29: person 111904 has 19 hitting
  rows, and 815908 has none. A traded season has a split per club plus one
  with no `team` and `numTeams` set.
- **`season`**: pass it. Without it, `type=season` means the current season,
  and a response captured today changes tomorrow.

## sportIds

| id | Level |
| --- | --- |
| 1 | MLB |
| 11 | Triple-A |
| 12 | Double-A |
| 13 | High-A |
| 14 | Single-A |
| 15 | Short-season A (before 2021) |
| 5442 | Rookie Advanced, 2019 only; retired, not in /sports; checked 2026-09-29 |
| 16 | Rookie: ACL and DSL (was AZL and GCL before 2021) |
| 17 | Winter leagues, including the Arizona Fall League |

## Known quirks

Checked on this site unless marked.

- **Team ids are reused.** 249 was the Carolina Mudcats and is the Wilson
  Warbirds. 559 was the Huntsville Stars and is another org's club now.
  Complex clubs rename often (AZL to ACL). Store the season's own name
  (ADR-0008).
- **Parent orgs change by season.** Read them per season from
  `/teams?sportIds&season` (the 2021 reorganization). `teams/affiliates`
  shows only the current state **(bbsbh)**.
- **A new season exists before its rosters do.** On 2026-09-25, 2027 listed
  all seven affiliates with empty rosters. Rosters fill in during spring.
- **A club's record is `/standings`, by league id.** The league id is on the
  `/teams` row without any hydrate. `hydrate=league` only adds detail
  (`abbreviation`, `numGames`, `seasonDateInfo`). Checked 2026-09-29: league
  128 in 2019 (Vibes 32-43), 121 in 2006, 130 in 2010.
- **A standings response has one `records` entry per division.** Read every
  `teamRecords` row in all of them. `team.name` is only the nickname
  ("Vibes"), so key on `team.id`. `wins`, `losses`, `runsScored` and
  `runsAllowed` are numbers. `winningPercentage`, `divisionRank`,
  `leagueRank` and `gamesBack` are strings (".427", "3", "21.5"). Each row also
  carries a large `records` block of splits that we drop.
- **A league with no divisions sends no `divisionRank`.** The Arizona League had
  none from 2006 to 2008 (club 406). The record is kept and the rank is
  missing (ADR-0003).
- **One league can hold two of our clubs.** AZL Brewers Blue (5430) and Gold
  (406) play in league 121 in 2019. Ask for the league once.
- **The DSL clubs before 2010 have no standings.** Their `/teams` row has no
  `league`, and the API returns no standings for them (2006 to 2009, checked
  2026-09-29). They also have no roster, so the archive drops them and no
  archive club has a null record.
- **Old DSL clubs have no rosters.** Before 2010 the teams list names DSL
  clubs that fielded no roster. The archive drops them.
- **A player who changed clubs at one level** gets one split per club plus a
  total with no team (Biloxi 2025, Raúl Alcantara). Keep the split for the
  club you mean.
- **2020 has no MiLB season.** Milwaukee's `fullSeason` (44) and
  `nonRosterInvitees` (25) rosters still exist.
- **Placeholder strings** such as `.---` stand for a missing rate stat. Store
  them as missing (ADR-0003).
- **`/stats` returns 50 rows** unless you pass `limit` **(bbsbh)**.
- **A game log is regular season** unless you name the type. For the
  postseason use `gameType=F,D,L,W`, not `P`: with `P`, the pitching log
  writes `P` into every row **(bbsbh, ADR-0069 there)**.
- **Not in the API:** club colors, historical logos, MiLB uniforms, and
  Statcast data at most MiLB parks.

## Worth trying later

- `people/changes?updatedSince={date}` could cut the nightly person fetches
  **(bbsbh: unused there)**.
- `/teams/{id}/roster?date={yyyy-mm-dd}` gives a roster as of one day
  **(bbsbh)**.
- `/league?sportId={s}&season={y}` has `seasonDateInfo`, the reliable season
  start and end for a level **(bbsbh ADR-0079)**.
