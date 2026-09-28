// Build-time access to the archive snapshots (docs/adr/0006, 0007). Pages
// import from here, not from the JSON files.
import people from '../../data/archive/people.json' with { type: 'json' }
import prospectHistory from '../../data/prospect-history.json' with { type: 'json' }
import { org } from './data.js'
import { archiveIndex, pastPlayer, rankHistory, archiveLines } from '../model/archive.js'
import { orgPlayerIds } from '../model/org.js'

const modules = import.meta.glob('../../data/archive/[0-9][0-9][0-9][0-9].json', { eager: true, import: 'default' })

// Oldest first.
export const archive = Object.values(modules).sort((a, b) => a.season.localeCompare(b.season))

export const seasonByYear = new Map(archive.map((s) => [s.season, s]))

export { prospectHistory }

const current = new Set(orgPlayerIds(org.rosters))

// Past players only: in the archive, not in this season's org. Each gets a
// page built from his Brewers-system seasons.
export function pastPlayers() {
  return [...archiveIndex(archive).keys()]
    .filter((id) => !current.has(id))
    .map((id) => pastPlayer(id, archive, people))
    .filter(Boolean)
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
