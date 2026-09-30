// The per-game OPS chart logic (#37), in src/lib/model/player/gamelog/ops-chart.js.
// Fixture gamelog-hitter-2026.json (captured 2026-09-29): 682633, Biloxi x4 then
// Nashville, a doubleheader on 2026-06-04 whose game 2 has 0 PA. Players 695501
// and 678225 come from the real snapshot, which changes nightly: rules only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slimGameLogRow } from '../scripts/data/live/gamelog-slim.mjs'
import { ops } from '../src/lib/model/player/rates.js'
import { opsBand } from '../src/lib/model/player/gamelog/ops-band.js'
import { compareGames } from '../src/lib/model/player/gamelog/gamelog.js'
import { ROLLING_GAMES, ROLLING_MIN_PA, chartGames, seasonOps, rollingOps, outsideClubs, opsChart } from '../src/lib/model/player/gamelog/ops-chart.js'
import { gamelogFor } from '../src/lib/build/data.js'
import { brewersClubIds } from '../src/lib/model/archive.js'
import hitterLog from './fixtures/gamelog-hitter-2026.json' with { type: 'json' }
import orgFile from '../src/data/org.json' with { type: 'json' }

const brewers = brewersClubIds(orgFile)
const fixtureRows = hitterLog.stats[0].splits.map((s) => slimGameLogRow('hitting', s))

const COUNTS = ['h', 'd', 't', 'hr', 'ab', 'bb', 'hbp', 'sf']
const sumOps = (rows) => {
  const sums = Object.fromEntries(COUNTS.map((k) => [k, rows.reduce((n, r) => n + r[k], 0)]))
  return { ops: ops(sums), pa: rows.reduce((n, r) => n + r.pa, 0) }
}

// One hand-made row. Game n is on its own day; `over` changes any field.
const row = (n, over = {}) => ({
  gamePk: 900000 + n, date: 20260400 + n, gameNumber: 1,
  sportId: 11, teamId: 556, team: 'Nashville Sounds', oppId: 559, opp: 'Rocket City Trash Pandas',
  isHome: true, isWin: true,
  pa: 4, ab: 4, h: 1, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, so: 1, hbp: 0, sf: 0,
  ...over,
})
const rowsOf = (count, over = () => ({})) => Array.from({ length: count }, (_, i) => row(i + 1, over(i)))

test('the rolling window is 10 games and needs 30 plate appearances', () => {
  assert.equal(ROLLING_GAMES, 10)
  assert.equal(ROLLING_MIN_PA, 30)
})

test('chartGames puts the games oldest first, whatever order the rows come in', () => {
  const oldestFirst = [...fixtureRows].sort(compareGames).map((r) => r.gamePk)
  assert.deepEqual(chartGames(fixtureRows, brewers).map((g) => g.gamePk), oldestFirst)
  assert.deepEqual(chartGames([...fixtureRows].reverse(), brewers).map((g) => g.gamePk), oldestFirst)
  assert.equal(fixtureRows[0].date, 20260411, 'the input is not sorted in place')
})

test('a doubleheader is two entries with two gamePks, in game order', () => {
  const games = chartGames(fixtureRows, brewers)
  assert.equal(games.length, fixtureRows.length, 'no row is dropped')
  const day = games.filter((g) => g.date === 20260604)
  assert.equal(day.length, 2)
  assert.deepEqual(day.map((g) => [g.gamePk, g.gameNumber]), [[818188, 1], [818201, 2]])
  assert.equal(new Set(games.map((g) => g.gamePk)).size, games.length)
})

test('a game entry has the fields the component and the lines need', () => {
  const [first] = chartGames(fixtureRows, brewers)
  const raw = fixtureRows.find((r) => r.gamePk === first.gamePk)
  for (const key of ['gamePk', 'date', 'gameNumber', 'teamId', 'team', 'opp', 'pa', 'ab', 'h', 'd', 't', 'hr', 'bb', 'hbp', 'sf', 'so', 'r', 'rbi']) {
    assert.equal(first[key], raw[key], key)
  }
  assert.deepEqual([first.outside, first.missing, first.ops, first.band], [false, false, ops(raw), opsBand(ops(raw))])
})

test('fixture: game 2 of the doubleheader is missing, the others have an OPS and a band', () => {
  const games = chartGames(fixtureRows, brewers)
  const game2 = games.find((g) => g.gamePk === 818201)
  assert.equal(game2.pa, 0)
  assert.equal(game2.ops, null, 'no .000 bar')
  assert.equal(game2.band, null)
  assert.equal(game2.missing, true)
  for (const g of games.filter((x) => x.gamePk !== 818201)) {
    assert.equal(g.missing, false, String(g.gamePk))
    assert.match(g.ops, /^([1-9]\d*)?\.\d{3}$/, String(g.gamePk))
    assert.ok(g.band, String(g.gamePk))
  }
})

