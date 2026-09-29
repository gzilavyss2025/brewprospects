// Pure rules for src/data/archive/careers.json (docs/adr/0006): a past
// player's whole minor-league career, with any club. scripts/data/gen-careers.mjs
// fetches; these functions decide who to fetch and what to keep.
//
// In memory, careers are { throughSeason, players: { [id]: { hitting, pitching } } },
// each row shaped as gen-org stores it. `throughSeason` is the season gen-org
// held when the rows were fetched. On disk the file is packed and holds counts
// only (packCareers, docs/adr/0015). src/lib/build/archive.js adds the rates.
import { packPlayers, unpackPlayers } from '../snapshot/milb.js'

// Ids in the archive that are not in this season's org: the players whose page
// is built from the archive (see pastPlayers in src/lib/build/archive.js).
export function archiveOnlyIds(archive, orgIds) {
  const current = new Set(orgIds)
  const ids = new Set()
  for (const season of archive) {
    for (const entries of Object.values(season.rosters ?? {})) {
      for (const e of entries) if (!current.has(e.id)) ids.add(e.id)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

// Which ids to fetch. With a file from the same season, only ids with no entry
// (a new past player). With no file, or a file from an older season, every id:
// a past player can still play on, so a new season refetches them all.
// `refetch` fetches every id too (gen-careers --refetch), as after a change to
// what a row keeps.
export function careerTargets(ids, careers, season, { refetch = false } = {}) {
  if (refetch || !careers || String(careers.throughSeason) !== String(season)) return [...ids]
  return ids.filter((id) => !careers.players?.[id])
}

// The file to write: the old entries that are still good, plus the new ones.
// An old file from another season keeps nothing, and an id that is no longer
// archive-only (he is back in the org) is dropped.
export function mergeCareers(prev, fetched, { ids, season }) {
  const sameSeason = prev && String(prev.throughSeason) === String(season)
  const players = {}
  for (const id of ids) {
    const entry = fetched[id] ?? (sameSeason ? prev.players?.[id] : undefined)
    if (entry) players[id] = entry
  }
  return { throughSeason: String(season), players }
}

// The packed file (docs/adr/0015): the MiLB columns org.json uses, counts
// only, each club once. See packPlayers in src/lib/snapshot/milb.js.
export function packCareers({ throughSeason, players }) {
  return { throughSeason: String(throughSeason), ...packPlayers(players) }
}

// The reverse. It reads the column names from the file, not from a module.
export function unpackCareers(file) {
  return { throughSeason: String(file.throughSeason), players: unpackPlayers(file) }
}
