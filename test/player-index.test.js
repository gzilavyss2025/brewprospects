import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlayerIndex, letterFor, anchorFor, yearsText, searchKey, matchesQuery, LETTERS } from '../src/lib/model/player/a-z-index.js'
import { paths } from '../src/lib/slug.js'

const p = (id, firstName, lastName, extra = {}) => ({
  id, name: [firstName, lastName].filter(Boolean).join(' '), firstName, lastName, pos: 'SS', ...extra,
})
const archive = [
  { season: '2019', rosters: { 1: [{ id: 1 }, { id: 2 }] } },
  { season: '2021', rosters: { 1: [{ id: 1 }], 2: [{ id: 3 }] } },
  { season: '2024', rosters: { 1: [{ id: 1 }] } },
]
const build = (pages, opts = {}) => buildPlayerIndex(pages, archive, { currentSeason: '2025', ...opts })
const names = (idx, letter) => idx.groups.find((g) => g.letter === letter).entries.map((e) => e.name)

test('letterFor folds accents and sends non-letters to "#"', () => {
  assert.equal(letterFor('Jesús'), 'J')
  assert.equal(letterFor('Ángel'), 'A')
  assert.equal(letterFor('Østby'), 'O')
  assert.equal(letterFor('éclair'), 'E')
  assert.equal(letterFor("'Ofa"), '#')
  assert.equal(letterFor('3rd'), '#')
  assert.equal(letterFor(''), '#')
  assert.equal(letterFor(null), '#')
})

test('anchorFor gives each letter a fixed id', () => {
  assert.equal(anchorFor('A'), 'letter-a')
  assert.equal(anchorFor('#'), 'letter-other')
  assert.equal(LETTERS.length, 27)
})

test('groups by last-name letter and sorts by last name, then first name', () => {
  const idx = build([p(10, 'Zed', 'Adams'), p(11, 'Al', 'Adams'), p(12, 'Bo', 'Aaron'), p(13, 'Cy', 'Baker')])
  assert.deepEqual(names(idx, 'A'), ['Bo Aaron', 'Al Adams', 'Zed Adams'])
  assert.deepEqual(names(idx, 'B'), ['Cy Baker'])
  assert.deepEqual(idx.groups.map((g) => g.letter), ['A', 'B'])
})

test('folds accents for the sort too', () => {
  const idx = build([p(10, 'Ana', 'Zuniga'), p(11, 'Luis', 'Álvarez'), p(12, 'Tom', 'Alba')])
  assert.deepEqual(names(idx, 'A'), ['Tom Alba', 'Luis Álvarez'])
  assert.deepEqual(names(idx, 'Z'), ['Ana Zuniga'])
})

test('a name that starts with no letter goes under "#"', () => {
  const idx = build([p(10, 'Pat', "'Ofa"), p(11, 'Al', 'Adams')])
  assert.deepEqual(names(idx, '#'), ["Pat 'Ofa"])
  assert.equal(idx.groups.at(-1).letter, '#', '# comes last')
})

test('a player with no lastName sorts under "#" by his full name, unsplit', () => {
  const idx = build([
    { id: 20, name: 'Zeta Solo', pos: 'P' },
    { id: 21, name: 'Alpha Solo', pos: 'P', lastName: '' },
    p(22, 'Al', 'Adams'),
  ])
  assert.deepEqual(names(idx, '#'), ['Alpha Solo', 'Zeta Solo'])
  assert.deepEqual(names(idx, 'A'), ['Al Adams'])
})

test('years run first to last Brewers-affiliate season', () => {
  const [e] = build([p(1, 'Ann', 'Lee')]).groups[0].entries
  assert.equal(e.firstSeason, 2019)
  assert.equal(e.lastSeason, 2024)
  assert.equal(e.years, '2019–2024')
})

test('one season shows one year; the current season extends a current player', () => {
  const one = build([p(2, 'Bob', 'Lee')]).groups[0].entries[0]
  assert.equal(one.years, '2019')
  const cur = build([p(1, 'Ann', 'Lee', { assignment: { group: 'active' } })]).groups[0].entries[0]
  assert.equal(cur.years, '2019–2025')
  const rookie = build([p(99, 'New', 'Guy', { assignment: { group: 'active' } })]).groups[0].entries[0]
  assert.equal(rookie.years, '2025', 'no archive seasons yet: the current season alone')
})

