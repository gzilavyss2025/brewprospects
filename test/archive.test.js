import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  brewersRanked, brewersClubIds, otherClubs, archiveLines, archiveIndex, pastPlayer, clubsByLevel, rankHistory,
} from '../src/lib/archive.js'
import { slimArchiveEntry } from '../scripts/data/slim.mjs'
import roster from './fixtures/roster-season-2025-biloxi.json' with { type: 'json' }

// Pinned on a captured live roster: Biloxi 2025. Raúl Alcantara pitched for
// Chesapeake AND Biloxi, so the API returns a no-team total plus one split per
// club. Only Biloxi's split may land on Biloxi's roster.
test('slimArchiveEntry keeps only the line for this club', () => {
  const raw = roster.roster.find((e) => e.person.fullName === 'Raúl Alcantara')
  const e = slimArchiveEntry(raw, 5015, 12)
  assert.equal(e.pitching.teamId, 5015)
  assert.equal(e.pitching.team, 'Biloxi Shuckers')
  assert.equal(e.pitching.g, 10, 'Biloxi games only, not the 20-game total')
  assert.equal(e.hitting, null)
})

test('slimArchiveEntry gives no line when he never played for this club', () => {
  const raw = roster.roster.find((e) => e.person.fullName === 'Raúl Alcantara')
  const e = slimArchiveEntry(raw, 999, 12)
  assert.equal(e.pitching, null)
  assert.equal(e.id, raw.person.id)
})

const season = (s, rosters, milwaukee = [], extra = {}) => ({ season: String(s), rosters, milwaukee, affiliates: [], ...extra })

test('brewersRanked keeps ranked players on a farm roster or in Milwaukee, rank order', () => {
  const data = season(2016, { 1: [{ id: 10 }, { id: 11 }] }, [12])
  const rows = [
    { rank: 30, mlbId: 11, source: 'mlb-pipeline' },
    { rank: 5, mlbId: 12, source: 'mlb-pipeline' },
    { rank: 1, mlbId: 99, source: 'mlb-pipeline' },
  ]
  const out = brewersRanked(rows, data)
  assert.deepEqual(out.map((p) => p.playerId), [12, 11])
  assert.deepEqual(out[0], { rank: 5, source: 'mlb-pipeline', playerId: 12, onFarm: false, inMilwaukee: true, invited: false })
})

// 2020 had no farm rosters; its non-roster invitees count, but they did not
// spend the year in Milwaukee, and the page must not say so.
test('a 2020 invitee counts, but is not marked as in Milwaukee', () => {
  const data = season(2020, {}, [1], { invitees: [2] })
  const out = brewersRanked([{ rank: 7, mlbId: 2, source: 'mlb-pipeline' }], data)
  assert.equal(out.length, 1)
  assert.equal(out[0].inMilwaukee, false)
  assert.equal(out[0].invited, true)
})

test('brewersClubIds is the affiliates plus Milwaukee', () => {
  assert.deepEqual([...brewersClubIds({ affiliates: [{ id: 5015 }] })].sort((a, b) => a - b), [158, 5015])
})

test('otherClubs names non-Brewers clubs in that season only, ignoring totals', () => {
  const splits = [
    { season: '2016', team: { id: 540, name: 'Frisco RoughRiders' } },
    { season: '2016', team: { id: 551, name: 'Colorado Springs Sky Sox' } },
    { season: '2016' },
    { season: '2015', team: { id: 540, name: 'Frisco RoughRiders' } },
    { season: '2016', team: { id: 540, name: 'Frisco RoughRiders' } },
  ]
  assert.deepEqual(otherClubs(splits, 2016, new Set([158, 551])), ['Frisco RoughRiders'])
  assert.deepEqual(otherClubs(undefined, 2016, new Set()), [])
})

const archive = [
  season(2006, {
    503: [{ id: 1, name: 'R. Braun', pos: '3B', hitting: { season: '2006', sportId: 13, teamId: 503 }, pitching: null }],
    559: [{ id: 1, name: 'R. Braun', pos: '3B', hitting: { season: '2006', sportId: 12, teamId: 559 }, pitching: null }],
  }),
  season(2007, { 556: [{ id: 1, name: 'Ryan Braun', pos: 'LF', hitting: { season: '2007', sportId: 11, teamId: 556 }, pitching: null }] }),
]

test('archiveLines collects every Brewers-club line for one player', () => {
  const { hitting, pitching, seasons } = archiveLines(archive, 1)
  assert.equal(hitting.length, 3)
  assert.equal(pitching.length, 0)
  assert.deepEqual(seasons.at(-1), { season: '2007', teamId: 556, pos: 'LF' })
  assert.deepEqual(archiveLines(archive, 404).hitting, [])
})

test('archiveIndex keeps the latest name and position', () => {
  assert.deepEqual(archiveIndex([...archive].reverse()).get(1), { id: 1, name: 'Ryan Braun', pos: 'LF' })
})

test('pastPlayer prefers the bio, falls back to the roster, and marks archiveOnly', () => {
  const p = pastPlayer(1, archive, { 1: { name: 'Ryan Braun', pos: 'LF', bats: 'R' } })
  assert.equal(p.archiveOnly, true)
  assert.equal(p.bats, 'R')
  assert.equal(p.hitting.length, 3)
  assert.equal(pastPlayer(1, archive, {}).name, 'Ryan Braun')
  assert.equal(pastPlayer(404, archive, {}), null)
})

test('clubsByLevel orders AAA down to rookie', () => {
  const s = { affiliates: [{ id: 1, name: 'B', sportId: 16 }, { id: 2, name: 'A', sportId: 11 }, { id: 3, name: 'C', sportId: 13 }] }
  assert.deepEqual(clubsByLevel(s).map((c) => c.sportId), [11, 13, 16])
})

test('rankHistory lists a player across seasons, oldest first', () => {
  const seasons = [
    { season: 2007, source: 'baseball-america', prospects: [{ playerId: 1, rank: 26 }] },
    { season: 2006, source: 'baseball-america', prospects: [{ playerId: 1, rank: 49 }, { playerId: 2, rank: 11 }] },
  ]
  assert.deepEqual(rankHistory(seasons, 1), [
    { season: 2006, rank: 49, source: 'baseball-america' },
    { season: 2007, rank: 26, source: 'baseball-america' },
  ])
})
