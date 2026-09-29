// Build-time access to the archive snapshots (docs/adr/0006, 0007). Pages
// import from here, not from the JSON files.
import people from '../../data/archive/people.json' with { type: 'json' }
import careersFile from '../../data/archive/careers.json' with { type: 'json' }
import prospectHistory from '../../data/prospect-history.json' with { type: 'json' }
import { org, allPlayers } from './data.js'
import { archiveIndex, pastPlayer, rankHistory, archiveLines } from '../model/archive.js'
import { orgPlayerIds } from '../model/org.js'
import { unpackCareers } from '../model/careers.js'
import { entryWithRates, playersWithRates } from '../model/player/rates.js'
import { unpackSeason } from '../snapshot/season.js'
import { paths } from '../slug.js'

const modules = import.meta.glob('../../data/archive/[0-9][0-9][0-9][0-9].json', { eager: true, import: 'default' })

// The season files and careers.json are packed and store counts
// (docs/adr/0015). Each is unpacked here, once, and every row gets its rates,
// so models and pages read the rows they read before.
const withLineRates = (s) => ({
  ...s,
  rosters: Object.fromEntries(Object.entries(s.rosters).map(([id, entries]) => [id, entries.map(entryWithRates)])),
})

// Oldest first.
export const archive = Object.values(modules)
  .map((file) => withLineRates(unpackSeason(file)))
  .sort((a, b) => a.season.localeCompare(b.season))

export const seasonByYear = new Map(archive.map((s) => [s.season, s]))

export { prospectHistory }

// Whole MiLB careers of the past players, unpacked, with rates (docs/adr/0006).
const unpackedCareers = unpackCareers(careersFile)
const careers = { ...unpackedCareers, players: playersWithRates(unpackedCareers.players) }

const current = new Set(orgPlayerIds(org.rosters))

// Past players only: in the archive, not in this season's org. Each gets a
// page: his whole MiLB career when careers.json has him, else his
// Brewers-system seasons from the archive.
export function pastPlayers() {
  return [...archiveIndex(archive).keys()]
    .filter((id) => !current.has(id))
    .map((id) => pastPlayer(id, archive, people, careers))
    .filter(Boolean)
}

// Every player with a page, current then past. The player pages and the 404
// page's path map both read this list, so a page and its map entry cannot
// drift apart. Cached: pastPlayers() walks every archive season.
let playerPagesCache = null
export function playerPages() {
  playerPagesCache ??= [...allPlayers(), ...pastPlayers()]
  return playerPagesCache
}

// Player id to current path, for the 404 page (ADR-0009).
export function playerPathMap() {
  return Object.fromEntries(playerPages().map((p) => [p.id, paths.player(p.name, p.id)]))
}

// Every page-bearing player id, current and past, for links from season pages.
export const pagedIds = new Set([...current, ...archiveIndex(archive).keys()])

export function ranksFor(playerId) {
  return rankHistory(prospectHistory.seasons.filter((s) => s.prospects), playerId)
}

// A player's most recent archive stop: { season, teamId }, or null.
export function lastArchiveStop(playerId) {
  return archiveLines(archive, playerId).seasons.at(-1) ?? null
}
