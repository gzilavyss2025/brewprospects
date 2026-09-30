import { test } from 'node:test'
import assert from 'node:assert/strict'
import { archiveOnlyIds, careerTargets, mergeCareers, packCareers, unpackCareers } from '../src/lib/model/careers.js'
import { pastPlayer } from '../src/lib/model/archive.js'
import { levelPath, statRows } from '../src/lib/model/org.js'
import { slimCareer } from '../scripts/data/lib/slim.mjs'
import { withRates } from '../src/lib/model/player/rates.js'
import fixture from './fixtures/people-milb-careers.json' with { type: 'json' }

// Captured live 2026-09-29 (manifest.json): Ben Sheets and Eric Gagne with the
// gen-careers request. Sheets has no-team totals (sportId 21) and clubs
// outside the Brewers system; Gagne has neither totals nor Brewers seasons
// before 2008.
const person = (name) => fixture.people.find((p) => p.fullName === name)
const sheets = slimCareer(person('Ben Sheets'))
const gagne = slimCareer(person('Eric Gagne'))

const row = (season, sportId, teamId, team, extra = {}) => ({ season, sportId, teamId, team, league: '', age: null, ...extra })
const rosterEntry = (id, hitting) => ({ id, name: 'Test Player', pos: 'CF', hitting, pitching: null })
const archive = [
  { season: '2006', affiliates: [], milwaukee: [], rosters: { 556: [rosterEntry(1, row('2006', 11, 556, 'Nashville Sounds'))] } },
  { season: '2007', affiliates: [], milwaukee: [], rosters: { 556: [rosterEntry(1, row('2007', 11, 556, 'Nashville Sounds')), rosterEntry(2, null)] } },
]
// The careers file as pastPlayer reads it: one entry for player 1.
const careersOf = (entry) => ({ throughSeason: '2026', players: { 1: entry } })
const key = (r) => `${r.season}:${r.sportId}:${r.teamId}`

test('slimCareer keeps every club and the no-team totals, as gen-org keeps them', () => {
  const totals = sheets.pitching.filter((r) => r.teamId === null)
  assert.equal(totals.length, 3)
  assert.ok(totals.every((r) => r.sportId === 21 && r.team === ''))
  assert.ok(sheets.pitching.some((r) => r.team === 'Stockton Ports' && r.season === '1999'))
  assert.equal(gagne.pitching.filter((r) => r.teamId === null).length, 0)
})

test('a past player with a careers entry shows his lines with other clubs', () => {
  const p = pastPlayer(1, archive, {}, careersOf(gagne))
  assert.ok(statRows(p, 'pitching').some((r) => r.team === 'Frisco RoughRiders'))
  assert.ok(levelPath(p).some((s) => s.team === 'Savannah Sand Gnats'))
})

test('a careers entry replaces his roster lines, so no row shows twice', () => {
  const career = { hitting: [row('2006', 11, 556, 'Nashville Sounds'), row('2005', 12, 559, 'Huntsville Stars')], pitching: [] }
  const p = pastPlayer(1, archive, {}, careersOf(career))
  assert.deepEqual(p.hitting, career.hitting)
  assert.equal(p.careerThrough, '2026')
  // 2007 is on the roster lines and not in the entry: the entry wins whole.
  assert.equal(p.hitting.some((r) => r.season === '2007'), false)
  const keys = p.hitting.map(key)
  assert.equal(new Set(keys).size, keys.length)
})

// Checked live 2026-09-29: the yearByYear feed names team 406 "ACL Brewers" in
// 2016 to 2018, when the archive roster feed says "AZL Brewers". ADR-0008: a
// club shows the name it had that season, and the archive has that name.
test('a Brewers line in a careers entry keeps the club name the archive has for that season', () => {
  const az = row('2016', 16, 406, 'AZL Brewers', { league: 'Arizona League' })
  const arch = [{ season: '2016', affiliates: [], milwaukee: [], rosters: { 406: [rosterEntry(1, az)] } }]
  const career = {
    hitting: [row('2016', 16, 406, 'ACL Brewers', { league: 'Arizona Complex League' }), row('2017', 11, 400, 'Las Vegas 51s', { league: 'Pacific Coast League' })],
    pitching: [],
  }
  const p = pastPlayer(1, arch, {}, careersOf(career))
  assert.deepEqual(p.hitting.map((r) => [r.team, r.league]), [['AZL Brewers', 'Arizona League'], ['Las Vegas 51s', 'Pacific Coast League']])
})

test('a past player with no careers entry falls back to his roster lines', () => {
  const other = { throughSeason: '2026', players: { 99: gagne } }
  for (const careers of [undefined, null, other]) {
    const p = pastPlayer(1, archive, {}, careers)
    assert.deepEqual(p.hitting.map(key), ['2006:11:556', '2007:11:556'])
    assert.equal(p.archiveOnly, true)
    assert.equal(p.careerThrough, null)
  }
})

