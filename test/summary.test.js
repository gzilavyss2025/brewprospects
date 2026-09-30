// The plain-language season summary (#50). Rows come from test/peer-rows.js,
// the same rows the percentile tests use; the peer entries come from the same
// model the page reads (peerPercentilesFor), so a change to an entry's shape
// breaks these tests too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seasonSummary } from '../src/lib/model/player/summary.js'
import { withRates } from '../src/lib/model/player/rates.js'
import { hit, pitch, player, index, entries, BREWERS, SEASON } from './peer-rows.js'

const CLUB_NAMES = new Map([
  [556, 'Nashville Sounds'],
  [5015, 'Biloxi Shuckers'],
  [572, 'Wisconsin Timber Rattlers'],
  [406, 'ACL Brewers'],
  [2101, 'DSL Brewers Gold'],
  [607, 'DSL Brewers Blue'],
  [440, 'Springfield Cardinals'],
])

// The summary for `id`, with the peer entries the page would pass.
function summarize(idx, p, over = {}) {
  return seasonSummary({
    player: p,
    season: SEASON,
    brewersIds: BREWERS,
    peers: entries(idx, p.id),
    clubNames: CLUB_NAMES,
    ...over,
  })
}

// Five AA hitters, 250 AB each, hits 40 to 70. The subject is the one with 60.
const aaHitters = (subject = 682633) => {
  const others = [40, 50, 70, 55].map((h, i) => player(i + 1, { hitting: [hit('aa', { ab: 250, h })] }))
  return [player(subject, { hitting: [hit('aa', { ab: 250, h: 60 })] }), ...others]
}

test('a hitter gets his line, the club, and a percentile in OPS with the pool size', () => {
  const [me, ...rest] = aaHitters()
  const out = summarize(index(me, ...rest), me)
  assert.equal(
    out.text,
    'Hitting .240/.296/.340 for Biloxi Shuckers. 70th percentile in OPS among 5 Brewers Double-A hitters.',
  )
})

test('a pitcher gets his line, the club, and a percentile in ERA with the pool size', () => {
  const me = player(657649, { pitching: [pitch('aa', { ip: 60, er: 15 })] })
  const rest = [20, 25].map((er, i) => player(i + 1, { pitching: [pitch('aa', { ip: 60, er })] }))
  const out = summarize(index(me, ...rest), me)
  assert.equal(
    out.text,
    'Pitching 2.25 ERA, 1.00 WHIP for Biloxi Shuckers. 83rd percentile in ERA among 3 Brewers Double-A pitchers.',
  )
})

test('the ordinal follows the percentile, 11th to 13th included', () => {
  const [me, ...rest] = aaHitters()
  const idx = index(me, ...rest)
  for (const [pct, word] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [0, '0th']]) {
    const peers = entries(idx, me.id).map((e) => ({ ...e, stats: e.stats.map((s) => (s.key === 'ops' ? { ...s, pct } : s)) }))
    assert.match(summarize(idx, me, { peers }).text, new RegExp(`${word} percentile in OPS`))
  }
})

test('a small sample gives the line and "Small sample.", and no rank', () => {
  const me = player(682633, { hitting: [hit('aa', { ab: 45, h: 12, bb: 5, so: 10 })] })
  const idx = index(me, ...aaHitters(999).slice(1))
  assert.deepEqual(entries(idx, me.id), [], 'the model gives him no entry')
  const out = summarize(idx, me)
  assert.equal(out.text, 'Hitting .267/.340/.822 for Biloxi Shuckers. Small sample.')
})

test('a small sample is not ranked even when the caller passes an entry', () => {
  const me = player(682633, { hitting: [hit('aa', { ab: 45, h: 12, bb: 5, so: 10 })] })
  const [other] = entries(index(...aaHitters(999)), 999)
  const out = summarize(index(me), me, { peers: [other] })
  assert.doesNotMatch(out.text, /percentile/)
  assert.match(out.text, /Small sample\.$/)
})

test('a small pitcher sample says so too', () => {
  const me = player(657649, { pitching: [pitch('aa', { ip: 12, er: 4 })] })
  const out = summarize(index(me), me)
  assert.equal(out.text, 'Pitching 3.00 ERA, 5.00 WHIP for Biloxi Shuckers. Small sample.')
})

test('a missing rate is dropped, never filled', () => {
  const [me, ...rest] = aaHitters()
  const idx = index(me, ...rest)
  const holey = { ...me, hitting: [{ ...me.hitting[0], obp: null, slg: '.---' }] }
  const out = summarize(idx, holey)
  assert.match(out.text, /^Hitting \.240 AVG for Biloxi Shuckers\./)
  assert.doesNotMatch(out.text, /\.296|\.340|\.---|null/)
})

test('a missing pitching rate is dropped, and a real zero stays', () => {
  const me = player(657649, { pitching: [pitch('aa', { ip: 60, er: 0 })] })
  assert.equal(summarize(index(me), me).text, 'Pitching 0.00 ERA, 1.00 WHIP for Biloxi Shuckers.')
  const holey = { ...me, pitching: [{ ...me.pitching[0], era: null }] }
  assert.equal(summarize(index(me), holey).text, 'Pitching 1.00 WHIP for Biloxi Shuckers.')
})

test('a hitter with .000 from real counts keeps it', () => {
  const me = player(682633, { hitting: [hit('aa', { ab: 100, h: 0, bb: 0, so: 30, hr: 0 })] })
  const row = withRates('hitting', { ...me.hitting[0], d: 0, t: 0 })
  const out = summarize(index(me), { ...me, hitting: [row] })
  assert.match(out.text, /^Hitting \.000\/\.000\/\.000 for Biloxi Shuckers\./)
})

