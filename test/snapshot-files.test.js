// The packed org.json, careers.json and season files
// (src/lib/snapshot/milb.js and season.js, docs/adr/0015).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packOrg, unpackOrg, packPlayers, unpackPlayers, MILB_COLUMNS } from '../src/lib/snapshot/milb.js'
import { packSeason, unpackSeason } from '../src/lib/snapshot/season.js'
import { withRates } from '../src/lib/model/player/rates.js'
import { packedProblems } from '../scripts/checks/snapshots.mjs'
import { stringifyByLine } from '../scripts/data/lib/by-line.mjs'
import { slimPerson, slimAffiliate, slimArchiveEntry } from '../scripts/data/lib/slim.mjs'
import { brewersRanked } from '../src/lib/model/archive.js'
import { readSeason } from '../scripts/data/lib/season-file.mjs'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import people from './fixtures/people-yearbyyear.json' with { type: 'json' }
import biloxi from './fixtures/roster-season-2025-biloxi.json' with { type: 'json' }

// The rates the API sent, under the names withRates gives them. A placeholder
// like "-.--" is stored as null (docs/adr/0015).
const API_RATES = {
  hitting: { avg: 'avg', obp: 'obp', slg: 'slg', ops: 'ops' },
  pitching: { ip: 'inningsPitched', era: 'era', whip: 'whip', k9: 'strikeoutsPer9Inn', bb9: 'walksPer9Inn' },
}
const sentRate = (v) => (typeof v === 'string' && !/^[.-]+$/.test(v) ? v : null)
const splitsOf = (p, group) => p.stats.find((s) => s.group.displayName === group && s.type.displayName === 'yearByYear')?.splits ?? []
const players = Object.fromEntries(people.people.map((p) => [p.id, slimPerson(p)]))
const through = (value) => JSON.parse(stringifyByLine(value))

test('org.json packs and unpacks to the exact rows, bios and all', () => {
  const org = { generatedAt: 'x', season: '2026', affiliates: [], rosters: {}, players, standings: {} }
  const file = through(packOrg(org))
  assert.deepEqual(unpackOrg(file), org)
  assert.deepEqual(packedProblems('src/data/org.json', file), [])
  const [id, p] = Object.entries(players).find(([, p]) => p.hitting.length)
  assert.equal(file.players[id].name, p.name, 'the bio stays an object')
  assert.equal(typeof file.players[id].hitting[0][0], 'number', 'the season is a number on disk')
})

test('careers rows use the same columns, and an old file with rates still reads', () => {
  const file = through(packPlayers(players))
  assert.deepEqual(file.columns, MILB_COLUMNS)
  assert.deepEqual(unpackPlayers(file), players)
  const old = { columns: { hitting: ['season', 'club', 'avg'], pitching: [] }, clubColumns: ['teamId'], clubs: [[1]], players: { 7: { hitting: [[2020, 0, '.250']], pitching: [] } } }
  assert.deepEqual(unpackPlayers(old)[7].hitting, [{ season: '2020', teamId: 1, avg: '.250' }])
})

test('a rate in a row throws, so it cannot be written', () => {
  const [id, p] = Object.entries(players).find(([, p]) => p.hitting.length)
  assert.throws(() => packPlayers({ [id]: { ...p, hitting: [{ ...p.hitting[0], avg: '.250' }] } }), /"avg"/)
})

test('the rates from packed counts equal the rates the API sent', () => {
  for (const p of people.people) {
    const back = unpackPlayers(through(packPlayers({ [p.id]: slimPerson(p) })))[p.id]
    for (const g of ['hitting', 'pitching']) {
      splitsOf(p, g).forEach((split, i) => {
        const r = withRates(g, back[g][i])
        for (const [k, api] of Object.entries(API_RATES[g])) assert.equal(r[k], sentRate(split.stat[api]), `${p.fullName} ${g} ${split.season} ${k}`)
      })
    }
  }
})

// Biloxi 2025, as gen-archive shapes it.
const affiliate = slimAffiliate({ id: 5015, name: 'Biloxi Shuckers', teamName: 'Shuckers', abbreviation: 'BLX', sport: { id: 12 }, league: { name: 'Southern League' } })
const season = {
  season: '2025', generatedAt: 'x', affiliates: [affiliate],
  rosters: { 5015: biloxi.roster.map((e) => slimArchiveEntry(e, 5015, 12)) }, milwaukee: [1], standings: {},
}

test('a season file packs and unpacks to the exact roster, lines and all', () => {
  // The fixture's lines name the club as the API does; the archive's
  // affiliate must say the same for the club to come back from it.
  const line = season.rosters[5015].find((e) => e.hitting || e.pitching)
  const l = line.hitting ?? line.pitching
  assert.deepEqual([l.team, l.league], [affiliate.name, affiliate.league])
  const file = through(packSeason(season))
  assert.deepEqual(unpackSeason(file), season)
  assert.deepEqual(packedProblems('src/data/archive/2025.json', file), [])
  assert.equal(file.rosters, undefined, 'the roster lives in the tables')
})

test('a line that names another club throws, so a club is never rewritten', () => {
  const [e] = season.rosters[5015].filter((x) => x.hitting || x.pitching)
  const g = e.hitting ? 'hitting' : 'pitching'
  const bad = { ...season, rosters: { 5015: [{ ...e, [g]: { ...e[g], team: 'Another Club' } }] } }
  assert.throws(() => packSeason(bad), /another team/)
})

test('a no-season file packs to empty tables and reads back as it was', () => {
  const none = { season: '2020', noSeason: 'Cancelled', affiliates: [], rosters: {}, milwaukee: [1], invitees: [2], standings: {} }
  const file = through(packSeason(none))
  assert.deepEqual(unpackSeason(file), none)
  assert.deepEqual([file.roster, file.hitting, file.pitching], [[], [], []])
  assert.deepEqual(packedProblems('src/data/archive/2020.json', file), [])
})

// gen-prospect-history, gen-careers and gen-archive read season files from
// disk. A packed file has no `rosters` key, so a raw read matched 0 ranked
// prospects and failed nothing. readSeason unpacks.
test('a packed season file read from disk gives brewersRanked its prospects', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'season-'))
  try {
    const url = pathToFileURL(join(dir, '2025.json'))
    await writeFile(url, stringifyByLine(packSeason(season)))
    const ids = season.rosters[5015].slice(0, 3).map((e) => e.id)
    const rows = ids.map((mlbId, i) => ({ rank: i + 1, source: 'mlb-pipeline', mlbId }))
    const data = await readSeason(url)
    assert.deepEqual(brewersRanked(rows, data).map((p) => p.playerId), ids)
    assert.deepEqual(data, season)
  } finally {
    await rm(dir, { recursive: true })
  }
})
