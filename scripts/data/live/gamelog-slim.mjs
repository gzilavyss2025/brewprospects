// Pure shaping for gen-gamelog.mjs: a batched /people person with gameLog
// stats in, counts-only game rows out (docs/adr/0015). No network here, so the
// tests can check it against captured responses (test/gamelog.test.js).
//
// Field paths checked against test/fixtures/people-gamelog-2026.json and the
// three per-player game logs, all captured 2026-09-29: `date`, `isHome`,
// `isWin`, `team`, `sport.id`, `opponent`, `game.gamePk`, `game.gameNumber`,
// and in `stat`: plateAppearances, atBats, hits, doubles, triples, homeRuns,
// runs, rbi, baseOnBalls, strikeOuts, hitByPitch, sacFlies (hitting) and
// gamesStarted, outs, hits, runs, earnedRuns, baseOnBalls, strikeOuts,
// battersFaced (pitching). `outs` is on every pitching row; the
// `inningsPitched` string is not stored.

const num = (v) => (Number.isFinite(v) ? v : null)
const bool = (v) => (typeof v === 'boolean' ? v : null)

// "2026-06-04" becomes 20260604. Anything else is not a date we can key on.
function dateNumber(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '')
  return m ? Number(m[1] + m[2] + m[3]) : null
}

// Stat name in the API, by the name a row stores it under.
const COUNTS = {
  hitting: {
    pa: 'plateAppearances', ab: 'atBats', h: 'hits', d: 'doubles', t: 'triples', hr: 'homeRuns',
    r: 'runs', rbi: 'rbi', bb: 'baseOnBalls', so: 'strikeOuts', hbp: 'hitByPitch', sf: 'sacFlies',
  },
  pitching: {
    gs: 'gamesStarted', outs: 'outs', h: 'hits', r: 'runs', er: 'earnedRuns',
    bb: 'baseOnBalls', so: 'strikeOuts', bf: 'battersFaced',
  },
}

// One game row, or null when the split has no gamePk or no date: the row
// could not be told from another game's (docs/adr/0003). A count the API did
// not send is null, never 0; a real 0 (a pinch runner's plateAppearances)
// stays 0.
export function slimGameLogRow(group, split) {
  const gamePk = num(split?.game?.gamePk)
  const date = dateNumber(split?.date)
  if (gamePk === null || date === null) return null
  const row = {
    gamePk,
    date,
    gameNumber: num(split.game.gameNumber),
    sportId: num(split.sport?.id),
    teamId: num(split.team?.id),
    team: split.team?.name ?? null,
    oppId: num(split.opponent?.id),
    isHome: bool(split.isHome),
    isWin: bool(split.isWin),
  }
  for (const [key, field] of Object.entries(COUNTS[group])) row[key] = num(split.stat?.[field])
  return row
}

// The splits of one group. A hydrate with both groups sends an empty block
// (`splits: []`) for the group a player has no line in (docs/api.md), so the
// block is found by group.displayName, never by place. No block, and a block
// with no `splits`, both give [].
export function blockSplits(person, group) {
  return (person?.stats ?? [])
    .filter((b) => b?.group?.displayName === group)
    .flatMap((b) => b.splits ?? [])
}

// { hitting, pitching, opponents } for one person. `opponents` maps a team id
// to the name the rows showed, so a row can store the id alone.
export function slimGamelogPerson(person) {
  const opponents = {}
  const rows = {}
  for (const group of ['hitting', 'pitching']) {
    rows[group] = blockSplits(person, group).flatMap((split) => {
      const row = slimGameLogRow(group, split)
      if (!row) return []
      if (row.oppId !== null && split.opponent?.name && !(row.oppId in opponents)) {
        opponents[row.oppId] = split.opponent.name
      }
      return [row]
    })
  }
  return { ...rows, opponents }
}