test('fixture: Nashville and Biloxi are Brewers clubs, so no game is outside', () => {
  const games = chartGames(fixtureRows, brewers)
  assert.ok(brewers.has(556) && games.some((g) => g.teamId === 556), 'the fixture has a Nashville game')
  assert.ok(games.every((g) => g.outside === false))
})

test('outside is decided by team id and the set passed in, never by name', () => {
  const rows = [row(1), row(2, { teamId: 5434, team: 'Sugar Land Space Cowboys' }), row(3, { team: 'Sugar Land Space Cowboys' })]
  const games = chartGames(rows, brewers)
  assert.deepEqual(games.map((g) => g.outside), [false, true, false])
  assert.deepEqual(chartGames(rows, new Set([5434])).map((g) => g.outside), [true, false, true])
})

test('a game with 0 PA is missing, not a 0 bar, even though ops() gives .000 for it', () => {
  const zero = row(1, { pa: 0, ab: 0, h: 0, so: 0 })
  assert.equal(ops(zero), '.000', 'the trap: ops() alone would give a bar')
  const [g] = chartGames([zero], brewers)
  assert.deepEqual([g.ops, g.band, g.missing], [null, null, true])
})

test('a game with a null or non-finite PA is missing', () => {
  for (const pa of [null, undefined, NaN, Infinity, '4']) {
    const [g] = chartGames([row(1, { pa })], brewers)
    assert.deepEqual([g.ops, g.band, g.missing], [null, null, true], `pa ${String(pa)}`)
  }
})

test('a game with any count ops() needs null is missing, and the null stays null', () => {
  for (const key of COUNTS) {
    const [g] = chartGames([row(1, { [key]: null })], brewers)
    assert.deepEqual([g.ops, g.band, g.missing], [null, null, true], key)
  }
})

test('a real 0 stays 0; a count ops() does not read (so, r, rbi) may be null', () => {
  const [g] = chartGames([row(1, { h: 0 })], brewers)
  assert.deepEqual([g.h, g.ops, g.missing], [0, '.000', false], 'PA above 0 and no hits is a real .000')
  const [free] = chartGames([row(1, { so: null, r: null, rbi: null })], brewers)
  assert.deepEqual([free.missing, free.ops], [false, ops(row(1))])
})

test('a walk-only game (PA 1, AB 0) is a real value, not missing', () => {
  const walk = row(1, { pa: 1, ab: 0, h: 0, bb: 1, so: 0 })
  const [g] = chartGames([walk], brewers)
  assert.equal(g.missing, false)
  assert.notEqual(g.ops, null)
  assert.equal(g.ops, ops(walk))
  assert.equal(g.band, opsBand(ops(walk)))
})

test('seasonOps sums the counts and calls ops() once; it never averages the game strings', () => {
  const games = chartGames([
    row(1, { pa: 1, ab: 1, h: 1, so: 0 }),
    row(2, { pa: 9, ab: 9, h: 0, so: 3 }),
  ], brewers)
  assert.deepEqual(games.map((g) => g.ops), ['2.000', '.000'])
  const summed = ops({ h: 1, d: 0, t: 0, hr: 0, ab: 10, bb: 0, hbp: 0, sf: 0 })
  assert.equal(seasonOps(games), summed)
  const mean = ((2000 + 0) / 2 / 1000).toFixed(3)
  assert.notEqual(seasonOps(games), mean, 'an average of game OPS would give 1.000')
})

test('seasonOps skips missing games and counts outside games', () => {
  const rows = [
    row(1, { pa: 5, ab: 4, h: 2, d: 1, bb: 1 }),
    row(2, { pa: 0, ab: 0, h: 0, so: 0 }),
    row(3, { h: null }),
    row(4, { teamId: 5434, team: 'Sugar Land Space Cowboys', pa: 4, ab: 3, h: 1, hr: 1, bb: 1 }),
  ]
  const games = chartGames(rows, brewers)
  assert.deepEqual(games.map((g) => g.missing), [false, true, true, false])
  assert.equal(seasonOps(games), sumOps([rows[0], rows[3]]).ops)
})

test('seasonOps is null when no game is charted', () => {
  assert.equal(seasonOps([]), null)
  assert.equal(seasonOps(chartGames([row(1, { pa: 0, ab: 0, h: 0 }), row(2, { pa: null })], brewers)), null)
})

test('fixture: the season OPS is the OPS of the summed counts of the charted games', () => {
  const games = chartGames(fixtureRows, brewers)
  const charted = fixtureRows.filter((r) => r.pa > 0)
  assert.equal(seasonOps(games), sumOps(charted).ops)
})

