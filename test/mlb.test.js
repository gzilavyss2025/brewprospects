// MLB rows stay apart from MiLB rows (docs/adr/0014): shaped by slimMlbPerson,
// ordered by mlbRows, and never seen by the level path or the MiLB tables.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slimMlbPerson, slimPerson } from '../scripts/data/slim.mjs'
import { mlbRows } from '../src/lib/model/mlb.js'
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
  assert.equal(g.hitting[0].avg, '.250')
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
