// Rates computed from counts (docs/adr/0015) must be the strings the Stats API
// sends. The fixture tests compare every split in three captured responses.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avg, obp, slg, ops, ip, era, whip, k9, bb9, withRates } from '../src/lib/model/player/rates.js'
import mlbPeople from './fixtures/people-mlb-yearbyyear.json' with { type: 'json' }
import milbPeople from './fixtures/people-yearbyyear.json' with { type: 'json' }
import milbCareers from './fixtures/people-milb-careers.json' with { type: 'json' }

// The API's own strings, with its "-.--" and ".---" read as null, as slim does.
const api = (v) => (typeof v === 'string' && v !== '' && !/^[.-]+$/.test(v) ? v : null)

function everySplit(fixture, group) {
  return fixture.people.flatMap((p) =>
    (p.stats ?? []).filter((s) => s.group?.displayName === group).flatMap((s) => s.splits.map((sp) => sp.stat)),
  )
}

const hittingCounts = (s) => ({
  h: s.hits, d: s.doubles, t: s.triples, hr: s.homeRuns, ab: s.atBats, bb: s.baseOnBalls, hbp: s.hitByPitch, sf: s.sacFlies,
})
const pitchingCounts = (s) => ({ h: s.hits, bb: s.baseOnBalls, so: s.strikeOuts, er: s.earnedRuns, outs: s.outs })

const FIXTURES = { MLB: [mlbPeople], MiLB: [milbPeople, milbCareers] }

for (const [name, fixtures] of Object.entries(FIXTURES)) {
  test(`every ${name} hitting rate in the fixtures matches the API`, () => {
    const splits = fixtures.flatMap((f) => everySplit(f, 'hitting'))
    assert.ok(splits.length > 0)
    for (const s of splits) {
      const r = hittingCounts(s)
      assert.deepEqual([avg(r), obp(r), slg(r), ops(r)], [s.avg, s.obp, s.slg, s.ops].map(api))
    }
  })

  test(`every ${name} pitching rate in the fixtures matches the API`, () => {
    const splits = fixtures.flatMap((f) => everySplit(f, 'pitching'))
    assert.ok(splits.length > 0)
    for (const s of splits) {
      const r = pitchingCounts(s)
      assert.deepEqual(
        [ip(r), era(r), whip(r), k9(r), bb9(r)],
        [s.inningsPitched, s.era, s.whip, s.strikeoutsPer9Inn, s.walksPer9Inn].map(api),
      )
    }
  })
}

test('OPS adds the rounded OBP and SLG, as the API does', () => {
  // 1 for 3: the exact sum 2/3 rounds to .667, but .333 + .333 is .666.
  // Rounding the exact sum was wrong on 1,167 of the MLB rows checked.
  const r = { h: 1, d: 0, t: 0, hr: 0, ab: 3, bb: 0, hbp: 0, sf: 0 }
  assert.equal(ops(r), '.666')
})

test('a hitting rate with a denominator of 0 is .000, as the API sends it', () => {
  const none = { h: 0, d: 0, t: 0, hr: 0, ab: 0, bb: 0, hbp: 0, sf: 0 }
  assert.deepEqual([avg(none), obp(none), slg(none), ops(none)], ['.000', '.000', '.000', '.000'])
  const walked = { ...none, bb: 1 }
  assert.deepEqual([avg(walked), obp(walked), slg(walked), ops(walked)], ['.000', '1.000', '.000', '1.000'])
})

test('a pitching rate with 0 outs is null, and IP is 0.0', () => {
  const r = { h: 3, bb: 1, so: 0, er: 2, outs: 0 }
  assert.deepEqual([ip(r), era(r), whip(r), k9(r), bb9(r)], ['0.0', null, null, null, null])
})

test('rounding is half up on the exact fraction, not on a float', () => {
  // 27 * 201 / 5400 is exactly 1.005. (1.005).toFixed(2) gives "1.00".
  assert.equal(era({ er: 201, outs: 5400 }), '1.01')
  assert.equal(avg({ h: 1, ab: 16 }), '.063')
  assert.equal(ip({ outs: 331 }), '110.1')
})

test('a missing count gives null, never a guess (ADR-0003)', () => {
  const r = { h: 10, d: 1, t: 0, hr: 1, ab: 40, bb: 4, hbp: null, sf: 0 }
  assert.equal(avg(r), '.250')
  assert.equal(obp(r), null)
  assert.equal(ops(r), null)
  assert.equal(era({ er: null, outs: 30 }), null)
})

test('withRates adds the columns each stat table reads', () => {
  assert.deepEqual(Object.keys(withRates('hitting', {})), ['avg', 'obp', 'slg', 'ops'])
  assert.deepEqual(Object.keys(withRates('pitching', {})), ['ip', 'era', 'whip', 'k9', 'bb9'])
})