test('a line with nothing to show and no rank is null', () => {
  const me = player(682633, { hitting: [hit('aa')] })
  const row = { ...me.hitting[0], avg: null, obp: null, slg: null, ops: null }
  assert.equal(summarize(index(), { ...me, hitting: [row] }), null)
})

test('a pool of one has no percentile, so the clause is dropped', () => {
  const me = player(682633, { hitting: [hit('aa', { ab: 250, h: 60 })] })
  const idx = index(me)
  assert.equal(entries(idx, me.id)[0].stats.find((s) => s.key === 'ops').pct, null)
  assert.equal(summarize(idx, me).text, 'Hitting .240/.296/.340 for Biloxi Shuckers.')
})

test('a blank OPS drops the clause even in a pool of many', () => {
  const [me, ...rest] = aaHitters()
  const idx = index(me, ...rest)
  const peers = entries(idx, me.id).map((e) => ({ ...e, stats: e.stats.map((s) => (s.key === 'ops' ? { ...s, value: null, pct: null } : s)) }))
  assert.equal(summarize(idx, me, { peers }).text, 'Hitting .240/.296/.340 for Biloxi Shuckers.')
})

test('two Brewers clubs at one level: a summed line, and "at <level>"', () => {
  const me = player(828824, { hitting: [hit('acl', { ab: 60, h: 20, bb: 10 }), hit('dsl', { ab: 60, h: 20, bb: 10 })] })
  const mate = player(1, { hitting: [hit('dslBlue', { ab: 100, h: 20, bb: 10 })] })
  const out = summarize(index(me, mate), me)
  assert.equal(
    out.text,
    'Hitting .333/.429/.750 at Rookie. 75th percentile in OPS among 2 Brewers Rookie hitters.',
  )
  assert.doesNotMatch(out.text, /ACL|DSL/)
})

test('a club with no name on record falls back to the level', () => {
  const [me, ...rest] = aaHitters()
  const out = summarize(index(me, ...rest), me, { clubNames: new Map() })
  assert.match(out.text, /^Hitting \.240\/\.296\/\.340 at Double-A\./)
})

test('no current season gives null', () => {
  const [me, ...rest] = aaHitters()
  const idx = index(me, ...rest)
  assert.equal(summarize(idx, me, { season: null }), null)
  assert.equal(summarize(idx, me, { season: undefined }), null)
})

test('no rows this season gives null', () => {
  const me = player(682633, { hitting: [hit('aa', { season: '2025' })] })
  assert.equal(summarize(index(me), me), null)
  assert.equal(summarize(index(), player(5, {})), null)
})

test('a row at a club outside the system is never used or named', () => {
  const me = player(676467, { hitting: [hit('cards', { ab: 300, h: 120 }), hit('aa', { ab: 250, h: 60 })] })
  const out = summarize(index(me), me)
  assert.equal(out.text, 'Hitting .240/.296/.340 for Biloxi Shuckers.')
  assert.doesNotMatch(out.text, /Springfield|Cardinals/)
})

test('a player with only rows outside the system gets null', () => {
  const me = player(676467, { hitting: [hit('cards', { ab: 300, h: 120 })], pitching: [pitch('cards')] })
  assert.equal(summarize(index(me), me), null)
})

test('the highest level leads, and hitting comes before pitching at one level', () => {
  const both = player(695501, { hitting: [hit('aPlus'), hit('aa')], pitching: [pitch('aa')] })
  assert.match(summarize(index(both), both).text, /^Hitting .* for Biloxi Shuckers\./)
  const arm = player(695501, { hitting: [hit('aa')], pitching: [pitch('aa')] })
  assert.match(summarize(index(arm), arm).text, /^Hitting /)
  const pitcher = player(695501, { pitching: [pitch('aa')] })
  assert.match(summarize(index(pitcher), pitcher).text, /^Pitching /)
})

test('the text is plain: no markup, and short', () => {
  const [me, ...rest] = aaHitters()
  const { text } = summarize(index(me, ...rest), me)
  assert.doesNotMatch(text, /[<>&]/)
  assert.ok(text.split(/(?<=\.)\s/).length <= 2, 'one or two sentences')
})

test('a pitcher with a stray batting row is summarised as a pitcher', () => {
  const stray = hit('aa', { ab: 2, h: 0, bb: 1, so: 1, hr: 0 })
  const me = { ...player(695501, { hitting: [stray], pitching: [pitch('aa', { ip: 60, er: 15 })] }), pos: 'P' }
  assert.match(summarize(index(me), me).text, /^Pitching 2\.25 ERA, 1\.00 WHIP for Biloxi Shuckers\./)
  const small = { ...player(695501, { hitting: [stray], pitching: [pitch('aa', { ip: 12, er: 4 })] }), pos: 'P' }
  assert.match(summarize(index(small), small).text, /^Pitching .* Small sample\.$/)
})

test('a short stint at a higher level does not hide a full season at a lower one', () => {
  const brief = hit('aaa', { ab: 8, h: 1, bb: 0, so: 3, hr: 0 })
  const me = player(682633, { hitting: [brief, hit('aa', { ab: 250, h: 60 })] })
  const [, ...rest] = aaHitters()
  const out = summarize(index(me, ...rest), me)
  assert.equal(out.text, 'Hitting .240/.296/.340 for Biloxi Shuckers. 70th percentile in OPS among 5 Brewers Double-A hitters.')
  const arm = player(657649, { pitching: [pitch('aaa', { ip: 4, er: 1 }), pitch('aa', { ip: 60, er: 15 })] })
  assert.match(summarize(index(arm), arm).text, /^Pitching 2\.25 ERA, 1\.00 WHIP for Biloxi Shuckers\./)
})
