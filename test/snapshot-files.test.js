// DRAFT for #62: the packed org.json, careers.json and season files
// (src/lib/snapshot/milb.js and season.js, docs/adr/0015).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packOrg, unpackOrg, packPlayers, unpackPlayers, MILB_COLUMNS } from '../src/lib/snapshot/milb.js'
import { packSeason, unpackSeason } from '../src/lib/snapshot/season.js'
import { withRates } from '../src/lib/model/player/rates.js'
import { packedProblems } from '../scripts/checks/snapshots.mjs'
import { stringifyByLine } from '../scripts/data/lib/by-line.mjs'
import { slimPerson, slimAffiliate, slimArchiveEntry } from '../scripts/data/lib/slim.mjs'
import people from './fixtures/people-yearbyyear.json' with { type: 'json' }
import biloxi from './fixtures/roster-season-2025-biloxi.json' with { type: 'json' }

// Today's slim functions still send rates and not hbp, sf, outs or er. Until
// #62 step 1 changes them, these add the counts from the raw split and drop
// the rates, which is what the changed slim functions will send.
const RATES = new Set(['avg', 'obp', 'slg', 'ops', 'ip', 'era', 'whip', 'k9', 'bb9'])
const EXTRA = { hitting: { hbp: 'hitByPitch', sf: 'sacFlies' }, pitching: { outs: 'outs', er: 'earnedRuns' } }
const countsOnly = (group, row, stat) => ({
  ...Object.fromEntries(Object.entries(row).filter(([k]) => !RATES.has(k))),
  ...Object.fromEntries(Object.entries(EXTRA[group]).map(([k, api]) => [k, stat[api] ?? null])),
})
const splitsOf = (p, group) => p.stats.find((s) => s.group.displayName === group && s.type.displayName === 'yearByYear')?.splits ?? []
const player = (p) => {
  const slim = slimPerson(p)
  for (const g of ['hitting', 'pitching']) slim[g] = slim[g].map((r, i) => countsOnly(g, r, splitsOf(p, g)[i].stat))
  return slim
}
const players = Object.fromEntries(people.people.map((p) => [p.id, player(p)]))
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
    const back = unpackPlayers(through(packPlayers({ [p.id]: player(p) })))[p.id]
    for (const g of ['hitting', 'pitching']) {
      slimPerson(p)[g].forEach((sent, i) => {
        const r = withRates(g, back[g][i])
        for (const k of Object.keys(sent).filter((k) => RATES.has(k))) assert.equal(r[k], sent[k], `${p.fullName} ${g} ${sent.season} ${k}`)
      })
    }
  }
})

// Biloxi 2025, as gen-archive shapes it, with counts only.
const affiliate = slimAffiliate({ id: 5015, name: 'Biloxi Shuckers', teamName: 'Shuckers', abbreviation: 'BLX', sport: { id: 12 }, league: { name: 'Southern League' } })
const entry = (e) => {
  const slim = slimArchiveEntry(e, 5015, 12)
  const statOf = (g) => (e.person.stats ?? []).find((s) => s.group.displayName === g)?.splits.find((s) => s.team?.id === 5015)?.stat
  for (const g of ['hitting', 'pitching']) if (slim[g]) slim[g] = countsOnly(g, slim[g], statOf(g))
  return slim
}
const season = {
  season: '2025', generatedAt: 'x', affiliates: [affiliate],
  rosters: { 5015: biloxi.roster.map(entry) }, milwaukee: [1], standings: {},
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

test('a no-season file is written as it is', () => {
  const none = { season: '2020', noSeason: 'Cancelled', affiliates: [], rosters: {}, milwaukee: [1], invitees: [2], standings: {} }
  assert.deepEqual(packSeason(none), none)
  assert.deepEqual(unpackSeason(none), none)
})
