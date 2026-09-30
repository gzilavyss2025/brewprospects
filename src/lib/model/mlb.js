// A player's major-league rows, kept apart from his MiLB rows on purpose. The
// level path, depth chart, and prospect card read only org.json and never see
// these, so a big-league line cannot change what they compute. Rows come from
// scripts/data/gen-mlb.mjs (src/data/mlb.json), shaped by slimMlbPerson.
//
// On disk the file is packed and holds counts only (docs/adr/0015): packMlb
// writes it, unpackMlb reads it back, and mlbRows adds the rates.
import { packer, unpacker } from '../snapshot/pack.js'
import { withRates } from './player/rates.js'

const CLUB_COLUMNS = ['sportId', 'teamId', 'team', 'league']
// Every field slimMlbPerson sends. `teams` is set only on a traded player's
// total row.
const COLUMNS = {
  hitting: ['season', 'club', 'age', 'teams', 'g', 'pa', 'ab', 'h', 'd', 't', 'hr', 'r', 'rbi', 'bb', 'so', 'sb', 'cs', 'hbp', 'sf'],
  pitching: ['season', 'club', 'age', 'teams', 'g', 'gs', 'w', 'l', 'sv', 'outs', 'h', 'bb', 'so', 'hr', 'er', 'bf'],
}
const GROUPS = ['hitting', 'pitching']

// Seasons are stored as numbers and read back as the strings slim sends.
export function packMlb({ generatedAt, players }) {
  const { row, clubs } = packer({ columns: COLUMNS, clubColumns: CLUB_COLUMNS })
  const packed = {}
  for (const [id, p] of Object.entries(players)) {
    packed[id] = Object.fromEntries(GROUPS.map((g) => [g, p[g].map((r) => row(g, { ...r, season: Number(r.season) }))]))
  }
  return { generatedAt, columns: COLUMNS, clubColumns: CLUB_COLUMNS, clubs, players: packed }
}

export function unpackMlb(file) {
  const unpack = unpacker(file)
  const players = {}
  for (const [id, p] of Object.entries(file.players ?? {})) {
    players[id] = Object.fromEntries(
      GROUPS.map((g) => [g, (p[g] ?? []).map((v) => {
        const r = unpack(g, v)
        return { ...r, season: String(r.season) }
      })]),
    )
  }
  return { generatedAt: file.generatedAt, players }
}

const isTotal = (r) => !r.team && Boolean(r.teams)

// Oldest season first. Within a season the club rows come first and a
// traded player's total row (no team, `teams` set) comes last, labeled
// "2 teams". Each row gets its rates from its own counts (rates.js); nothing
// here adds rows up.
export function mlbRows(entry, group) {
  return [...(entry?.[group] ?? [])]
    .sort((a, b) => a.season.localeCompare(b.season) || Number(isTotal(a)) - Number(isTotal(b)))
    .map((r) => withRates(group, isTotal(r) ? { ...r, team: `${r.teams} teams` } : r))
}
