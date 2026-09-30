// Rates computed from counts (docs/adr/0015) must be the strings the Stats API
// sends. The fixture tests compare every split in three captured responses.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avg, obp, slg, ops, iso, kPct, bbPct, babip, ip, era, whip, k9, bb9, withRates, entryWithRates, playersWithRates } from '../src/lib/model/player/rates.js'
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
  pa: s.plateAppearances, so: s.strikeOuts,
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

// The three hitting fixtures: people-yearbyyear.json (captured 2026-09-24),
// people-mlb-yearbyyear.json and people-milb-careers.json (both 2026-09-29),
// per test/fixtures/manifest.json. The API sends babip, so we compare to it.
// It does not send ISO, K% or BB%: those are checked by hand below.
test('every fixture BABIP matches the API, and its ".---" is null', () => {
  const splits = [mlbPeople, milbPeople, milbCareers].flatMap((f) => everySplit(f, 'hitting'))
  assert.ok(splits.length > 0)
  for (const s of splits) assert.equal(babip(hittingCounts(s)), api(s.babip))
})

test('PA in the fixtures is true PA, so K% and BB% divide by the right number', () => {
  const splits = [mlbPeople, milbPeople, milbCareers].flatMap((f) => everySplit(f, 'hitting'))
  for (const s of splits) {
    const pa = s.atBats + s.baseOnBalls + s.hitByPitch + s.sacFlies + s.sacBunts + s.catchersInterference
    assert.equal(s.plateAppearances, pa)
  }
})

const line = { h: 30, d: 6, t: 1, hr: 4, ab: 100, bb: 10, hbp: 2, sf: 3, pa: 115, so: 26 }

test('ISO is the rounded SLG minus the rounded AVG, so it matches the cells beside it', () => {
  // TB 30 + 6 + 2 + 12 = 50: SLG .500, AVG .300.
  assert.equal(iso(line), '.200')
  // 1 for 3 with a double: SLG .667, AVG .333, ISO .334 (the exact 1/3 is .333).
  assert.equal(iso({ h: 1, d: 1, t: 0, hr: 0, ab: 3 }), '.334')
  assert.equal(iso({ h: 5, d: 0, t: 0, hr: 0, ab: 20 }), '.000')
})

test('K% and BB% are shown to one decimal with a percent sign', () => {
  assert.equal(kPct(line), '22.6%')
  assert.equal(bbPct(line), '8.7%')
  // 1 / 16 is exactly .0625: half up gives 6.3%, not the float's 6.2%.
  assert.equal(kPct({ so: 1, pa: 16 }), '6.3%')
})

test('BABIP is (H - HR) / (AB - SO - HR + SF)', () => {
  assert.equal(babip(line), '.356')
  assert.equal(babip({ h: 1, hr: 0, ab: 3, so: 0, sf: 0 }), '.333')
})

test('a rate the API does not zero-fill is null at a zero denominator, not .000', () => {
  const none = { h: 0, d: 0, t: 0, hr: 0, ab: 0, bb: 0, hbp: 0, sf: 0, pa: 0, so: 0 }
  assert.deepEqual([iso(none), kPct(none), bbPct(none), babip(none)], [null, null, null, null])
  // AB 10, SO 8, HR 2, SF 0: the BABIP denominator is 0.
  const all = { ...none, h: 2, hr: 2, ab: 10, so: 8, pa: 10 }
  assert.equal(babip(all), null)
  assert.equal(iso(all), '.600')
})

test('a missing count gives a null new rate (ADR-0003)', () => {
  assert.equal(kPct({ ...line, so: null }), null)
  assert.equal(bbPct({ ...line, pa: undefined }), null)
  assert.equal(babip({ ...line, sf: null }), null)
  assert.equal(iso({ ...line, d: null }), null)
})

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
  assert.deepEqual(Object.keys(withRates('hitting', {})), ['avg', 'obp', 'slg', 'ops', 'iso', 'kPct', 'bbPct', 'babip'])
  assert.deepEqual(Object.keys(withRates('pitching', {})), ['ip', 'era', 'whip', 'k9', 'bb9'])
})

test('entryWithRates adds rates to a list of rows or to one line, and keeps a null line', () => {
  const h = { ab: 4, h: 1, bb: 0, hbp: 0, sf: 0, d: 0, t: 0, hr: 0 }
  const player = entryWithRates({ name: 'A', hitting: [h], pitching: [] })
  assert.equal(player.name, 'A')
  assert.equal(player.hitting[0].avg, '.250')
  assert.deepEqual(player.pitching, [])
  const line = entryWithRates({ id: 1, hitting: h, pitching: null })
  assert.equal(line.hitting.obp, '.250')
  assert.equal(line.pitching, null)
})

test('playersWithRates adds rates to every player and keeps the ids', () => {
  const out = playersWithRates({ 7: { hitting: [{ ab: 2, h: 1 }], pitching: [{ outs: 4 }] } })
  assert.deepEqual(Object.keys(out), ['7'])
  assert.equal(out[7].hitting[0].avg, '.500')
  assert.equal(out[7].pitching[0].ip, '1.1')
})
