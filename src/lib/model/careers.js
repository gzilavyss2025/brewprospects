// Pure rules for src/data/archive/careers.json (docs/adr/0006): a past
// player's whole minor-league career, with any club. scripts/data/gen-careers.mjs
// fetches; these functions decide who to fetch and what to keep.
//
// In memory, careers are { throughSeason, players: { [id]: { hitting, pitching } } },
// each row shaped as gen-org stores it. `throughSeason` is the season gen-org
// held when the rows were fetched. On disk the file is packed (packCareers):
// each club once, each row an array. See docs/adr/0006.
import { packer, unpacker } from '../snapshot/pack.js'

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
export function careerTargets(ids, careers, season) {
  if (!careers || String(careers.throughSeason) !== String(season)) return [...ids]
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

// The packed file. Every club (sport, team id, the name that season, league)
// is stored once in `clubs`, and a row holds its index. A row is an array
// whose columns are named in the file's `columns`, so the file explains
// itself. The columns below are every field slimHitting and slimPitching send.
const CLUB_COLUMNS = ['sportId', 'teamId', 'team', 'league']
const COLUMNS = {
  hitting: ['season', 'club', 'age', 'g', 'pa', 'ab', 'h', 'd', 't', 'hr', 'r', 'rbi', 'bb', 'so', 'sb', 'cs', 'avg', 'obp', 'slg', 'ops'],
  pitching: ['season', 'club', 'age', 'g', 'gs', 'w', 'l', 'sv', 'ip', 'h', 'bb', 'so', 'hr', 'era', 'whip', 'k9', 'bb9'],
}

// Lossless: see packer() in src/lib/snapshot/pack.js.
export function packCareers({ throughSeason, players }) {
  const { row, clubs } = packer({ columns: COLUMNS, clubColumns: CLUB_COLUMNS })
  const packed = {}
  for (const [id, c] of Object.entries(players)) {
    packed[id] = { hitting: c.hitting.map((r) => row('hitting', r)), pitching: c.pitching.map((r) => row('pitching', r)) }
  }
  return { throughSeason: String(throughSeason), columns: COLUMNS, clubColumns: CLUB_COLUMNS, clubs, players: packed }
}

// The reverse. It reads the column names from the file, not from this module.
export function unpackCareers(file) {
  const unpack = unpacker(file)
  const players = {}
  for (const [id, c] of Object.entries(file.players ?? {})) {
    players[id] = { hitting: c.hitting.map((v) => unpack('hitting', v)), pitching: c.pitching.map((v) => unpack('pitching', v)) }
  }
  return { throughSeason: String(file.throughSeason), players }
}