test('a blank stat stays blank from the API to the page (ADR-0003)', () => {
  const raw = {
    id: 9,
    stats: [{
      group: { displayName: 'hitting' },
      type: { displayName: 'yearByYear' },
      splits: [{ season: '2010', sport: { id: 12 }, team: { id: 5, name: 'X' }, stat: { gamesPlayed: 3, avg: '.---', obp: '-.--' } }],
    }],
  }
  const c = slimCareer(raw)
  assert.equal('avg' in c.hitting[0], false, 'a rate is never stored (ADR-0015)')
  assert.equal(c.hitting[0].hr, null, 'a stat the API did not send is null, not 0')
  const shown = withRates('hitting', pastPlayer(1, archive, {}, careersOf(c)).hitting[0])
  assert.equal(shown.avg, null)
  assert.equal(shown.obp, null)
})

test('slimCareer gives empty groups for a player with no stats block', () => {
  assert.deepEqual(slimCareer({ id: 3 }), { hitting: [], pitching: [] })
})

test('archiveOnlyIds is every archive id that is not in this season\'s org', () => {
  assert.deepEqual(archiveOnlyIds(archive, [2]), [1])
  assert.deepEqual(archiveOnlyIds(archive, []), [1, 2])
})

test('careerTargets fetches an id with no entry, and only that id', () => {
  const careers = { throughSeason: '2026', players: { 1: { hitting: [], pitching: [] } } }
  assert.deepEqual(careerTargets([1, 2, 3], careers, '2026'), [2, 3])
  assert.deepEqual(careerTargets([1], careers, '2026'), [])
})

test('careerTargets refetches every id when the season has moved on', () => {
  const careers = { throughSeason: '2026', players: { 1: { hitting: [], pitching: [] } } }
  assert.deepEqual(careerTargets([1, 2], careers, '2027'), [1, 2])
})

test('careerTargets with refetch fetches every id, even ones with an entry', () => {
  const careers = { throughSeason: '2026', players: { 1: { hitting: [], pitching: [] } } }
  assert.deepEqual(careerTargets([1, 2], careers, '2026', { refetch: true }), [1, 2])
  assert.deepEqual(careerTargets([1, 2], careers, '2026', { refetch: false }), [2])
})

test('careerTargets fetches every id when there is no file', () => {
  assert.deepEqual(careerTargets([1, 2], null, '2026'), [1, 2])
})

test('mergeCareers adds new entries to the old ones in the same season', () => {
  const prev = { throughSeason: '2026', players: { 1: sheets } }
  const out = mergeCareers(prev, { 2: gagne }, { ids: [1, 2], season: '2026' })
  assert.equal(out.throughSeason, '2026')
  assert.deepEqual(Object.keys(out.players), ['1', '2'])
})

test('mergeCareers drops old-season entries and ids that left the archive-only set', () => {
  const prev = { throughSeason: '2026', players: { 1: sheets, 5: gagne } }
  assert.deepEqual(Object.keys(mergeCareers(prev, {}, { ids: [1], season: '2026' }).players), ['1'])
  const next = mergeCareers(prev, { 2: gagne }, { ids: [1, 2], season: '2027' })
  assert.equal(next.throughSeason, '2027')
  assert.deepEqual(Object.keys(next.players), ['2'], 'a new season keeps nothing from the old file')
})

// The file stores each club once and each row as an array (docs/adr/0006).
// Packing must lose nothing: every row comes back as gen-org would store it.
const both = { throughSeason: '2026', players: { 282656: sheets, 150378: gagne } }

test('packCareers then unpackCareers gives back every row exactly', () => {
  const back = unpackCareers(JSON.parse(JSON.stringify(packCareers(both))))
  assert.equal(back.throughSeason, '2026')
  assert.deepEqual(back.players, both.players)
})

test('a packed file names its columns, and each club appears once', () => {
  const file = packCareers(both)
  assert.deepEqual(file.columns.hitting.slice(0, 3), ['season', 'club', 'age'])
  const rows = [...sheets.pitching, ...sheets.hitting, ...gagne.pitching, ...gagne.hitting]
  const clubKeys = new Set(rows.map((r) => [r.sportId, r.teamId, r.team, r.league].join('|')))
  assert.equal(file.clubs.length, clubKeys.size)
  assert.ok(file.clubs.length < rows.length)
})

test('the same club id in two seasons under two names stays two clubs (ADR-0008)', () => {
  const r = (season, team) => ({ ...row(season, 12, 249, team), g: 1 })
  const players = { 1: { hitting: [r('2010', 'Carolina Mudcats'), r('2026', 'Wilson Warbirds')], pitching: [] } }
  const back = unpackCareers(packCareers({ throughSeason: '2026', players }))
  assert.deepEqual(back.players[1].hitting.map((x) => x.team), ['Carolina Mudcats', 'Wilson Warbirds'])
})

test('packCareers refuses a row with a field it has no column for', () => {
  const players = { 1: { hitting: [{ ...row('2010', 12, 5, 'X'), homers: 3 }], pitching: [] } }
  assert.throws(() => packCareers({ throughSeason: '2026', players }), /homers/)
})

test('unpackCareers refuses a row that points at a club that is not there', () => {
  const file = packCareers(both)
  file.players[282656].pitching[0][1] = file.clubs.length
  assert.throws(() => unpackCareers(file), /club/)
})