test('a missing year or position shows a dash, never a guess', () => {
  const [e] = build([p(77, 'No', 'Seasons', { pos: undefined })]).groups[0].entries
  assert.equal(e.years, '—')
  assert.equal(e.firstSeason, null)
  assert.equal(e.pos, '—')
  assert.equal(yearsText(null, null), '—')
  assert.equal(build([p(78, 'Blank', 'Pos', { pos: '' })]).groups[0].entries[0].pos, '—')
})

test('the current mark needs an assignment that is not "gone"', () => {
  const idx = build([
    p(1, 'Ann', 'Active', { assignment: { group: 'active' } }),
    p(2, 'Bob', 'Injured', { assignment: { group: 'injured' } }),
    p(3, 'Cal', 'Gone', { assignment: { group: 'gone' } }),
    p(4, 'Dee', 'Past'),
    p(5, 'Eve', 'Unassigned', { assignment: null }),
  ])
  const byId = Object.fromEntries(idx.groups.flatMap((g) => g.entries).map((e) => [e.id, e]))
  assert.deepEqual([1, 2, 3, 4, 5].map((id) => byId[id].current), [true, true, false, false, false])
})

test('a gone player keeps only his archive seasons', () => {
  const [e] = build([p(3, 'Cal', 'Gone', { assignment: { group: 'gone' } })]).groups[0].entries
  assert.equal(e.years, '2021')
})

test('every page appears exactly once, with a link path', () => {
  const pages = [p(1, 'Ann', 'Lee'), p(2, 'Bob', 'Lee'), p(3, 'Cal', 'Moe'), { id: 4, name: 'Solo' }, p(5, 'Ed', '9ers')]
  const idx = build(pages)
  const ids = idx.groups.flatMap((g) => g.entries).map((e) => e.id).sort()
  assert.deepEqual(ids, [1, 2, 3, 4, 5])
  assert.equal(idx.total, 5)
  const e = idx.groups.flatMap((g) => g.entries).find((x) => x.id === 3)
  assert.equal(e.path, paths.player('Cal Moe', 3))
})

test('the index page path is /players/a-z and no player slug can match it', () => {
  assert.equal(paths.playerIndex(), '/players/a-z')
  // Every player slug ends in a numeric id, and "a-z" does not.
  assert.doesNotMatch('a-z', /\d+$/)
  assert.match(paths.player('A Z', 5), /-5$/)
})

test('searchKey lowercases, folds accents and squeezes spaces', () => {
  assert.equal(searchKey('Jesús  Made'), 'jesus made')
  assert.equal(searchKey('  Ørjan Łukasz '), 'orjan lukasz')
  assert.equal(searchKey(null), '')
})

test('every index entry carries its search key', () => {
  const idx = build([p(1, 'Jesús', 'Made')])
  assert.equal(idx.groups[0].entries[0].search, 'jesus made')
})

test('matchesQuery: case, accents, word order and extra spaces', () => {
  const key = searchKey('Jesús Made')
  assert.equal(matchesQuery(key, 'JESUS'), true)
  assert.equal(matchesQuery(key, 'jesús'), true)
  assert.equal(matchesQuery(key, 'jesus made'), true)
  assert.equal(matchesQuery(key, 'made jes'), true)
  assert.equal(matchesQuery(key, '  made    jes  '), true)
  assert.equal(matchesQuery(key, 'jesus ortiz'), false)
})

test('matchesQuery: an empty query matches everything, a stray word matches nothing', () => {
  const key = searchKey('Jesús Made')
  assert.equal(matchesQuery(key, ''), true)
  assert.equal(matchesQuery(key, '   '), true)
  assert.equal(matchesQuery(key, null), true)
  assert.equal(matchesQuery(key, 'zzz'), false)
  assert.equal(matchesQuery('', 'a'), false)
})
