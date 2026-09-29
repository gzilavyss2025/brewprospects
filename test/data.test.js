// The generator's pure shaping and the Pipeline parser, pinned on captured
// live responses so no test needs the network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slimPerson, slimRosterEntry } from '../scripts/data/lib/slim.mjs'
import {
  extractEntries, assertTop100Shape, assertOrgShape, dedupeByPlayer, statLineFor,
} from '../scripts/data/lib/pipeline-parse.mjs'
import people from './fixtures/people-yearbyyear.json' with { type: 'json' }

test('slimPerson keeps bio fields and every yearByYear split', () => {
  const made = slimPerson(people.people.find((p) => p.id === 815908))
  assert.equal(made.name, 'Jesús Made')
  assert.equal(made.pos, 'SS')
  assert.equal(made.bats, 'S')
  assert.equal(made.draft, null, 'an international signee has no draft record')
  const aa2026 = made.hitting.find((r) => r.season === '2026' && r.sportId === 12)
  assert.equal(aa2026.team, 'Biloxi Shuckers')
  assert.equal(aa2026.g, 122)
  assert.equal(aa2026.avg, '.271')
})

test('slimPerson keeps the draft record of a drafted player', () => {
  const adams = slimPerson(people.people.find((p) => p.id === 677941))
  assert.equal(adams.draft.year, 2018)
  assert.equal(adams.draft.round, '1')
})

test('slimPerson survives a person with no stats and no bio', () => {
  const p = slimPerson({ id: 1 })
  assert.deepEqual(p.hitting, [])
  assert.deepEqual(p.pitching, [])
  assert.equal(p.birthPlace, null)
  assert.equal(p.pos, '')
})

test('a placeholder rate like ".---" is stored as missing, not as a value', () => {
  const p = slimPerson({
    id: 1,
    stats: [{ group: { displayName: 'pitching' }, type: { displayName: 'yearByYear' },
      splits: [{ season: '2026', sport: { id: 14 }, team: { id: 1 }, stat: { era: '-.--', whip: '1.20' } }] }],
  })
  assert.equal(p.pitching[0].era, null)
  assert.equal(p.pitching[0].whip, '1.20')
})

test('slimRosterEntry reads the live roster shape and treats a blank jersey as none', () => {
  const e = slimRosterEntry({
    person: { id: 7, fullName: 'A B' }, jerseyNumber: '', position: { abbreviation: 'P' },
    status: { code: 'RL', description: 'Released' },
  })
  assert.deepEqual(e, { id: 7, name: 'A B', jersey: null, pos: 'P', status: 'RL', statusText: 'Released' })
})

const entry = (rank, playerId, teamId, extra = {}) => ({ rank, playerId, teamId, ...extra })

test('extractEntries reads the embedded list and rejects a changed page', () => {
  const list = Array.from({ length: 60 }, (_, i) => entry(i + 1, i + 1, 1))
  assert.equal(extractEntries(`<script>var data = ${JSON.stringify(list)};</script>`).length, 60)
  assert.throws(() => extractEntries('<html>nothing here</html>'))
  assert.throws(() => extractEntries(`var data = ${JSON.stringify(list.slice(0, 10))};`))
})

test('shape guards tell the Top 100 and the per-org list apart', () => {
  const top100 = Array.from({ length: 100 }, (_, i) => entry(i + 1, i + 1, i % 30))
  const org = Array.from({ length: 900 }, (_, i) => entry((i % 30) + 1, i + 1, Math.floor(i / 30)))
  assert.doesNotThrow(() => assertTop100Shape(top100))
  assert.throws(() => assertTop100Shape(org))
  assert.doesNotThrow(() => assertOrgShape(org))
  assert.throws(() => assertOrgShape(top100))
})

test('dedupeByPlayer keeps the stat line that matches the position', () => {
  const kept = dedupeByPlayer([
    entry(3, 9, 158, { position: 'RHP', battingStats: { avg: '.000' } }),
    entry(3, 9, 158, { position: 'RHP', pitchingStats: { era: '2.00' } }),
  ])
  assert.equal(kept.length, 1)
  assert.ok(kept[0].pitchingStats)
})

test('statLineFor drops missing parts', () => {
  assert.equal(statLineFor({ battingStats: { homeRuns: 14, rbi: 91 }, avg: '.271' }), '.271, 14 HR, 91 RBI')
  assert.equal(statLineFor({ pitchingStats: { inningsPitched: '85.0', strikeOuts: 89 } }), '85.0 IP, 89 SO')
  assert.equal(statLineFor({}), '')
})