test('a window of exactly 30 PA has a point; one under 30 has none', () => {
  const thirty = chartGames(rowsOf(10, () => ({ pa: 3, ab: 3, h: 1, so: 1 })), brewers)
  const points = rollingOps(thirty)
  assert.equal(points.length, 1)
  assert.deepEqual(points[0], { gamePk: 900010, index: 9, ops: ops({ h: 10, d: 0, t: 0, hr: 0, ab: 30, bb: 0, hbp: 0, sf: 0 }), pa: 30 })
  const under = chartGames(rowsOf(10, (i) => ({ pa: i === 9 ? 2 : 3, ab: i === 9 ? 2 : 3, h: 1 })), brewers)
  assert.deepEqual(rollingOps(under), [], 'a 29 PA window is omitted, not .000 and not null')
})

test('a 0-PA game is one of the 10 games, adds 0 PA, and the window still needs 30', () => {
  const enough = rowsOf(10, (i) => (i === 4 ? { pa: 0, ab: 0, h: 0, so: 0 } : { pa: 4 }))
  const points = rollingOps(chartGames(enough, brewers))
  assert.equal(points.length, 1)
  assert.equal(points[0].pa, 36)
  assert.equal(points[0].ops, sumOps(enough).ops)
  const short = rowsOf(10, (i) => (i === 4 ? { pa: 0, ab: 0, h: 0, so: 0 } : { pa: 3, ab: 3 }))
  assert.deepEqual(rollingOps(chartGames(short, brewers)), [], '27 PA in 10 games')
  const nine = rowsOf(10, (i) => (i === 4 ? { pa: 0, ab: 0, h: 0, so: 0 } : { pa: 4 })).filter((_, i) => i !== 0)
  assert.deepEqual(rollingOps(chartGames(nine, brewers)), [], '9 games in all, the 0-PA one among them, is not a full window')
})

test('each later window drops the oldest game and keeps the newest; a point names its newest game', () => {
  const rows = rowsOf(11, (i) => (i === 0 ? { pa: 10, ab: 10, h: 3 } : i === 1 ? { pa: 2, ab: 2, h: 0 } : { pa: 3, ab: 3, h: 1 }))
  const points = rollingOps(chartGames(rows, brewers))
  assert.deepEqual(points.map((p) => [p.index, p.gamePk, p.pa]), [[9, 900010, 36]], 'the window at index 10 has 29 PA, so no point')
  const more = rowsOf(11, (i) => (i === 0 ? { pa: 10, ab: 10, h: 3 } : { pa: 3, ab: 3, h: 1 }))
  const both = rollingOps(chartGames(more, brewers))
  assert.deepEqual(both.map((p) => [p.index, p.gamePk, p.pa]), [[9, 900010, 37], [10, 900011, 30]])
  assert.equal(both[1].ops, sumOps(more.slice(1)).ops)
})

test('fewer than 10 games have no rolling points', () => {
  assert.deepEqual(rollingOps(chartGames(rowsOf(9, () => ({ pa: 9, ab: 9 })), brewers)), [])
  assert.deepEqual(rollingOps([]), [])
})

test('the window size can be changed, and a bad size gives no points', () => {
  const games = chartGames(rowsOf(5, () => ({ pa: 10, ab: 10, h: 3 })), brewers)
  assert.deepEqual(rollingOps(games, 3).map((p) => p.index), [2, 3, 4])
  for (const size of [0, -1, 1.5, NaN, null]) assert.deepEqual(rollingOps(games, size), [], String(size))
})

test('a window with a null count has no point; a null is not a zero', () => {
  const rows = rowsOf(11, (i) => (i === 0 ? { h: null, pa: 4 } : { pa: 4 }))
  const points = rollingOps(chartGames(rows, brewers))
  assert.deepEqual(points.map((p) => p.index), [10], 'only the window without game 1')
  const noPa = rowsOf(10, (i) => (i === 3 ? { pa: null } : {}))
  assert.deepEqual(rollingOps(chartGames(noPa, brewers)), [])
  const zeroWithNull = rowsOf(10, (i) => (i === 3 ? { pa: 0, ab: null } : { pa: 4 }))
  assert.deepEqual(rollingOps(chartGames(zeroWithNull, brewers)), [])
})

