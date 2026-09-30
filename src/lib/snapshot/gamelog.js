// The packed game log, src/data/gamelog.json (docs/adr/0015, #35). One row per
// game a player played, counts only, for the current season. Packed like the
// other snapshots (src/lib/snapshot/pack.js): each club once in `clubs`, a row
// an array whose columns the file names. Two differences from org.json:
// - A row is a game, so it names its game (`gamePk`, the key: a doubleheader
//   has two rows with one date) and its date as a number, yyyymmdd.
// - The opponent is a team id in the row. The `opponents` table holds each
//   id's name once, so a name is not repeated on 15,000 rows.
// Rows are in the order the API sent them (oldest first). The model orders
// them (src/lib/model/player/gamelog/gamelog.js).
import { packer, unpacker } from './pack.js'

export const GAMELOG_CLUB_COLUMNS = ['sportId', 'teamId', 'team']

const GAME = ['gamePk', 'date', 'gameNumber', 'club', 'oppId', 'isHome', 'isWin']
export const GAMELOG_COLUMNS = {
  hitting: [...GAME, 'pa', 'ab', 'h', 'd', 't', 'hr', 'r', 'rbi', 'bb', 'so', 'hbp', 'sf'],
  pitching: [...GAME, 'gs', 'outs', 'h', 'r', 'er', 'bb', 'so', 'bf'],
}
const GROUPS = ['hitting', 'pitching']
const FLAGS = ['isHome', 'isWin']

// true and false are 1 and 0 on disk; null stays null.
const toFlag = (v) => (typeof v === 'boolean' ? Number(v) : v)
const fromFlag = (v) => (v === 1 ? true : v === 0 ? false : null)

// Packs { [id]: { hitting, pitching } }. A player with no rows in either group
// is left out. A field with no column throws (packer), so the generator keeps
// the last good file.
export function packGamelog({ generatedAt, season, players, opponents }) {
  const { row, clubs } = packer({ columns: GAMELOG_COLUMNS, clubColumns: GAMELOG_CLUB_COLUMNS })
  const packed = {}
  for (const [id, p] of Object.entries(players)) {
    if (!GROUPS.some((g) => p[g]?.length)) continue
    packed[id] = {}
    for (const g of GROUPS) {
      packed[id][g] = (p[g] ?? []).map((r) => row(g, { ...r, ...Object.fromEntries(FLAGS.map((k) => [k, toFlag(r[k])])) }))
    }
  }
  return { generatedAt, season: Number(season), columns: GAMELOG_COLUMNS, clubColumns: GAMELOG_CLUB_COLUMNS, clubs, opponents, players: packed }
}

// Plain rows, with the club's fields on the row, `isHome` and `isWin` as
// booleans, and `opp`, the opponent's name (null when no row named it).
export function unpackGamelog(file) {
  const unpack = unpacker(file)
  const opponents = file.opponents ?? {}
  const players = {}
  for (const [id, p] of Object.entries(file.players ?? {})) {
    players[id] = {}
    for (const g of GROUPS) {
      players[id][g] = (p[g] ?? []).map((v) => {
        const r = unpack(g, v)
        for (const k of FLAGS) r[k] = fromFlag(r[k])
        return { ...r, opp: opponents[r.oppId] ?? null }
      })
    }
  }
  return { season: file.season, players }
}

// Every hitting and pitching row in a packed file, for the generator's guard.
export function countRows(file) {
  return Object.values(file?.players ?? {}).reduce((n, p) => n + GROUPS.reduce((m, g) => m + (p[g]?.length ?? 0), 0), 0)
}
