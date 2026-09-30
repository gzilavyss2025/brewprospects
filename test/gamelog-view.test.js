// The game log display rows (#35, part 2). Rows are built from the fixtures as
// test/gamelog.test.js builds them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slimGameLogRow } from '../scripts/data/live/gamelog-slim.mjs'
import { newestFirst } from '../src/lib/model/player/gamelog.js'
import { brewersClubIds } from '../src/lib/model/archive.js'
import { gameLogRows, gameLogHead, dateText, throughText } from '../src/lib/model/player/gamelog-view.js'
import hitterLog from './fixtures/gamelog-hitter-2026.json' with { type: 'json' }
import starterLog from './fixtures/gamelog-starter-2026.json' with { type: 'json' }
import orgFile from '../src/data/org.json' with { type: 'json' }

const rowsOf = (group, log) => newestFirst(log.stats[0].splits.map((s) => slimGameLogRow(group, s)))
const hitter = rowsOf('hitting', hitterLog)
const starter = rowsOf('pitching', starterLog)
const col = (group, label) => gameLogHead(group).indexOf(label)

test('the head matches the cells, column for column', () => {
  for (const [group, rows] of [['hitting', hitter], ['pitching', starter]]) {
    const head = gameLogHead(group)
    assert.equal(head.length, group === 'hitting' ? 15 : 12)
    for (const r of gameLogRows(group, rows)) assert.equal(r.cells.length, head.length)
  }
})

test('the order the rows arrive in is the order shown', () => {
  assert.deepEqual(gameLogRows('hitting', hitter).map((r) => r.key), hitter.map((r) => r.gamePk))
  const dates = hitter.map((r) => r.date)
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a))
})

test('a doubleheader shows two rows, keyed apart, game 2 first', () => {
  const day = gameLogRows('hitting', hitter).filter((r) => r.cells[0] === 'Jun 4')
  assert.deepEqual(day.map((r) => r.key), [818201, 818188])
})

test('a 0-PA row still shows, with real zeros in PA and AB', () => {
  const game2 = gameLogRows('hitting', hitter).find((r) => r.key === 818201)
  assert.equal(game2.cells[col('hitting', 'PA')], '0')
  assert.equal(game2.cells[col('hitting', 'AB')], '0')
})

test('an away game has @ before the opponent, a home game does not', () => {
  const opp = (r) => gameLogRows('hitting', [r])[0].cells[col('hitting', 'Opp')]
  // Slim rows carry oppId; gamelogFor adds the name as opp.
  const named = hitter.map((r) => ({ ...r, opp: `Club ${r.oppId}` }))
  const away = named.find((r) => r.isHome === false)
  const home = named.find((r) => r.isHome === true)
  assert.ok(away && home, 'the fixture has both')
  assert.equal(opp(away), `@ ${away.opp}`)
  assert.equal(opp(home), home.opp)
})

test('IP is in thirds, and 0 outs is 0.0', () => {
  const at = col('pitching', 'IP')
  const ipOf = (outs) => gameLogRows('pitching', [{ ...starter[0], outs }])[0].cells[at]
  assert.equal(ipOf(1), '0.1')
  assert.equal(ipOf(16), '5.1')
  assert.equal(ipOf(0), '0.0')
  assert.equal(ipOf(null), '—')
  assert.equal(gameLogRows('pitching', starter).find((r) => r.key === 814874).cells[at], '5.0')
})

test('a missing value, result, opponent, level or club is a dash', () => {
  const row = { ...hitter[0], so: null, isWin: null, opp: null, sportId: 999, team: '' }
  const cells = gameLogRows('hitting', [row])[0].cells
  for (const label of ['SO', 'W/L', 'Opp', 'Lvl', 'Club']) assert.equal(cells[col('hitting', label)], '—', label)
})

test('W and L are letters', () => {
  const of = (isWin) => gameLogRows('hitting', [{ ...hitter[0], isWin }])[0].cells[col('hitting', 'W/L')]
  assert.equal(of(true), 'W')
  assert.equal(of(false), 'L')
})

test('a club outside the system shows, named, with its level', () => {
  const brewers = brewersClubIds(orgFile)
  const shown = gameLogRows('pitching', starter)
  const outsideKeys = starter.filter((r) => !brewers.has(r.teamId)).map((r) => r.gamePk)
  assert.ok(outsideKeys.length >= 1, 'the fixture has a Sugar Land row')
  for (const r of shown.filter((s) => outsideKeys.includes(s.key))) {
    assert.equal(r.cells[col('pitching', 'Club')], 'Sugar Land Space Cowboys')
    assert.equal(r.cells[col('pitching', 'Lvl')], 'AAA')
  }
  assert.ok(shown.some((r) => r.cells[col('pitching', 'Club')] === 'Nashville Sounds'))
})

test('dates and the through text', () => {
  assert.equal(dateText(20260604), 'Jun 4')
  assert.equal(dateText(null), '—')
  assert.equal(dateText(20261399), '—')
  assert.equal(throughText('2026', hitter), `${dateText(hitter[0].date)}, 2026`)
  assert.equal(throughText('2026', []), null)
})
