// The build pools (#39) over the real org.json snapshot. The snapshot changes
// every night, so these tests check rules that hold for any snapshot, not one
// player's numbers. The rules themselves are pinned in test/percentiles.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { org, allPlayers } from '../src/lib/build/data.js'
import { peerPercentiles } from '../src/lib/build/peers.js'
import { MIN_PA, MIN_IP } from '../src/lib/model/player/sample.js'
import { levelFor } from '../src/lib/model/levels.js'

const brewers = new Set(org.affiliates.map((a) => a.id))
const season = String(org.season)
const everyEntry = () => allPlayers().flatMap((p) => peerPercentiles(p.id).map((e) => ({ id: p.id, ...e })))

test('every entry is this season, at a known level, over the minimum, with a valid percentile', () => {
  const all = everyEntry()
  assert.ok(all.length > 0, 'the snapshot has ranked players')
  for (const e of all) {
    assert.equal(e.season, season)
    assert.ok(levelFor(e.sportId), `${e.id}: sportId ${e.sportId}`)
    if (e.group === 'hitting') assert.ok(e.pa >= MIN_PA, `${e.id} has ${e.pa} PA`)
    else assert.ok(e.outs >= MIN_IP * 3, `${e.id} has ${e.outs} outs`)
    assert.ok(e.size >= 1)
    for (const s of e.stats) {
      assert.ok(s.n <= e.size)
      if (s.pct !== null) assert.ok(Number.isInteger(s.pct) && s.pct >= 0 && s.pct <= 99, `${e.id} ${s.key} ${s.pct}`)
      if (e.size === 1) assert.equal(s.pct, null, 'a group of one has no percentile')
    }
  }
})

test('the pool size is the number of entries at that group and level', () => {
  const all = everyEntry()
  const counts = new Map()
  for (const e of all) counts.set(`${e.group}:${e.sportId}`, (counts.get(`${e.group}:${e.sportId}`) ?? 0) + 1)
  for (const e of all) assert.equal(e.size, counts.get(`${e.group}:${e.sportId}`), `${e.id} ${e.group} ${e.sportId}`)
})

test('the sample of every entry is the sum of his Brewers rows at that level, and no others', () => {
  for (const p of allPlayers()) {
    for (const e of peerPercentiles(p.id)) {
      const mine = p[e.group].filter((r) => r.season === season && r.sportId === e.sportId && brewers.has(r.teamId))
      const field = e.group === 'hitting' ? 'pa' : 'outs'
      assert.ok(mine.length > 0, `${p.id} has no Brewers row at ${e.sportId}`)
      assert.equal(e[field], mine.reduce((t, r) => t + r[field], 0), `${p.id} ${e.group} ${e.sportId}`)
    }
  }
})

test('nobody is ranked at the all-MiLB total, and the Rookie clubs share one pool', () => {
  const all = everyEntry()
  assert.equal(all.filter((e) => e.sportId === 21).length, 0)
  const rookie = all.filter((e) => e.sportId === 16 && e.group === 'hitting')
  assert.ok(new Set(rookie.map((e) => e.size)).size <= 1, 'one size for the whole Rookie hitting pool')
})

test('an id as a string works, and an unknown or empty one has no entries', () => {
  const ranked = allPlayers().find((p) => peerPercentiles(p.id).length)
  assert.deepEqual(peerPercentiles(String(ranked.id)), peerPercentiles(ranked.id))
  assert.deepEqual(peerPercentiles(1), [])
  assert.deepEqual(peerPercentiles(undefined), [])
})
