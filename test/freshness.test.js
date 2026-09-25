import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stalenessProblems } from '../scripts/data/freshness.mjs'

test('the offseason may keep last season', () => {
  assert.deepEqual(stalenessProblems({ orgSeason: '2026', today: new Date('2027-01-15T12:00:00Z') }), [])
  assert.deepEqual(stalenessProblems({ orgSeason: '2026', today: new Date('2027-04-30T12:00:00Z') }), [])
})

test('last season after May 1 means gen-org is stuck', () => {
  const [problem] = stalenessProblems({ orgSeason: '2026', today: new Date('2027-05-01T00:00:00Z') })
  assert.match(problem, /still holds the 2026 season/)
})

test('this season after May 1 is fine', () => {
  assert.deepEqual(stalenessProblems({ orgSeason: '2027', today: new Date('2027-05-10T12:00:00Z') }), [])
})
