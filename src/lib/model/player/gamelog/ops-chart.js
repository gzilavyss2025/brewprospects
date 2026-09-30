// The per-game OPS chart logic (#37). Pure: game log rows in, chart data out.
// It draws nothing and picks no color. The component that draws the bars reads
// these entries, and reads the band `key` to pick a look (see ops-band.js).
//
// Rows are the hitting rows of gamelogFor(id), counts only (ADR-0015). Every
// OPS here comes from ops() in rates.js. A game is never stored with a rate.
// A missing value beats a wrong one (ADR-0003): a game with no plate
// appearances, or with a count the API did not send, has no bar.
import { ops } from '../rates.js'
import { opsBand } from './ops-band.js'
import { compareGames } from './gamelog.js'

// The rolling line looks at 10 games in a row, and draws a point only when
// those games hold 30 plate appearances. This is not the season minimum in
// sample.js (100 PA). It is a different number for a different job.
export const ROLLING_GAMES = 10
export const ROLLING_MIN_PA = 30

// The counts ops() reads, and pa. A sum of games needs every one of them.
const OPS_COUNTS = ['h', 'd', 't', 'hr', 'ab', 'bb', 'hbp', 'sf']
const SUMMED = ['pa', ...OPS_COUNTS]

// The OPS string of one game, or null when there is no value to draw. PA is
// checked before ops(): at 0 PA, ops() gives ".000", and that would draw a 0
// bar for a game the player did not bat in. A walk-only game (PA above 0, AB
// 0) is a real value.
function gameOps(row) {
  if (!Number.isFinite(row.pa) || row.pa === 0) return null
  return ops(row)
}

// One entry per row, keyed on gamePk (a doubleheader is two rows with one
// date), oldest game first. No row is dropped. `brewersIds` is the Set from
// brewersClubIds(org): a game is `outside` when its club is not in it.
export function chartGames(rows, brewersIds) {
  return [...rows].sort(compareGames).map((row) => {
    const value = gameOps(row)
    return {
      gamePk: row.gamePk,
      date: row.date,
      gameNumber: row.gameNumber,
      sportId: row.sportId,
      teamId: row.teamId,
      team: row.team,
      opp: row.opp,
      isHome: row.isHome,
      isWin: row.isWin,
      outside: !brewersIds.has(row.teamId),
      pa: row.pa, ab: row.ab, h: row.h, d: row.d, t: row.t, hr: row.hr,
      r: row.r, rbi: row.rbi, bb: row.bb, so: row.so, hbp: row.hbp, sf: row.sf,
      ops: value,
      band: opsBand(value),
      missing: value === null,
    }
  })
}

// The sums of some games, or null when any of them lacks a count. A null is
// not a zero: adding it to a number would quietly give the number.
function sumCounts(games) {
  const sums = {}
  for (const key of SUMMED) {
    let total = 0
    for (const g of games) {
      if (!Number.isFinite(g[key])) return null
      total += g[key]
    }
    sums[key] = total
  }
  return sums
}

// The season OPS: add the counts of every charted game, then call ops() once.
// Never the mean of the game strings. Games at clubs outside the system are
// charted, so they are in the sum. null when no game is charted.
export function seasonOps(games) {
  const charted = games.filter((g) => !g.missing)
  if (charted.length === 0) return null
  const sums = sumCounts(charted)
  return sums && ops(sums)
}

// Points of the rolling line. Games are oldest first. Each full window of
// `size` games in a row has a point, when its plate appearances reach
// ROLLING_MIN_PA. A game with 0 PA is one of the games in a window and adds 0.
// A window under the minimum, or with a count missing, has no point: it is
// left out, not drawn as .000. A point is { gamePk, index, ops, pa }: the
// window's newest game, its place in `games`, the OPS of the summed counts
// and the summed PA.
export function rollingOps(games, size = ROLLING_GAMES) {
  if (!Number.isInteger(size) || size < 1) return []
  const points = []
  for (let index = size - 1; index < games.length; index++) {
    const sums = sumCounts(games.slice(index - size + 1, index + 1))
    if (!sums || sums.pa < ROLLING_MIN_PA) continue
    const value = ops(sums)
    if (value !== null) points.push({ gamePk: games[index].gamePk, index, ops: value, pa: sums.pa })
  }
  return points
}

// The names of the clubs outside the system that the games were played for,
// each once, sorted. A game with no team name adds nothing.
export function outsideClubs(games) {
  const names = games.filter((g) => g.outside && g.team).map((g) => g.team)
  return [...new Set(names)].sort()
}

// Everything the chart needs from one player's hitting rows:
// - games: the entries, oldest first
// - season, rolling: the two lines above
// - outsideClubs: names for the note about games outside the system
// - charted, missing: how many games have a value and how many do not
export function opsChart(rows, brewersIds) {
  const games = chartGames(rows, brewersIds)
  const missing = games.filter((g) => g.missing).length
  return {
    games,
    season: seasonOps(games),
    rolling: rollingOps(games),
    outsideClubs: outsideClubs(games),
    charted: games.length - missing,
    missing,
  }
}
