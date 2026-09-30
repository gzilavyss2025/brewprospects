// The packed MiLB stat rows (docs/adr/0015), shared by org.json and
// careers.json: the same columns, the same club table, counts only. The
// rates come back in src/lib/model/player/rates.js, at the build boundary
// (src/lib/build/), so every model and page still reads plain rows with rates.
import { packer, unpacker } from './pack.js'

export const CLUB_COLUMNS = ['sportId', 'teamId', 'team', 'league']

// Every field slimHitting and slimPitching send once they keep counts only.
// The same as mlb.json's columns without `teams`, which only an MLB total row
// has. hbp, sf, outs and er were on every one of 30,993 MiLB rows refetched
// 2026-09-29 (org, careers and every archive season).
export const MILB_COLUMNS = {
  hitting: ['season', 'club', 'age', 'g', 'pa', 'ab', 'h', 'd', 't', 'hr', 'r', 'rbi', 'bb', 'so', 'sb', 'cs', 'hbp', 'sf'],
  pitching: ['season', 'club', 'age', 'g', 'gs', 'w', 'l', 'sv', 'outs', 'h', 'bb', 'so', 'hr', 'er'],
}
export const GROUPS = ['hitting', 'pitching']

// Packs { [id]: { ...anything, hitting, pitching } }. Fields other than the
// two groups (an org player's bio) stay as they are. Seasons are numbers on
// disk and strings in memory, as in mlb.json.
export function packPlayers(players) {
  const { row, clubs } = packer({ columns: MILB_COLUMNS, clubColumns: CLUB_COLUMNS })
  const packed = {}
  for (const [id, p] of Object.entries(players)) {
    packed[id] = { ...p }
    for (const g of GROUPS) packed[id][g] = (p[g] ?? []).map((r) => row(g, { ...r, season: Number(r.season) }))
  }
  return { columns: MILB_COLUMNS, clubColumns: CLUB_COLUMNS, clubs, players: packed }
}

// The reverse. It reads the column names from the file, not from this module,
// so a file packed with other columns still reads (an old careers.json).
export function unpackPlayers(file) {
  const unpack = unpacker(file)
  const players = {}
  for (const [id, p] of Object.entries(file.players ?? {})) {
    players[id] = { ...p }
    for (const g of GROUPS) {
      players[id][g] = (p[g] ?? []).map((v) => {
        const r = unpack(g, v)
        return { ...r, season: String(r.season) }
      })
    }
  }
  return players
}

// org.json: rosters, affiliates and standings hold no stat rows and stay as
// they are. Only `players` is packed.
export function packOrg({ players, ...rest }) {
  return { ...rest, ...packPlayers(players) }
}

export function unpackOrg({ columns: _c, clubColumns: _cc, clubs: _cl, players, ...rest }) {
  return { ...rest, players: unpackPlayers({ columns: _c, clubColumns: _cc, clubs: _cl, players }) }
}
