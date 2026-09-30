// Peer percentiles (#39): where a player's current-season line ranks against the
// other Brewers farm players at the same level. Pure logic. src/lib/build/peers.js
// feeds it the org.json players.
//
// The pool, in one place (CONTEXT.md, "Peer percentile"):
// - Brewers clubs only. A row counts by its team id (the #58 rule), never by
//   name. A row at a club outside the system (828824 at Springfield, a
//   Cardinals club), a level total with no team, and the all-MiLB total
//   (sportId 21) hold stats the Brewers did not see, so none of them is ranked
//   or pooled.
// - The current season only. org.json holds today's org players, so a pool for
//   an earlier season would leave out everyone who has left.
// - One pool per level (levelFor). ACL and DSL clubs are all sportId 16, so
//   they share one Rookie pool; `size` tells the reader how small it is.
// - A hitting pool and a pitching pool per level.
// - Below MIN_PA / MIN_IP the player is not ranked and is not in the pool.
import { MILB_COLUMNS } from '../../snapshot/milb.js'
import { levelFor, levelRank } from '../levels.js'
import { withRates } from './rates.js'
import { MIN_PA, MIN_IP } from './sample.js'

// Which way is good, per stat. A high percentile always means good, so a stat
// where lower is better is flipped.
// - ERA, WHIP and a hitter's K%: lower is better.
// - A hitter's BB%: higher is better. A walk is a plate appearance he won, and
//   BB% is the part of getting on base that shows discipline.
// - A pitcher's K%: higher is better.
// - A pitcher's BB%: lower is better. A walk is a free base he gave away.
// The same "BB%" label therefore points opposite ways for the two groups;
// each group's list is its own.
export const HITTING_STATS = [
  { key: 'avg', label: 'AVG', lowerIsBetter: false },
  { key: 'obp', label: 'OBP', lowerIsBetter: false },
  { key: 'slg', label: 'SLG', lowerIsBetter: false },
  { key: 'ops', label: 'OPS', lowerIsBetter: false },
  { key: 'iso', label: 'ISO', lowerIsBetter: false },
  { key: 'kPct', label: 'K%', lowerIsBetter: true },
  { key: 'bbPct', label: 'BB%', lowerIsBetter: false },
]
export const PITCHING_STATS = [
  { key: 'era', label: 'ERA', lowerIsBetter: true },
  { key: 'whip', label: 'WHIP', lowerIsBetter: true },
  { key: 'kPct', label: 'K%', lowerIsBetter: false },
  { key: 'bbPct', label: 'BB%', lowerIsBetter: true },
]
const STATS = { hitting: HITTING_STATS, pitching: PITCHING_STATS }
const GROUPS = ['hitting', 'pitching']

// The mid-rank percentile of `value` among `values` (which include it): the
// players it beats, plus half of those it ties (itself among them), over the
// group. So a tie shares one percentile and a group of n has percentiles
// strictly between 0 and 100. Floored to a whole number, so the best of 200 is
// the 99th and never the 100th. null for a group of one, which ranks against
// no one.
export function percentileRank(value, values, { lowerIsBetter = false } = {}) {
  if (values.length < 2) return null
  let worse = 0
  let equal = 0
  for (const v of values) {
    if (v === value) equal++
    else if (lowerIsBetter ? v > value : v < value) worse++
  }
  return Math.floor(((worse + equal / 2) / values.length) * 100)
}

// The rates are strings for the table (".284", "3.67", "22.4%"). Rank on the
// number the reader sees, so two lines that show the same rate tie. null stays
// null (ADR-0003).
const asNumber = (s) => {
  const n = s === null || s === undefined ? NaN : Number.parseFloat(s)
  return Number.isNaN(n) ? null : n
}

const COUNTS = Object.fromEntries(
  GROUPS.map((g) => [g, MILB_COLUMNS[g].filter((c) => !['season', 'club', 'age'].includes(c))]),
)

// One line from every Brewers row at one level. One row is the line as it
// stands. Two or more (a player who moved between two Brewers clubs at one
// level, or between ACL and DSL) add their counts and take the rates from the
// sum: a rate is not the mean of two rates. A count that is missing on any row
// stays missing on the sum, so a rate that needs it is blank (ADR-0003).
function levelLine(group, rows) {
  if (rows.length === 1) return rows[0]
  const sum = {}
  for (const c of COUNTS[group]) {
    sum[c] = rows.every((r) => Number.isFinite(r[c])) ? rows.reduce((t, r) => t + r[c], 0) : null
  }
  return withRates(group, sum)
}

