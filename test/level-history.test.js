import { test } from 'node:test'
import assert from 'node:assert/strict'
import { levelSlug, levelBySlug, levelHistory } from '../src/lib/model/level-history.js'
import { LEVELS } from '../src/lib/model/levels.js'
import { paths } from '../src/lib/slug.js'
import { readdirSync, readFileSync } from 'node:fs'

// build/ reads import.meta.glob, which plain node lacks, so read the files here.
const read = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'))
const org = read('../src/data/org.json')
const archive = readdirSync(new URL('../src/data/archive/', import.meta.url))
  .filter((f) => /^\d{4}\.json$/.test(f))
  .map((f) => read('../src/data/archive/' + f))

const club = (id, sportId, name, league = 'League') => ({ id, name, sportId, league })
const rec = (wins, losses, divRank = 1) => ({ wins, losses, pct: '.500', divRank, rs: 1, ra: 1 })
const season = (year, affiliates, standings) => ({ season: String(year), affiliates, standings })

test('every level has a slug, and the slug finds the level back', () => {
  const slugs = LEVELS.map((l) => levelSlug(l.sportId))
  assert.deepEqual(slugs, ['aaa', 'double-a', 'high-a', 'single-a', 'short-season-a', 'rookie-advanced', 'rookie'])
  for (const l of LEVELS) assert.equal(levelBySlug(levelSlug(l.sportId)).sportId, l.sportId)
  assert.equal(levelBySlug('mlb'), null)
  assert.equal(levelSlug(1), null)
})

test('paths.level builds /levels/{slug}', () => {
  assert.equal(paths.level('rookie'), '/levels/rookie')
})

test('a club-season row carries that season\'s name and its record', () => {
  const s = [season(2019, [club(551, 5442, 'Rocky Mountain Vibes')], { 551: rec(32, 43, 3) })]
  const [row] = levelHistory(5442, s)
  assert.deepEqual(row, {
    season: '2019', kind: 'club', clubId: 551, name: 'Rocky Mountain Vibes', league: 'League',
    record: rec(32, 43, 3),
  })
})

test('one season with several clubs at one level gives one row per club', () => {
  const s = [season(2019, [club(607, 16, 'DSL Brewers'), club(5430, 16, 'AZL Brewers Blue'), club(551, 5442, 'Vibes')], {})]
  const rows = levelHistory(16, s)
  assert.deepEqual(rows.map((r) => r.clubId), [607, 5430])
})

test('a club with no record keeps a null record, not a guess', () => {
  const s = [season(2015, [club(1, 11, 'A')], { 1: null })]
  assert.equal(levelHistory(11, s)[0].record, null)
  const noBlock = [season(2015, [club(1, 11, 'A')], undefined)]
  assert.equal(levelHistory(11, noBlock)[0].record, null)
})

test('a season with no club at the level is a gap row', () => {
  const s = [season(2010, [club(1, 11, 'A')], {}), season(2011, [club(2, 12, 'B')], {})]
  const rows = levelHistory(11, s)
  assert.deepEqual(rows.map((r) => [r.season, r.kind]), [['2010', 'club'], ['2011', 'gap']])
})

test('a season with no minor-league season is its own row, not a gap', () => {
  const s = [{ season: '2020', noSeason: 'No season.', affiliates: [], rosters: {} }, season(2019, [club(1, 11, 'A')], {})]
  const rows = levelHistory(11, s)
  assert.deepEqual(rows.map((r) => [r.season, r.kind]), [['2019', 'club'], ['2020', 'noSeason']])
})

test('a level with no club in any season returns an empty list', () => {
  const s = [season(2010, [club(1, 11, 'A')], {}), { season: '2020', noSeason: 'x', affiliates: [] }]
  assert.deepEqual(levelHistory(15, s), [])
})

test('rows come out oldest first, whatever the input order', () => {
  const s = [season(2012, [club(1, 11, 'A')], {}), season(2010, [club(1, 11, 'A')], {})]
  assert.deepEqual(levelHistory(11, s).map((r) => r.season), ['2010', '2012'])
})

test('the real data: no Brewers Short-season A club, one Rookie Advanced club', () => {
  const seasons = [...archive, { season: org.season, affiliates: org.affiliates, standings: org.standings }]
  assert.deepEqual(levelHistory(15, seasons), [])
  const adv = levelHistory(5442, seasons).filter((r) => r.kind === 'club')
  assert.deepEqual(adv.map((r) => [r.season, r.clubId]), [['2019', 551]])
  assert.equal(adv[0].record.wins, 32)
  const rookie2019 = levelHistory(16, seasons).filter((r) => r.season === '2019')
  assert.deepEqual(rookie2019.map((r) => r.clubId).sort(), [406, 5430, 607])
})
