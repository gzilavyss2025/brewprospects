// The game log data (#35, part 1): the slim functions, the packed file, the
// generator's guards and the build-time reader.
//
// Fixtures, all captured 2026-09-29 (test/fixtures/manifest.json):
// - gamelog-hitter-2026.json: 682633, five rows. Biloxi, then Nashville, with
//   a doubleheader on 2026-06-04 whose game 2 has plateAppearances 0.
// - gamelog-starter-2026.json: 676467, three rows. Two for Sugar Land (an
//   Astros club, outside the system), then a Nashville start.
// - gamelog-reliever-2026.json: 657649, three Nashville relief rows.
// - people-gamelog-2026.json: the batched hydrate gen-gamelog reads. 695501
//   (hitting) and 676467 (pitching), each trimmed to one block.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slimGameLogRow, slimGamelogPerson, blockSplits } from '../scripts/data/live/gamelog-slim.mjs'
import { missingPeopleProblem, gamelogAction } from '../scripts/data/live/gamelog-guards.mjs'
import { packGamelog, unpackGamelog, countRows, GAMELOG_COLUMNS } from '../src/lib/snapshot/gamelog.js'
import { newestFirst } from '../src/lib/model/player/gamelog/gamelog.js'
import { gamelogFor } from '../src/lib/build/data.js'
import { brewersClubIds } from '../src/lib/model/archive.js'
import { packedProblems } from '../scripts/checks/snapshots.mjs'
import { stringifyByLine } from '../scripts/data/lib/by-line.mjs'
import hitterLog from './fixtures/gamelog-hitter-2026.json' with { type: 'json' }
import starterLog from './fixtures/gamelog-starter-2026.json' with { type: 'json' }
import relieverLog from './fixtures/gamelog-reliever-2026.json' with { type: 'json' }
import batched from './fixtures/people-gamelog-2026.json' with { type: 'json' }
import orgFile from '../src/data/org.json' with { type: 'json' }
import gamelogFile from '../src/data/gamelog.json' with { type: 'json' }

const splitsOf = (log) => log.stats[0].splits
const hitterRows = splitsOf(hitterLog).map((s) => slimGameLogRow('hitting', s))
const starterRows = splitsOf(starterLog).map((s) => slimGameLogRow('pitching', s))
const [burke, gordon] = batched.people
const through = (value) => JSON.parse(stringifyByLine(value))

test('a hitting row keeps its counts, its club and its game, and no rate', () => {
  assert.deepEqual(slimGameLogRow('hitting', burke.stats[0].splits[0]), {
    gamePk: 817734, date: 20260403, gameNumber: 1,
    sportId: 12, teamId: 5015, team: 'Biloxi Shuckers',
    oppId: 559, isHome: false, isWin: true,
    pa: 5, ab: 5, h: 2, d: 0, t: 0, hr: 2, r: 2, rbi: 2, bb: 0, so: 3, hbp: 0, sf: 0,
  })
})

test('a pitching row keeps outs, not the innings string', () => {
  assert.deepEqual(starterRows[0], {
    gamePk: 814874, date: 20260328, gameNumber: 1,
    sportId: 11, teamId: 5434, team: 'Sugar Land Space Cowboys',
    oppId: 102, isHome: true, isWin: true,
    gs: 1, outs: 15, h: 3, r: 1, er: 1, bb: 0, so: 4, bf: 18,
  })
  assert.equal('inningsPitched' in starterRows[0], false)
})

test('outs equal the thirds of inningsPitched on every fixture row', () => {
  const thirds = (ip) => {
    const [whole, third] = ip.split('.').map(Number)
    return whole * 3 + third
  }
  const splits = [
    ...splitsOf(starterLog),
    ...splitsOf(relieverLog),
    ...gordon.stats.flatMap((b) => b.splits),
  ]
  assert.ok(splits.length >= 8)
  for (const s of splits) {
    assert.equal(slimGameLogRow('pitching', s).outs, thirds(s.stat.inningsPitched), `${s.date} ${s.stat.inningsPitched}`)
  }
  assert.ok(splits.some((s) => s.stat.inningsPitched.endsWith('.2')), 'a fixture has a partial inning')
})

test('a doubleheader is two rows with one date and two gamePks; game 2 has 0 PA, kept', () => {
  const day = hitterRows.filter((r) => r.date === 20260604)
  assert.equal(day.length, 2)
  assert.deepEqual(day.map((r) => r.gamePk).sort(), [818188, 818201])
  const game2 = day.find((r) => r.gameNumber === 2)
  assert.equal(game2.gamePk, 818201)
  assert.equal(game2.pa, 0, 'PA is 0, not missing')
  assert.equal(game2.ab, 0)
})

