import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  statusGroup, currentAssignments, orgPlayerIds, isStarter, depthChart, levelPath, statRows, primaryGroup,
} from '../src/lib/org.js'
import { slimPerson } from '../scripts/data/slim.mjs'
import people from './fixtures/people-yearbyyear.json' with { type: 'json' }

const made = slimPerson(people.people.find((p) => p.id === 815908))

test('statusGroup maps every roster code seen live, and unknown codes to other', () => {
  assert.equal(statusGroup('A'), 'active')
  assert.equal(statusGroup('D7'), 'injured')
  assert.equal(statusGroup('D60'), 'injured')
  assert.equal(statusGroup('RA'), 'rehab')
  assert.equal(statusGroup('ASG'), 'moved')
  assert.equal(statusGroup('RL'), 'gone')
  assert.equal(statusGroup('FA'), 'gone')
  assert.equal(statusGroup('DEV'), 'other')
  assert.equal(statusGroup('XYZ'), 'other')
  assert.equal(statusGroup(undefined), 'other')
})

test('a promoted player is assigned to the club where he is active', () => {
  const rosters = {
    572: [{ id: 1, status: 'ASG' }],
    5015: [{ id: 1, status: 'A' }],
  }
  assert.deepEqual(currentAssignments(rosters).get(1), { teamId: 5015, status: 'A', group: 'active' })
})

test('a rehab-only big-leaguer is not an org player; a released one still is', () => {
  const rosters = {
    556: [{ id: 1, status: 'RA' }, { id: 2, status: 'RL' }, { id: 3, status: 'A' }],
  }
  assert.deepEqual(orgPlayerIds(rosters).sort(), [2, 3])
})

test('a player on rehab AND a farm roster keeps his farm status', () => {
  const rosters = { 556: [{ id: 1, status: 'RA' }], 5015: [{ id: 1, status: 'D7' }] }
  assert.deepEqual(orgPlayerIds(rosters), [1])
})

test('isStarter needs starts in half or more of his games at that club', () => {
  const p = { pitching: [{ season: '2026', teamId: 5, g: 10, gs: 5 }, { season: '2026', teamId: 6, g: 10, gs: 4 }] }
  assert.equal(isStarter(p, 5, '2026'), true)
  assert.equal(isStarter(p, 6, '2026'), false)
  assert.equal(isStarter(p, 7, '2026'), false, 'no split at the club means reliever')
  assert.equal(isStarter(undefined, 5, '2026'), false)
})

test('depthChart buckets active players, lists injured, and skips moved/gone', () => {
  const rosters = {
    9: [
      { id: 1, name: 'Zed', pos: 'SS', status: 'A' },
      { id: 2, name: 'Abe', pos: 'CF', status: 'A' },
      { id: 3, name: 'Cal', pos: 'P', status: 'A' },
      { id: 4, name: 'Dan', pos: 'C', status: 'D60' },
      { id: 5, name: 'Eli', pos: '2B', status: 'ASG' },
      { id: 6, name: 'Fox', pos: 'RF', status: 'RL' },
      { id: 7, name: 'Gus', pos: 'XX', status: 'A' },
    ],
  }
  const players = { 3: { pitching: [{ season: '2026', teamId: 9, g: 20, gs: 20 }] } }
  const { buckets, injured } = depthChart(9, rosters, players, '2026')
  assert.deepEqual(buckets.if.map((e) => e.id), [1])
  assert.deepEqual(buckets.of.map((e) => e.id), [2])
  assert.deepEqual(buckets.sp.map((e) => e.id), [3])
  assert.deepEqual(buckets.ut.map((e) => e.id), [7], 'an unknown position lands in utility, not a crash')
  assert.deepEqual(injured.map((e) => e.id), [4])
  assert.equal(buckets.c.length, 0)
})

test('depthChart for an unknown club returns empty buckets', () => {
  const { buckets, injured } = depthChart(1, {}, {}, '2026')
  assert.ok(Object.values(buckets).every((b) => b.length === 0))
  assert.equal(injured.length, 0)
})

// Pinned on a captured live response: Jesús Made, DSL 2024 -> A, A+, AA in
// 2025 -> AA 2026. The 2025 MiLB total row (sportId 21) must not appear.
test('levelPath reads a real multi-level career in order, without the total row', () => {
  assert.deepEqual(
    levelPath(made).map((s) => `${s.season} ${s.label}`),
    ['2024 CPX', '2025 A', '2025 A+', '2025 AA', '2026 AA'],
  )
})

test('statRows drops the MiLB total row and orders low level first within a season', () => {
  const rows = statRows(made, 'hitting')
  assert.ok(rows.every((r) => r.sportId !== 21))
  assert.deepEqual(rows.map((r) => r.sportId), [16, 14, 13, 12, 12])
})

test('primaryGroup follows position', () => {
  assert.equal(primaryGroup({ pos: 'P' }), 'pitching')
  assert.equal(primaryGroup({ pos: 'TWP' }), 'pitching')
  assert.equal(primaryGroup({ pos: 'SS' }), 'hitting')
  assert.equal(primaryGroup(null), 'hitting')
})
