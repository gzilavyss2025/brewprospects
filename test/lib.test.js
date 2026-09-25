import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playerSlug, idFromSlug, slugify, paths, canonicalUrl } from '../src/lib/slug.js'
import { orDash, heightWeight, batsThrows, DASH } from '../src/lib/format.js'
import { contrastRatio, pickInk } from '../src/lib/color.js'
import { accentFor, BREWERS, clubIdentity } from '../src/lib/affiliates.js'
import { cardPlayerIds, linkedPlayerIds, postsForPlayer } from '../src/lib/posts.js'
import { pickSeasonLine, lineText } from '../src/lib/card.js'
import season from './fixtures/person-season.json' with { type: 'json' }
import multi from './fixtures/person-season-multilevel.json' with { type: 'json' }

test('player slugs carry a readable name and a trusted id', () => {
  assert.equal(playerSlug('Jesús Made', 815908), 'jesus-made-815908')
  assert.equal(playerSlug("Jake O'Brien Jr.", 5), 'jake-o-brien-jr-5')
  assert.equal(playerSlug('', 5), '5')
  assert.equal(idFromSlug('jesus-made-815908'), 815908)
  assert.equal(idFromSlug('no-id'), null)
  assert.equal(slugify(null), '')
})

test('format helpers show a dash for anything missing', () => {
  for (const v of [null, undefined, '', '  ', NaN, Infinity]) assert.equal(orDash(v), DASH)
  assert.equal(orDash(0), '0')
  assert.equal(heightWeight(null, null), DASH)
  assert.equal(heightWeight(`6' 1"`, 221), `6' 1", 221 lb`)
  assert.equal(batsThrows(null, null), DASH)
  assert.equal(batsThrows('S', null), 'S/?')
})

test('contrast math matches known WCAG values', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21)
  assert.equal(contrastRatio('#fff', 'nope'), null)
  assert.equal(pickInk('#12284b'), '#ffffff')
  assert.equal(pickInk('#ffc52f'), '#12284b')
})

test('every affiliate accent gets an ink that passes WCAG AA', () => {
  for (const id of [556, 5015, 572, 249, 406, 2101, 607]) {
    const a = accentFor(id)
    assert.ok(contrastRatio(a.primary, a.ink) >= 4.5, `club ${id}: ${a.primary} on ${a.ink}`)
  }
})

test('a club with no researched color falls back to Brewers navy, not a guess', () => {
  const a = accentFor(406)
  assert.equal(a.primary, BREWERS.navy)
  assert.equal(a.researched, false)
})

// Names from src/data/archive/*.json and org.json (2026), checked 2026-09-25.
test('a past club under a reused team id gets no logo and no club color', () => {
  const mudcats = clubIdentity({ id: 249, name: 'Carolina Mudcats' }, 'Wilson Warbirds')
  assert.equal(mudcats.logo, null)
  assert.equal(mudcats.accent.primary, BREWERS.navy)
  assert.equal(mudcats.accent.researched, false)
})

test('a club no longer affiliated gets no logo', () => {
  assert.equal(clubIdentity({ id: 559, name: 'Huntsville Stars' }, undefined).logo, null)
})

test('a renamed complex club gets no logo, even with the same id', () => {
  assert.equal(clubIdentity({ id: 406, name: 'AZL Brewers' }, 'ACL Brewers').logo, null)
})

test('a club that still has its name keeps its logo and color', () => {
  const tr = clubIdentity({ id: 572, name: 'Wisconsin Timber Rattlers' }, 'Wisconsin Timber Rattlers')
  assert.match(tr.logo, /team-logos\/572\.svg$/)
  assert.equal(tr.accent.researched, true)
})

test('posts link to players through the players field and through cards', () => {
  const body = 'x {% prospect-card playerId=815908 /%} y {%prospect-card playerId=12 %}'
  assert.deepEqual(cardPlayerIds(body), [815908, 12])
  assert.deepEqual(cardPlayerIds(undefined), [])
  const post = { data: { players: [815908, 3] }, body }
  assert.deepEqual(linkedPlayerIds(post).sort((a, b) => a - b), [3, 12, 815908])
})

test('postsForPlayer lists newest first and survives an undated post', () => {
  const posts = [
    { id: 'a', data: { date: '2026-05-01', players: [1] } },
    { id: 'b', data: { date: '2026-06-01', players: [1] } },
    { id: 'c', data: { players: [1] } },
    { id: 'd', data: { date: '2026-07-01', players: [2] } },
  ]
  assert.deepEqual(postsForPlayer(posts, 1).map((p) => p.id), ['b', 'a', 'c'])
})

// Pinned on captured live responses (person 815908).
test('card line: one level shows that level', () => {
  const line = pickSeasonLine(season.people[0].stats, 'hitting')
  assert.deepEqual(line.levels, ['AA'])
  assert.match(lineText(line, 'hitting'), /^\.\d{3}\/\.\d{3}\/\.\d{3}, \d+ HR, \d+ SB$/)
})

test('card line: several levels show the MiLB total, levels low to high', () => {
  const line = pickSeasonLine(multi.people[0].stats, 'hitting')
  assert.deepEqual(line.levels, ['A', 'A+', 'AA'])
  assert.equal(line.stat.gamesPlayed, 115)
})

test('card line: no games gives a sentence, missing fields give dashes', () => {
  assert.equal(pickSeasonLine([], 'pitching'), null)
  assert.equal(lineText(null, 'pitching'), 'No games this season.')
  assert.equal(lineText({ stat: {} }, 'pitching'), `${DASH} ERA, ${DASH} IP, ${DASH} SO`)
})

test('every public path is built one way, with no trailing slash', () => {
  assert.equal(paths.player('Jesús Made', 815908), '/players/jesus-made-815908')
  assert.equal(paths.club('Wilson Warbirds', 249), '/clubs/wilson-warbirds-249')
  assert.equal(paths.season(2019), '/seasons/2019')
  assert.equal(paths.post('features', 'welcome-to-the-farm'), '/posts/features/welcome-to-the-farm')
})

test('the canonical URL drops a trailing slash and keeps the home page', () => {
  assert.equal(canonicalUrl('https://example.com', '/seasons/2019/'), 'https://example.com/seasons/2019')
  assert.equal(canonicalUrl(new URL('https://example.com'), '/'), 'https://example.com/')
})

test('no site origin means no canonical URL, not a guessed one', () => {
  assert.equal(canonicalUrl(undefined, '/players'), null)
})
