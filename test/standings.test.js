import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slimStanding, standingsByTeam, standingsProblem } from '../src/lib/model/standings.js'
import { leagueIdsByTeam, fetchStandings } from '../scripts/data/lib/standings.mjs'
import pioneer from './fixtures/standings-2019-pioneer.json' with { type: 'json' }
import arizona from './fixtures/standings-2006-arizona.json' with { type: 'json' }

test('slimStanding keeps the record, the division rank and the runs; strings become numbers', () => {
  const vibes = pioneer.records[1].teamRecords[0]
  assert.equal(vibes.team.id, 551)
  assert.deepEqual(slimStanding(vibes), { wins: 32, losses: 43, pct: '.427', divRank: 3, rs: 360, ra: 405 })
})

test('a field the API did not send stays missing, not zero', () => {
  const azl = arizona.records[0].teamRecords[0]
  assert.equal(azl.divisionRank, undefined)
  assert.deepEqual(slimStanding(azl), { wins: 21, losses: 35, pct: '.375', divRank: null, rs: 321, ra: 422 })
})

test('a placeholder or blank rank and pct is missing', () => {
  const s = slimStanding({ wins: 1, losses: 2, winningPercentage: '.---', divisionRank: '', runsScored: 'x' })
  assert.deepEqual(s, { wins: 1, losses: 2, pct: null, divRank: null, rs: null, ra: null })
})

test('a team record with no wins and no losses is no record', () => {
  assert.equal(slimStanding({ divisionRank: '1', runsScored: 5 }), null)
  assert.equal(slimStanding(undefined), null)
})

test('standingsByTeam reads every division and keys on team id', () => {
  const by = standingsByTeam(pioneer, [551, 518])
  assert.deepEqual(Object.keys(by).sort(), ['518', '551'])
  assert.equal(by[551].wins, 32)
  assert.equal(by[518].divRank, 1)
})

test('a team that is not in the response gets null', () => {
  const by = standingsByTeam(pioneer, [551, 999999])
  assert.equal(by[999999], null)
  assert.equal(by[551].losses, 43)
})

test('an empty or missing response gives null for every team', () => {
  assert.deepEqual(standingsByTeam({ records: [] }, [551]), { 551: null })
  assert.deepEqual(standingsByTeam({}, [551]), { 551: null })
  assert.deepEqual(standingsByTeam(null, [551]), { 551: null })
})

test('standingsByTeam returns only the team ids asked for', () => {
  assert.deepEqual(Object.keys(standingsByTeam(pioneer, [551])), ['551'])
})

test('standingsProblem is quiet when most clubs have a record', () => {
  assert.equal(standingsProblem({ 1: { wins: 1 }, 2: { wins: 2 }, 3: null }), null)
})

test('standingsProblem names a season where more than half the clubs have none', () => {
  assert.match(standingsProblem({ 1: { wins: 1 }, 2: null, 3: null }), /2 of 3 clubs/)
  assert.match(standingsProblem({ 1: null }), /1 of 1 clubs/)
})

test('standingsProblem has nothing to say about a season with no clubs', () => {
  assert.equal(standingsProblem({}), null)
})

test('leagueIdsByTeam maps a team id to its league id and skips a team with none', () => {
  const m = leagueIdsByTeam([{ id: 551, league: { id: 128 } }, { id: 7, league: {} }, { id: 8 }])
  assert.deepEqual([...m], [[551, 128]])
})

test('fetchStandings asks once per league and puts null on a club with no league', async () => {
  const asked = []
  const getJson = async (path) => {
    asked.push(path)
    return pioneer
  }
  const leagueOf = new Map([[551, 128], [518, 128], [406, 121]])
  const out = await fetchStandings(getJson, 2019, leagueOf, [551, 518, 555])
  assert.deepEqual(asked, ['/standings?leagueId=128&season=2019&standingsTypes=regularSeason'])
  assert.equal(out[551].wins, 32)
  assert.equal(out[518].wins, 40)
  assert.equal(out[555], null)
})
