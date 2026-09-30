// Peer percentiles (#39): who is in a pool. Levels, clubs outside the system,
// the Rookie pool, earlier seasons and blank rates. The rank rule is in
// test/percentiles.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { peerLines, buildPeerIndex } from '../src/lib/model/player/percentiles.js'
import { SEASON, BREWERS, hit, pitch, player, index, entries, stat, ladder } from './peer-rows.js'

test('levels are separate pools', () => {
  const idx = index(
    player(1, { hitting: [hit('aa', { h: 30 })] }),
    player(2, { hitting: [hit('aaa', { h: 80 })] }),
    player(3, { hitting: [hit('aa', { h: 70 })] }),
  )
  assert.equal(entries(idx, 1)[0].size, 2)
  assert.equal(stat(entries(idx, 1)[0], 'avg').pct, 25)
  assert.equal(entries(idx, 2)[0].size, 1, 'the only Triple-A hitter is alone')
})

test('hitters and pitchers are separate groups, and a two-way player is in both', () => {
  const idx = index(
    player(1, { hitting: [hit('aa')], pitching: [pitch('aa')] }),
    player(2, { hitting: [hit('aa', { h: 30 })] }),
  )
  const es = entries(idx, 1)
  assert.deepEqual(es.map((e) => e.group), ['hitting', 'pitching'])
  assert.equal(es[0].size, 2)
  assert.equal(es[1].size, 1)
})

test('one entry per level, highest level first', () => {
  const idx = index(player(1, { hitting: [hit('aPlus'), hit('aa'), hit('acl')] }))
  assert.deepEqual(entries(idx, 1).map((e) => e.sportId), [12, 13, 16])
  assert.deepEqual(entries(idx, 1).map((e) => e.level.label), ['AA', 'A+', 'ROK'])
})

test('a player who played for two Brewers clubs at one level is ranked on the whole level', () => {
  // 40 for 100 at ACL and 20 for 100 at DSL: .300 over 200 AB, not .400 or .200.
  const both = player(1, { hitting: [hit('acl', { ab: 100, h: 40, bb: 5, so: 10 }), hit('dsl', { ab: 100, h: 20, bb: 5, so: 30 })] })
  const others = [.250, .350].map((avg, i) => player(i + 2, { hitting: [hit('acl', { ab: 200, h: Math.round(200 * avg) })] }))
  const idx = index(both, ...others)
  const es = entries(idx, 1)
  assert.equal(es.length, 1, 'one entry for the level, not one per club')
  assert.equal(stat(es[0], 'avg').value, '.300')
  assert.equal(es[0].pa, 210)
  assert.equal(es[0].size, 3, 'he is in the pool once')
  assert.equal(stat(es[0], 'avg').pct, 50)
})

test('two Brewers clubs at one level add up to a minimum neither club meets', () => {
  const both = player(1, { hitting: [hit('acl', { ab: 50, bb: 10 }), hit('dsl', { ab: 50, bb: 10 })] })
  assert.equal(entries(index(both, player(2, { hitting: [hit('acl')] })), 1)[0].pa, 120)
})

test('the level line sums pitching counts and takes its rates from them', () => {
  const both = player(1, {
    pitching: [pitch('acl', { ip: 20, er: 10, h: 20, bb: 5, so: 20, bf: 90 }), pitch('dsl', { ip: 20, er: 2, h: 10, bb: 5, so: 30, bf: 80 })],
  })
  const [e] = entries(index(both, player(2, { pitching: [pitch('acl')] })), 1)
  assert.equal(e.outs, 120)
  assert.equal(stat(e, 'era').value, '2.70') // 12 ER in 40 IP
  assert.equal(stat(e, 'kPct').value, '29.4%') // 50 K in 170 BF
})

test('the level line stays blank when a count it needs is missing', () => {
  const rows = [hit('acl'), { ...hit('dsl'), hbp: null }]
  const [line] = peerLines(player(1, { hitting: rows }), SEASON, BREWERS)
  assert.equal(line.line.hbp, null)
  assert.equal(line.line.obp, null, 'a missing HBP gives a blank OBP, not a wrong one')
  assert.equal(line.line.avg, '.250', 'and leaves the rates that do not need it')
})

