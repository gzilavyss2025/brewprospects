// The A to Z player index (/players/a-z): every player with a page, grouped by
// the first letter of his last name. Pure: the caller passes the page list
// (`playerPages()` in src/lib/build/archive.js) and the archive.
import { archiveLines } from '../archive.js'
import { paths } from '../../slug.js'
import { DASH } from '../../format.js'

export const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

// Letters that do not split into a base letter and a mark.
const FOLD = { ø: 'o', ł: 'l', đ: 'd', ð: 'd', æ: 'a', œ: 'o' }

// Lowercase, accents removed. Used for the group letter and the sort.
function fold(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[øłđðæœ]/g, (c) => FOLD[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// The text a row is searched by: folded, with one space between words.
export const searchKey = (name) => fold(name).split(/\s+/).filter(Boolean).join(' ')

// The words of a query: folded, split on spaces. An empty query has none.
export const queryWords = (query) => searchKey(query).split(' ').filter(Boolean)

// True when every word is in the search key, in any order. No words matches
// every row. The page script imports this function.
export const matchesWords = (key, words) => words.every((w) => key.includes(w))

// "Jesús" -> "J". A name that does not start with a letter A to Z -> "#".
export function letterFor(text) {
  const first = fold(text).trim().charAt(0).toUpperCase()
  return /^[A-Z]$/.test(first) ? first : '#'
}

export const anchorFor = (letter) => (letter === '#' ? 'letter-other' : `letter-${letter.toLowerCase()}`)

// First to last season as text. A missing season is DASH (ADR-0003).
export function yearsText(first, last) {
  if (first === null || last === null) return DASH
  return first === last ? String(first) : `${first}–${last}`
}

// A player is current when he holds an assignment that is not "gone".
const isCurrent = (p) => Boolean(p.assignment) && p.assignment.group !== 'gone'

// A player with no lastName sorts under "#" by his full name. We never split
// the name ourselves (ADR-0003).
function sortParts(p) {
  const last = String(p.lastName ?? '').trim()
  if (!last) return { letter: '#', key: fold(p.name), then: '' }
  return { letter: letterFor(last), key: fold(last), then: fold(p.firstName) }
}

function entryFor(p, archive, currentSeason) {
  const current = isCurrent(p)
  // Brewers-affiliate seasons only. MLB rows stay apart (ADR-0014), and a
  // career line with other clubs does not count.
  const seasons = archiveLines(archive, p.id).seasons.map((s) => Number(s.season))
  if (current && currentSeason !== null) seasons.push(currentSeason)
  const valid = seasons.filter(Number.isFinite)
  const firstSeason = valid.length ? Math.min(...valid) : null
  const lastSeason = valid.length ? Math.max(...valid) : null
  return {
    id: p.id,
    name: p.name,
    search: searchKey(p.name),
    path: paths.player(p.name, p.id),
    pos: p.pos ? String(p.pos) : DASH,
    current,
    firstSeason,
    lastSeason,
    years: yearsText(firstSeason, lastSeason),
  }
}

// -> { total, groups: [{ letter, id, entries }] }. Only letters with players
// get a group; "#" comes last. `currentSeason` is org.season, a string.
export function buildPlayerIndex(pages, archive, { currentSeason = null } = {}) {
  const season = currentSeason === null ? null : Number(currentSeason)
  const rows = pages.map((p) => ({ ...sortParts(p), entry: entryFor(p, archive, Number.isFinite(season) ? season : null) }))
  rows.sort((a, b) => a.key.localeCompare(b.key) || a.then.localeCompare(b.then) || a.entry.id - b.entry.id)
  const groups = LETTERS.map((letter) => ({
    letter,
    id: anchorFor(letter),
    entries: rows.filter((r) => r.letter === letter).map((r) => r.entry),
  })).filter((g) => g.entries.length > 0)
  return { total: rows.length, groups }
}
