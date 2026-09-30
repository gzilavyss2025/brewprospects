// MLB rows stay apart from MiLB rows (docs/adr/0014): shaped by slimMlbPerson,
// ordered by mlbRows, and never seen by the level path or the MiLB tables.
// On disk they are packed, counts only (docs/adr/0015).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slimMlbPerson, slimPerson } from '../scripts/data/lib/slim.mjs'
import { mlbRows, packMlb, unpackMlb } from '../src/lib/model/mlb.js'
import { levelPath, statRows } from '../src/lib/model/org.js'
import { LEVELS, levelFor } from '../src/lib/model/levels.js'
import mlbPeople from './fixtures/people-mlb-yearbyyear.json' with { type: 'json' }

const person = (id) => mlbPeople.people.find((p) => p.id === id)
const CAMERON = 111904
const GALLARDO = 451596
const MADE = 815908

test('slimMlbPerson keeps hitting and pitching splits, each with its club', () => {
  const g = slimMlbPerson(person(GALLARDO))
  assert.equal(g.hitting.length, 2)
  assert.equal(g.pitching.length, 2)
  assert.equal(g.pitching[0].team, 'Milwaukee Brewers')
  assert.equal(g.pitching[0].sportId, 1)
  assert.equal(g.hitting[0].avg, undefined, 'a rate is computed, not stored')
  assert.equal(mlbRows(g, 'hitting')[0].avg, '.250')
})

test('slimMlbPerson keeps the counts the rates need, and no rate', () => {
  const g = slimMlbPerson(person(GALLARDO))
  const RATES = ['avg', 'obp', 'slg', 'ops', 'ip', 'era', 'whip', 'k9', 'bb9']
  for (const r of [...g.hitting, ...g.pitching]) {
    assert.deepEqual(RATES.filter((k) => k in r), [])
  }
  for (const k of ['hbp', 'sf']) assert.ok(Number.isInteger(g.hitting[0][k]), k)
  for (const k of ['outs', 'er']) assert.ok(Number.isInteger(g.pitching[0][k]), k)
})

// battersFaced is on every pitching split in the captured responses
// (test/fixtures/people-mlb-yearbyyear.json, people-milb-careers.json and
// roster-season-2025-biloxi.json), and the pitcher K% and BB% divide by it.
test('slimMlbPerson keeps batters faced on a pitching row, and the file has a column for it', () => {
  const g = slimMlbPerson(person(GALLARDO))
  assert.deepEqual(g.pitching.map((r) => r.bf), [466, 97])
  const file = JSON.parse(JSON.stringify(packMlb({ generatedAt: 'x', players: { [GALLARDO]: g } })))
  assert.ok(file.columns.pitching.includes('bf'))
  assert.equal(unpackMlb(file).players[GALLARDO].pitching[0].bf, 466)
})

test('packMlb and unpackMlb give back the exact rows', () => {
  const players = { [CAMERON]: slimMlbPerson(person(CAMERON)), [GALLARDO]: slimMlbPerson(person(GALLARDO)) }
  const file = JSON.parse(JSON.stringify(packMlb({ generatedAt: 'x', players })))
  assert.deepEqual(unpackMlb(file), { generatedAt: 'x', players })
  assert.ok(Array.isArray(file.players[CAMERON].hitting[0]), 'a row is an array')
  assert.equal(typeof file.players[CAMERON].hitting[0][0], 'number', 'the season is a number on disk')
})

test('packMlb throws on a field with no column, so nothing is dropped', () => {
  const row = { ...slimMlbPerson(person(GALLARDO)).pitching[0], era: '3.67' }
  assert.throws(() => packMlb({ generatedAt: 'x', players: { 1: { hitting: [], pitching: [row] } } }), /"era"/)
})

test('slimMlbPerson keeps the traded-player total with its team count', () => {
  const c = slimMlbPerson(person(CAMERON))
  const total = c.hitting.find((r) => r.season === '2011' && r.team === '')
  assert.equal(total.teams, 2)
  assert.equal(c.hitting.find((r) => r.team === 'Boston Red Sox').teams, null)
})

test('a player with no big-league rows gets empty lists, not a crash', () => {
  assert.deepEqual(slimMlbPerson(person(MADE)), { hitting: [], pitching: [] })
  assert.deepEqual(slimMlbPerson({ id: 1 }), { hitting: [], pitching: [] })
})

test('mlbRows orders by season and puts the total after the club rows', () => {
  const rows = mlbRows(slimMlbPerson(person(CAMERON)), 'hitting')
  assert.deepEqual(
    rows.map((r) => `${r.season} ${r.team}`),
    ['1995 Chicago White Sox', '2011 Boston Red Sox', '2011 Florida Marlins', '2011 2 teams'],
  )
})

test('mlbRows survives a missing entry or group', () => {
  assert.deepEqual(mlbRows(null, 'hitting'), [])
  assert.deepEqual(mlbRows({ hitting: [] }, 'pitching'), [])
})

test('MLB is not a level, so no MiLB calculation can see an MLB row', () => {
  assert.equal(levelFor(1), null)
  assert.ok(!LEVELS.some((l) => l.sportId === 1))
  // Even if an MLB row were mixed into a player's MiLB rows, the level path
  // and the MiLB table would drop it.
  const mixed = { ...slimPerson({ id: 2, stats: [] }), ...slimMlbPerson(person(GALLARDO)) }
  assert.deepEqual(levelPath(mixed), [])
  assert.deepEqual(statRows(mixed, 'pitching'), [])
})
