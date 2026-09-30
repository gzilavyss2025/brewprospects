// Peer percentiles (#39): the rank rule, the stat directions, ties and the minimum sample.
// Pools (levels, clubs, seasons) are in test/peer-pools.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN_PA, MIN_IP } from '../src/lib/model/player/sample.js'
import { percentileRank } from '../src/lib/model/player/percentiles.js'
import { SEASON, hit, pitch, player, index, entries, stat, ladder } from './peer-rows.js'

test('percentileRank uses the mid-rank: below plus half of equal, over the group', () => {
  assert.equal(percentileRank(3, [1, 2, 3, 4, 5]), 50)
  assert.equal(percentileRank(5, [1, 2, 3, 4, 5]), 90)
  assert.equal(percentileRank(1, [1, 2, 3, 4, 5]), 10)
})

test('percentileRank cannot reach 100 and floors, so a 1-in-200 best is the 99th', () => {
  const group = Array.from({ length: 200 }, (_, i) => i)
  assert.equal(percentileRank(199, group), 99)
  assert.equal(percentileRank(0, group), 0)
})

test('ties share the mid-rank of the tied block', () => {
  const values = [.300, .300, .250]
  assert.equal(percentileRank(.300, values), 66)
  assert.equal(percentileRank(.250, values), 16)
})

test('lowerIsBetter flips the rank so a high percentile is always good', () => {
  assert.equal(percentileRank(1, [1, 2, 3, 4, 5], { lowerIsBetter: true }), 90)
  assert.equal(percentileRank(5, [1, 2, 3, 4, 5], { lowerIsBetter: true }), 10)
})

test('a group of one has no percentile', () => {
  assert.equal(percentileRank(3, [3]), null)
  assert.equal(percentileRank(3, []), null)
})

test('a hitter ranks against the other hitters at his level, best AVG on top', () => {
  const idx = index(...ladder())
  const best = entries(idx, 4)
  assert.equal(best.length, 1)
  assert.equal(best[0].group, 'hitting')
  assert.equal(best[0].sportId, 12)
  assert.equal(best[0].season, SEASON)
  assert.equal(best[0].size, 5)
  assert.equal(stat(best[0], 'avg').value, '.280')
  assert.equal(stat(best[0], 'avg').pct, 90)
  assert.equal(stat(best[0], 'avg').n, 5)
  assert.equal(stat(entries(idx, 1)[0], 'avg').pct, 10)
})

test('a hitter gets AVG, OBP, SLG, OPS, ISO, K% and BB%, in that order', () => {
  const [e] = entries(index(...ladder()), 1)
  assert.deepEqual(e.stats.map((s) => s.key), ['avg', 'obp', 'slg', 'ops', 'iso', 'kPct', 'bbPct'])
})

test('a pitcher gets ERA, WHIP, K% and BB%', () => {
  const idx = index(player(1, { pitching: [pitch('aa')] }), player(2, { pitching: [pitch('aa', { er: 10 })] }))
  const [e] = entries(idx, 1)
  assert.equal(e.group, 'pitching')
  assert.deepEqual(e.stats.map((s) => s.key), ['era', 'whip', 'kPct', 'bbPct'])
  assert.equal(e.outs, 150)
})

test('ERA and WHIP: the lower one ranks higher', () => {
  const idx = index(
    player(1, { pitching: [pitch('aa', { er: 10, h: 30, bb: 10 })] }),
    player(2, { pitching: [pitch('aa', { er: 20, h: 45, bb: 15 })] }),
    player(3, { pitching: [pitch('aa', { er: 30, h: 60, bb: 25 })] }),
  )
  for (const key of ['era', 'whip']) {
    assert.deepEqual([1, 2, 3].map((id) => stat(entries(idx, id)[0], key).pct), [83, 50, 16], key)
  }
})