test('opsChart gives the games, the season line, the rolling line, the outside clubs and the counts', () => {
  const rows = [
    ...rowsOf(12, () => ({ pa: 4 })),
    row(13, { teamId: 5434, team: 'Sugar Land Space Cowboys', pa: 4 }),
    row(14, { teamId: 5434, team: 'Sugar Land Space Cowboys', pa: 4 }),
    row(15, { teamId: 5400, team: 'Albuquerque Isotopes', pa: 4 }),
    row(16, { pa: 0, ab: 0, h: 0, so: 0 }),
    row(17, { h: null }),
  ]
  const chart = opsChart([...rows].reverse(), brewers)
  assert.deepEqual(Object.keys(chart).sort(), ['charted', 'games', 'missing', 'outsideClubs', 'rolling', 'season'])
  assert.deepEqual(chart.games, chartGames(rows, brewers))
  assert.equal(chart.season, seasonOps(chart.games))
  assert.deepEqual(chart.rolling, rollingOps(chart.games))
  assert.deepEqual(chart.outsideClubs, ['Albuquerque Isotopes', 'Sugar Land Space Cowboys'])
  assert.deepEqual([chart.charted, chart.missing], [15, 2])
  assert.equal(chart.charted + chart.missing, chart.games.length)
})

test('outsideClubs lists each outside team name once, sorted, and ignores a null name', () => {
  const games = chartGames([
    row(1, { teamId: 5434, team: 'Sugar Land Space Cowboys' }),
    row(2),
    row(3, { teamId: 5400, team: 'Albuquerque Isotopes' }),
    row(4, { teamId: 5434, team: 'Sugar Land Space Cowboys' }),
    row(5, { teamId: 5401, team: null }),
  ], brewers)
  assert.deepEqual(outsideClubs(games), ['Albuquerque Isotopes', 'Sugar Land Space Cowboys'])
  assert.deepEqual(outsideClubs(chartGames([row(1)], brewers)), [])
})

test('an empty log gives an empty chart, not an error', () => {
  assert.deepEqual(opsChart([], brewers), { games: [], season: null, rolling: [], outsideClubs: [], charted: 0, missing: 0 })
})

test('695501: two levels, oldest first, no outside game, and every line matches an independent sum', () => {
  const rows = gamelogFor(695501).hitting
  const chart = opsChart(rows, brewers)
  const { games } = chart
  assert.equal(games.length, rows.length, 'one entry per row')
  assert.ok(games.length > ROLLING_GAMES, 'enough games for a rolling line')
  const levels = new Set(games.map((g) => g.sportId))
  assert.ok(levels.has(11) && levels.has(12), `both levels are present, got ${[...levels]}`)
  for (let i = 1; i < games.length; i++) assert.ok(compareGames(games[i - 1], games[i]) < 0, `game ${i} is later than game ${i - 1}`)
  assert.equal(new Set(games.map((g) => g.gamePk)).size, games.length)
  assert.ok(games.every((g) => g.outside === false))
  assert.deepEqual(chart.outsideClubs, [])

  const oldestFirst = [...rows].sort(compareGames)
  const charted = oldestFirst.filter((r) => r.pa > 0 && ops(r) !== null)
  assert.equal(chart.season, sumOps(charted).ops)
  assert.equal(chart.charted, charted.length)
  assert.equal(chart.charted + chart.missing, rows.length)

  assert.ok(chart.rolling.length > 0, 'a full season has rolling points')
  for (const p of chart.rolling) {
    assert.ok(p.pa >= ROLLING_MIN_PA, `point ${p.index} has ${p.pa} PA`)
    const window = oldestFirst.slice(p.index - ROLLING_GAMES + 1, p.index + 1)
    assert.equal(window.length, ROLLING_GAMES)
    assert.equal(p.gamePk, window[ROLLING_GAMES - 1].gamePk)
    const again = sumOps(window)
    assert.equal(p.pa, again.pa)
    assert.equal(p.ops, again.ops)
  }
})

test('678225: outside games follow the club ids, are still charted, and their clubs are named', () => {
  const rows = gamelogFor(678225).hitting
  const games = chartGames(rows, brewers)
  assert.equal(games.length, rows.length)
  for (const g of games) assert.equal(g.outside, !brewers.has(g.teamId), String(g.gamePk))
  const outside = games.filter((g) => g.outside)
  assert.ok(outside.length > 0, 'the snapshot changed: 678225 has no outside game, so this test has no data to check')
  for (const g of outside.filter((x) => x.pa > 0 && ops(x) !== null)) {
    assert.equal(g.missing, false, `outside game ${g.gamePk} is charted`)
    assert.equal(g.ops, ops(rows.find((r) => r.gamePk === g.gamePk)))
  }
  const names = [...new Set(outside.map((g) => g.team))].sort()
  assert.deepEqual(outsideClubs(games), names)
  assert.deepEqual(opsChart(rows, brewers).outsideClubs, names)
  const sums = rows.filter((r) => r.pa > 0 && ops(r) !== null)
  assert.equal(seasonOps(games), sumOps(sums).ops, 'outside games are in the season sum')
})