test('newestFirst puts game 2 of a doubleheader before game 1, and needs no sort by the caller', () => {
  const ordered = newestFirst(hitterRows)
  assert.deepEqual(ordered.map((r) => r.gamePk), [816197, 818121, 818201, 818188, 818212])
  assert.deepEqual(newestFirst([...hitterRows].reverse()), ordered)
  assert.equal(hitterRows[0].date, 20260411, 'the input is not sorted in place')
})

test('the Sugar Land row stays in the log and is not a Brewers club', () => {
  const brewers = brewersClubIds(orgFile)
  assert.ok(brewers.has(556), 'Nashville is an affiliate')
  assert.ok(!brewers.has(5434), 'Sugar Land is not')
  assert.deepEqual(starterRows.map((r) => brewers.has(r.teamId)), [false, false, true])
  const packed = packGamelog({ generatedAt: 'x', season: 2026, players: { 676467: { hitting: [], pitching: starterRows } }, opponents: {} })
  assert.equal(countRows(through(packed)), 3, 'all three rows are kept')
})

test('an empty group block gives no rows, wherever it sits', () => {
  // docs/api.md, "A hydrate with both groups sends an empty block (splits: [])
  // for the group a player has no line in". The fixture was trimmed to one
  // block per player, so the empty one is added here.
  const empty = { type: { displayName: 'gameLog' }, group: { displayName: 'pitching' }, splits: [] }
  for (const stats of [[...burke.stats, empty], [empty, ...burke.stats]]) {
    const slim = slimGamelogPerson({ ...burke, stats })
    assert.equal(slim.pitching.length, 0)
    assert.equal(slim.hitting.length, 2)
    assert.equal(blockSplits({ ...burke, stats }, 'hitting').length, 2)
  }
})

test('a missing block, a block with no splits and a person with no stats are all empty', () => {
  assert.equal(slimGamelogPerson(burke).pitching.length, 0, 'no pitching block at all')
  const noSplits = { ...burke, stats: [{ group: { displayName: 'hitting' } }] }
  assert.deepEqual(slimGamelogPerson(noSplits), { hitting: [], pitching: [], opponents: {} })
  assert.deepEqual(slimGamelogPerson({ id: 1 }), { hitting: [], pitching: [], opponents: {} })
})

test('a group is read by its name, never by its place', () => {
  const hitting = burke.stats[0]
  const pitching = { type: { displayName: 'gameLog' }, group: { displayName: 'pitching' }, splits: gordon.stats[0].splits }
  const both = slimGamelogPerson({ id: 1, stats: [pitching, hitting] })
  assert.equal(both.hitting.length, 2)
  assert.equal(both.pitching.length, 2)
  assert.ok(both.hitting.every((r) => 'pa' in r))
  assert.ok(both.pitching.every((r) => 'outs' in r))
})

test('opponent names come once, by team id, from the rows', () => {
  const slim = slimGamelogPerson(burke)
  assert.equal(slim.opponents[559], 'Rocket City Trash Pandas')
  assert.ok(slim.hitting.every((r) => !('opp' in r) && Number.isInteger(r.oppId)))
})

test('a row with no gamePk or no date is dropped, not guessed', () => {
  const s = splitsOf(hitterLog)[0]
  assert.equal(slimGameLogRow('hitting', { ...s, game: { ...s.game, gamePk: undefined } }), null)
  assert.equal(slimGameLogRow('hitting', { ...s, date: undefined }), null)
  assert.equal(slimGameLogRow('hitting', { ...s, date: 'April' }), null)
})

test('a count the API did not send is null, not 0', () => {
  const s = splitsOf(hitterLog)[0]
  const { hitByPitch: _h, ...stat } = s.stat
  assert.equal(slimGameLogRow('hitting', { ...s, stat }).hbp, null)
})

const file = (players = { 695501: { hitting: hitterRows, pitching: [] }, 676467: { hitting: [], pitching: starterRows } }, opponents = { 102: 'Round Rock Express' }) =>
  packGamelog({ generatedAt: 'x', season: 2026, players, opponents })

test('pack then unpack gives the same rows, with the opponent as a name', () => {
  const back = unpackGamelog(through(file()))
  assert.equal(back.season, 2026)
  assert.deepEqual(back.players[695501].hitting, hitterRows.map((r) => ({ ...r, opp: null })))
  assert.deepEqual(back.players[676467].pitching, starterRows.map((r) => ({ ...r, opp: r.oppId === 102 ? 'Round Rock Express' : null })))
  assert.equal(back.players[676467].pitching[0].isHome, starterRows[0].isHome, 'booleans come back as booleans')
})