// Whether a line clears the minimum sample.
const qualifies = (group, line) =>
  group === 'hitting' ? line.pa >= MIN_PA : line.outs >= MIN_IP * 3

// A player's lines for one season: [{ group, sportId, line }], one per group
// and level, highest level first. `brewersIds` is the set of Brewers club team
// ids (brewersClubIds in src/lib/model/archive.js). It does not check the
// minimum: qualifying is buildPeerIndex's job.
export function peerLines(player, season, brewersIds) {
  const lines = []
  for (const group of GROUPS) {
    const bySport = new Map()
    for (const r of player[group] ?? []) {
      if (String(r.season) !== String(season)) continue
      if (r.teamId === null || r.teamId === undefined || !brewersIds.has(r.teamId)) continue
      if (!levelFor(r.sportId)) continue
      bySport.set(r.sportId, [...(bySport.get(r.sportId) ?? []), r])
    }
    for (const [sportId, rows] of bySport) lines.push({ group, sportId, line: levelLine(group, rows) })
  }
  return lines.sort((a, b) => levelRank(a.sportId) - levelRank(b.sportId) || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group))
}

// The lines a player has this season, at Brewers clubs, that are under the
// minimum: [{ group, sportId, level: { label, name }, pa | outs }], highest
// level first. A line with no count on record is left out: we cannot say it is
// under (ADR-0003). A line over the minimum is not here, ranked or not.
export function belowMinimum(player, season, brewersIds) {
  return peerLines(player, season, brewersIds)
    .filter(({ group, line }) => Number.isFinite(group === 'hitting' ? line.pa : line.outs) && !qualifies(group, line))
    .map(({ group, sportId, line }) => {
      const { label, name } = levelFor(sportId)
      return { group, sportId, level: { label, name }, ...(group === 'hitting' ? { pa: line.pa } : { outs: line.outs }) }
    })
}

const poolKey = (group, sportId) => `${group}:${sportId}`

// The pools for one season: every qualifying line, keyed by group and level,
// and each player's own qualifying lines. `players` is any iterable of
// { id, hitting, pitching } rows with rates; the caller chooses who counts as
// an org player (src/lib/model/org.js).
export function buildPeerIndex({ players, season, brewersIds }) {
  const pools = new Map()
  const byPlayer = new Map()
  for (const player of players) {
    for (const { group, sportId, line } of peerLines(player, season, brewersIds)) {
      if (!qualifies(group, line)) continue
      const key = poolKey(group, sportId)
      pools.set(key, [...(pools.get(key) ?? []), line])
      byPlayer.set(player.id, [...(byPlayer.get(player.id) ?? []), { group, sportId, line }])
    }
  }
  return { season: String(season), pools, byPlayer }
}

// A player's percentiles: one entry for each group and level where he
// qualifies, highest level first (none for a player under the minimum or an
// unknown one). An entry is
//   { season, group, sportId, level: { label, name }, size, pa | outs,
//     stats: [{ key, label, value, pct, n }] }
// `size` is the players in the pool. `n` is how many of them have that stat
// (a blank rate leaves the pool for that stat only). `value` is the rate as
// the table shows it. `pct` is null for a group of one, or when his own rate
// is blank.
export function peerPercentilesFor(index, playerId) {
  return (index.byPlayer.get(playerId) ?? []).map(({ group, sportId, line }) => {
    const pool = index.pools.get(poolKey(group, sportId))
    const { label, name } = levelFor(sportId)
    const stats = STATS[group].map(({ key, label: statLabel, lowerIsBetter }) => {
      const values = pool.map((l) => asNumber(l[key])).filter((v) => v !== null)
      const own = asNumber(line[key])
      return {
        key,
        label: statLabel,
        value: own === null ? null : line[key],
        pct: own === null ? null : percentileRank(own, values, { lowerIsBetter }),
        n: values.length,
      }
    })
    const sample = group === 'hitting' ? { pa: line.pa } : { outs: line.outs }
    return { season: index.season, group, sportId, level: { label, name }, size: pool.length, ...sample, stats }
  })
}