test('K% flips for a hitter and not for a pitcher; BB% is the other way round', () => {
  const hitters = index(
    player(1, { hitting: [hit('aa', { so: 20, bb: 10 })] }),
    player(2, { hitting: [hit('aa', { so: 60, bb: 40 })] }),
  )
  // Fewer strikeouts is better for a hitter, more walks is better.
  assert.equal(stat(entries(hitters, 1)[0], 'kPct').pct, 75)
  assert.equal(stat(entries(hitters, 2)[0], 'kPct').pct, 25)
  assert.equal(stat(entries(hitters, 1)[0], 'bbPct').pct, 25)
  assert.equal(stat(entries(hitters, 2)[0], 'bbPct').pct, 75)
  const pitchers = index(
    player(1, { pitching: [pitch('aa', { so: 80, bb: 10 })] }),
    player(2, { pitching: [pitch('aa', { so: 30, bb: 40 })] }),
  )
  // More strikeouts is better for a pitcher, fewer walks is better.
  assert.equal(stat(entries(pitchers, 1)[0], 'kPct').pct, 75)
  assert.equal(stat(entries(pitchers, 1)[0], 'bbPct').pct, 75)
  assert.equal(stat(entries(pitchers, 2)[0], 'kPct').pct, 25)
  assert.equal(stat(entries(pitchers, 2)[0], 'bbPct').pct, 25)
})

test('equal lines rank equal', () => {
  const idx = index(
    player(1, { hitting: [hit('aa', { h: 60 })] }),
    player(2, { hitting: [hit('aa', { h: 60 })] }),
    player(3, { hitting: [hit('aa', { h: 40 })] }),
  )
  assert.equal(stat(entries(idx, 1)[0], 'avg').pct, 66)
  assert.equal(stat(entries(idx, 2)[0], 'avg').pct, 66)
  assert.equal(stat(entries(idx, 3)[0], 'avg').pct, 16)
})

test('ties are judged on the rate the reader sees', () => {
  // 61 for 200 and 60 for 197 differ exactly (.3050 and .3046) but both show as
  // .305, so they tie. 61 for 199 shows as .307.
  const idx = index(
    player(1, { hitting: [hit('aa', { ab: 200, h: 61 })] }),
    player(2, { hitting: [hit('aa', { ab: 197, h: 60 })] }),
    player(3, { hitting: [hit('aa', { ab: 199, h: 61 })] }),
  )
  assert.equal(stat(entries(idx, 1)[0], 'avg').value, '.305')
  assert.equal(stat(entries(idx, 2)[0], 'avg').value, '.305')
  assert.equal(stat(entries(idx, 3)[0], 'avg').value, '.307')
  assert.equal(stat(entries(idx, 1)[0], 'avg').pct, stat(entries(idx, 2)[0], 'avg').pct)
})

test('below the minimum: no rank, and not in the pool', () => {
  const small = player(9, { hitting: [hit('aa', { ab: MIN_PA - 21, bb: 20, h: 60 })] }) // 99 PA, best AVG
  const idx = index(...ladder(), small)
  assert.deepEqual(entries(idx, 9), [])
  assert.equal(entries(idx, 4)[0].size, 5, 'the 99-PA hitter is not in the pool')
  assert.equal(stat(entries(idx, 4)[0], 'avg').pct, 90, 'and does not move anyone')
})

test('exactly the minimum counts', () => {
  const idx = index(
    player(1, { hitting: [hit('aa', { ab: MIN_PA - 20, bb: 20 })] }),
    player(2, { hitting: [hit('aa', { ab: 250 })] }),
  )
  assert.equal(entries(idx, 1)[0].size, 2)
  assert.equal(entries(idx, 1)[0].pa, MIN_PA)
})

test('a pitcher needs MIN_IP innings, counted in outs', () => {
  const idx = index(
    player(1, { pitching: [pitch('aa', { ip: MIN_IP })] }),
    player(2, { pitching: [{ ...pitch('aa', { ip: MIN_IP }), outs: MIN_IP * 3 - 1 }] }),
    player(3, { pitching: [pitch('aa', { ip: 60 })] }),
  )
  assert.equal(entries(idx, 1)[0].size, 2)
  assert.deepEqual(entries(idx, 2), [])
})

test('a group of one keeps its entry with a null percentile and a size of 1', () => {
  const [e] = entries(index(player(1, { hitting: [hit('aaa')] })), 1)
  assert.equal(e.size, 1)
  assert.equal(stat(e, 'avg').pct, null)
  assert.equal(stat(e, 'avg').n, 1)
  assert.equal(stat(e, 'avg').value, '.250', 'the value stays: it is on record')
})