test('the packed file is packed, counts only and one club table', () => {
  const packed = through(file())
  assert.deepEqual(packedProblems('src/data/gamelog.json', packed), [])
  assert.deepEqual(Object.keys(packed.columns), ['hitting', 'pitching'])
  assert.equal(typeof packed.players[695501].hitting[0][GAMELOG_COLUMNS.hitting.indexOf('date')], 'number')
  assert.ok(packed.clubs.length <= 4, 'each club is stored once')
  for (const group of Object.values(GAMELOG_COLUMNS)) {
    for (const rate of ['avg', 'obp', 'slg', 'ops', 'ip', 'era', 'whip', 'inningsPitched']) {
      assert.ok(!group.includes(rate), rate)
    }
  }
  assert.ok(!/"(avg|obp|slg|ops|era|whip)"/.test(JSON.stringify(packed)), 'no rate key anywhere')
})

test('a field with no column throws, so the last good file stays', () => {
  const bad = { ...hitterRows[0], avg: '.400' }
  assert.throws(() => file({ 1: { hitting: [bad], pitching: [] } }), /No column for the hitting field "avg"/)
  assert.throws(() => file({ 1: { hitting: [], pitching: [{ ...starterRows[0], era: '1.80' }] } }), /No column for the pitching field "era"/)
})

test('a player with no rows is not written', () => {
  const packed = file({ 1: { hitting: [], pitching: [] }, 2: { hitting: hitterRows, pitching: [] } })
  assert.deepEqual(Object.keys(packed.players), ['2'])
})

test('missing people: 5% is fine, more than 5% throws', () => {
  assert.equal(missingPeopleProblem(2, 40), null)
  assert.match(missingPeopleProblem(3, 40), /3 of 40 players came back with no person record/)
  assert.equal(missingPeopleProblem(0, 0), null)
})

const disk = (season, rows) => ({ season, rows })
test('gamelogAction: before opening day, keep an older season and succeed', () => {
  assert.equal(gamelogAction({ season: 2027, rows: 0, onDisk: disk(2026, 15000) }).action, 'keep')
})

test('gamelogAction: no rows and nothing older to keep is a failure', () => {
  assert.equal(gamelogAction({ season: 2026, rows: 0, onDisk: null }).action, 'fail')
  assert.equal(gamelogAction({ season: 2026, rows: 0, onDisk: disk(2026, 15000) }).action, 'fail')
  assert.equal(gamelogAction({ season: 2026, rows: 0, onDisk: disk(2027, 10) }).action, 'fail')
})

test('gamelogAction: the same season may not lose more than 10% of its rows', () => {
  assert.equal(gamelogAction({ season: 2026, rows: 13500, onDisk: disk(2026, 15000) }).action, 'write', 'exactly 10% is allowed')
  assert.equal(gamelogAction({ season: 2026, rows: 13499, onDisk: disk(2026, 15000) }).action, 'fail')
  assert.equal(gamelogAction({ season: 2026, rows: 15200, onDisk: disk(2026, 15000) }).action, 'write')
})

test('gamelogAction: a new season replaces an old one, however few rows it has so far', () => {
  assert.equal(gamelogAction({ season: 2027, rows: 40, onDisk: disk(2026, 15000) }).action, 'write')
  assert.equal(gamelogAction({ season: 2026, rows: 40, onDisk: null }).action, 'write')
})

test('gamelogAction: an older season never replaces a newer one', () => {
  assert.equal(gamelogAction({ season: 2025, rows: 9000, onDisk: disk(2026, 15000) }).action, 'fail')
})

test('gamelogAction: every answer says why', () => {
  for (const onDisk of [null, disk(2026, 10)]) {
    assert.match(gamelogAction({ season: 2026, rows: 0, onDisk }).reason, /\S/)
  }
})

test('the committed gamelog.json is valid and holds each game once per player and group', () => {
  assert.deepEqual(packedProblems('src/data/gamelog.json', gamelogFile), [])
  assert.equal(gamelogFile.season, Number(orgFile.season))
  const { players } = unpackGamelog(gamelogFile)
  assert.ok(Object.keys(players).length > 0)
  for (const [id, p] of Object.entries(players)) {
    for (const group of ['hitting', 'pitching']) {
      const keys = p[group].map((r) => r.gamePk)
      assert.equal(new Set(keys).size, keys.length, `${id} ${group} repeats a gamePk`)
    }
  }
})

test('gamelogFor reads one player, newest first, and returns null for a player with no rows', () => {
  const [id] = Object.keys(gamelogFile.players)
  const log = gamelogFor(Number(id))
  assert.equal(log.season, String(orgFile.season))
  for (const group of ['hitting', 'pitching']) {
    const dates = log[group].map((r) => r.date)
    assert.deepEqual(dates, [...dates].sort((a, b) => b - a), `${group} is newest first`)
  }
  assert.equal(gamelogFor(1), null)
  assert.equal(gamelogFor(undefined), null)
})

test('the file is written with one player, one club and one opponent per line', () => {
  const text = stringifyByLine(file())
  assert.deepEqual(JSON.parse(text), file())
  assert.match(text, /"opponents":\{\n"102":"Round Rock Express"\n\}/)
  assert.equal(text.split('\n').filter((l) => /^"(695501|676467)":/.test(l)).length, 2)
})
