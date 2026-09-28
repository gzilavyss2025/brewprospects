import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playerSlug, idFromSlug, slugify, paths, canonicalUrl, stalePlayerPath } from '../src/lib/slug.js'
import { orDash, heightWeight, batsThrows, DASH } from '../src/lib/format.js'
import { contrastRatio, pickInk } from '../src/lib/identity/color.js'
import { accentFor, accentProblems, measureAccent, ACCENTS, ACCENT_MIN, BREWERS, clubIdentity } from '../src/lib/identity/affiliates.js'
import { cardPlayerIds, linkedPlayerIds, postsForPlayer, isListedPost, POST_TYPES } from '../src/lib/model/posts.js'
import { pickSeasonLine, lineText } from '../src/lib/model/card.js'
import { feedItems } from '../src/lib/model/feed.js'
import { feedOrigin } from '../src/config/site.js'
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

test('a stale player path leads to the current one by its id', () => {
  const map = { 815908: '/players/jesus-made-815908', 5: '/players/5' }
  assert.equal(stalePlayerPath('/players/jesus-made-lugo-815908', map), '/players/jesus-made-815908')
  assert.equal(stalePlayerPath('/players/Jesus-Made-815908', map), '/players/jesus-made-815908')
  assert.equal(stalePlayerPath('/players/jesus-made-815908/', map), '/players/jesus-made-815908')
  assert.equal(stalePlayerPath('/players/815908', map), '/players/jesus-made-815908')
  assert.equal(stalePlayerPath('/players/any-name-5', map), '/players/5')
})

test('a player path with no page, no id or no change leads nowhere', () => {
  const map = { 815908: '/players/jesus-made-815908' }
  assert.equal(stalePlayerPath('/players/jesus-made-815908', map), null, 'no redirect loop')
  assert.equal(stalePlayerPath('/players/someone-else-123', map), null)
  assert.equal(stalePlayerPath('/players/no-id', map), null)
  assert.equal(stalePlayerPath('/players/jesus-made-815908/stats', map), null)
  assert.equal(stalePlayerPath('/clubs/wilson-warbirds-815908', map), null)
  assert.equal(stalePlayerPath('/players/jesus-made-815908', null), null)
  assert.equal(paths.playerPathMap(), '/player-paths.json')
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
  // Every ACCENTS entry, plus the 2026 clubs with no entry.
  for (const id of new Set([...Object.keys(ACCENTS).map(Number), 556, 5015, 572, 249, 406, 2101, 607])) {
    const a = accentFor(id)
    assert.ok(contrastRatio(a.primary, a.ink) >= ACCENT_MIN, `club ${id}: ${a.primary} on ${a.ink}`)
  }
  assert.deepEqual(accentProblems(), [])
  // Each entry passes on its own color, not on the fallback.
  for (const [id, entry] of Object.entries(ACCENTS)) {
    assert.equal(accentFor(Number(id)).primary, entry.primary)
    assert.equal(measureAccent(entry.primary).ok, true, `club ${id}`)
  }
  // The lowest entry, measured 2026-09-25: #0f69b1 with white ink.
  assert.equal(measureAccent(ACCENTS[5015].primary).ratio.toFixed(2), '5.71')
})

// #777777 with white is 4.48:1, and with navy 3.34:1: no ink passes.
const FAILING = { 1: { primary: '#777777', secondary: '#c8102e', confidence: 'low', source: 'test' } }

test('a failing accent is reported to lint and renders as Brewers navy', () => {
  assert.deepEqual(accentProblems(FAILING), [
    'Affiliate 1 accent #777777 with #ffffff ink is 4.48:1 (needs 4.5:1). It renders as Brewers navy.',
  ])
  const a = accentFor(1, FAILING)
  assert.equal(a.primary, BREWERS.navy)
  assert.equal(a.secondary, BREWERS.gold)
  assert.equal(a.ink, '#ffffff')
  assert.equal(a.researched, true)
  assert.equal(a.fallback, true)
})

test('a missing or malformed accent color is reported and falls back', () => {
  const bad = { 2: { primary: 'navy' }, 3: { secondary: '#ffffff' }, 4: { primary: '#fff' }, 5: null }
  assert.deepEqual(accentProblems(bad), [
    'Affiliate 2 accent has no valid primary color (navy). It renders as Brewers navy.',
    'Affiliate 3 accent has no valid primary color (missing). It renders as Brewers navy.',
    'Affiliate 4 accent has no valid primary color (#fff). It renders as Brewers navy.',
    'Affiliate 5 accent has no valid primary color (missing). It renders as Brewers navy.',
  ])
  for (const id of [2, 3, 4, 5]) assert.equal(accentFor(id, bad).primary, BREWERS.navy)
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
  assert.equal(paths.feed(), '/rss.xml')
})

test('the "is listed" rule keeps the four post types and drops player notes and drafts', () => {
  for (const t of POST_TYPES) {
    assert.equal(isListedPost({ collection: t.key, data: { draft: false } }), true, t.key)
    assert.equal(isListedPost({ collection: t.key, data: { draft: true } }), false, `${t.key} draft`)
  }
  assert.equal(isListedPost({ collection: 'playerNotes', data: { draft: false } }), false)
  assert.equal(isListedPost({ collection: 'recaps', data: {} }), true)
})

test('feed items sort newest first, build absolute links, and skip a missing summary', () => {
  const posts = [
    { id: 'a', type: { key: 'features' }, data: { title: 'A', date: '2026-05-01', summary: 'About A' } },
    { id: 'b', type: { key: 'recaps' }, data: { title: 'B', date: '2026-06-01', summary: '' } },
    { id: 'c', type: { key: 'guides' }, data: { title: 'C', date: '2026-04-01', summary: '   ' } },
  ]
  const items = feedItems(posts, 'https://brewprospects.vercel.app')
  assert.deepEqual(items.map((i) => i.title), ['B', 'A', 'C'])
  assert.equal(items[0].link, 'https://brewprospects.vercel.app/posts/recaps/b')
  assert.equal(items[1].link, 'https://brewprospects.vercel.app/posts/features/a')
  assert.equal('description' in items[0], false, 'empty summary leaves out description')
  assert.equal('description' in items[2], false, 'blank summary leaves out description')
  assert.equal(items[1].description, 'About A')
  assert.deepEqual(items[0].pubDate, new Date('2026-06-01'))
})

test('feedOrigin uses SITE_URL when set, else the placeholder domain', () => {
  assert.equal(feedOrigin('https://brewprospects.com'), 'https://brewprospects.com')
  assert.equal(feedOrigin(undefined), 'https://brewprospects.vercel.app')
  assert.equal(feedOrigin(''), 'https://brewprospects.vercel.app')
})

test('the canonical URL drops a trailing slash and keeps the home page', () => {
  assert.equal(canonicalUrl('https://example.com', '/seasons/2019/'), 'https://example.com/seasons/2019')
  assert.equal(canonicalUrl(new URL('https://example.com'), '/'), 'https://example.com/')
})

test('no site origin means no canonical URL, not a guessed one', () => {
  assert.equal(canonicalUrl(undefined, '/players'), null)
})