test('a row at a club outside the system is left out, and so is the level total that adds it', () => {
  // 828824 in 2026: Springfield (a Cardinals club) and Biloxi at Double-A, and a
  // Double-A total of the two.
  const p = player(1, {
    hitting: [
      hit('milb', { ab: 900, h: 400 }), hit('aPlus', { ab: 214, h: 70 }), hit('aa', { ab: 96, bb: 23, h: 28 }),
      hit('cards', { ab: 117, bb: 19, h: 28 }), hit('aaTotal', { ab: 213, bb: 42, h: 56 }),
    ],
  })
  const lines = peerLines(p, SEASON, BREWERS)
  assert.deepEqual(lines.map((l) => l.sportId), [12, 13])
  assert.equal(lines[0].line.ab, 96, 'the Biloxi line alone')
  assert.equal(lines[0].line.pa, 119)
  assert.equal(lines[0].line.avg, '.292')
})

test('a Springfield-only Double-A line is not ranked, whatever its size', () => {
  const p = player(1, { hitting: [hit('cards', { ab: 300 }), hit('aaTotal', { ab: 300 })] })
  assert.deepEqual(entries(index(p, player(2, { hitting: [hit('aa')] })), 1), [])
})

test('a club outside the system does not enter the pool of the level it shares', () => {
  const idx = index(
    player(1, { hitting: [hit('aa', { h: 50 })] }),
    player(2, { hitting: [hit('aa', { h: 70 })] }),
    player(3, { hitting: [hit('cards', { h: 90 })] }),
  )
  assert.equal(entries(idx, 1)[0].size, 2)
  assert.equal(stat(entries(idx, 1)[0], 'avg').pct, 25)
})

test('the all-MiLB total is not a level and is never ranked', () => {
  const p = player(1, { hitting: [hit('milb', { ab: 500 })] })
  assert.deepEqual(peerLines(p, SEASON, new Set([...BREWERS, null])), [])
  assert.deepEqual(entries(index(p), 1), [])
})

test('ACL and DSL players share one Rookie pool', () => {
  const idx = index(
    player(1, { hitting: [hit('acl', { h: 70 })] }),
    player(2, { hitting: [hit('dsl', { h: 50 })] }),
    player(3, { hitting: [hit('dslBlue', { h: 30 })] }),
  )
  for (const id of [1, 2, 3]) {
    assert.equal(entries(idx, id)[0].sportId, 16)
    assert.equal(entries(idx, id)[0].level.label, 'ROK')
    assert.equal(entries(idx, id)[0].size, 3)
  }
  assert.deepEqual([1, 2, 3].map((id) => stat(entries(idx, id)[0], 'avg').pct), [83, 50, 16])
})

test('a row from an earlier season gets no percentile', () => {
  const old = player(1, { hitting: [hit('aa', { season: '2025' })] })
  const idx = index(old, player(2, { hitting: [hit('aa')] }), player(3, { hitting: [hit('aa', { h: 60 })] }))
  assert.deepEqual(entries(idx, 1), [])
  assert.equal(entries(idx, 2)[0].size, 2, 'and is not in the 2026 pool')
})

test('a season is compared as a string or a number', () => {
  const idx = buildPeerIndex({ players: ladder(), season: 2026, brewersIds: BREWERS })
  assert.equal(entries(idx, 1)[0].size, 5)
})

test('a missing rate gives a null percentile for that stat only', () => {
  const blank = { ...hit('aa'), obp: null }
  const idx = index(player(1, { hitting: [blank] }), ...ladder().slice(1, 3))
  const [e] = entries(idx, 1)
  assert.equal(stat(e, 'obp').value, null)
  assert.equal(stat(e, 'obp').pct, null)
  assert.equal(stat(e, 'obp').n, 2, 'the two players with an OBP')
  assert.notEqual(stat(e, 'avg').pct, null)
  assert.equal(stat(e, 'avg').n, 3)
})

test('an unknown player has no entries', () => {
  assert.deepEqual(entries(index(...ladder()), 999), [])
})

test('a line at a level the site does not know is left out', () => {
  const p = player(1, { hitting: [hit('aa')] })
  p.hitting[0].sportId = 99
  assert.deepEqual(peerLines(p, SEASON, BREWERS), [])
})
