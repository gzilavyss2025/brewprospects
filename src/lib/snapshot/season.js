// A packed archive season file (docs/adr/0006, docs/adr/0015).
//
// In memory, a season is { season, affiliates, rosters, milwaukee, standings }
// and each roster entry carries its own `hitting` and `pitching` line for that
// club, with the club's season, sportId, teamId, team and league on the line.
// On disk those five are not stored: every line names its own affiliate (all
// 7,174 lines on disk, checked 2026-09-29), so they come back from
// `affiliates`. Three tables hold the rest, one row per line:
//   roster:   who was on which club
//   hitting:  that club's line for a hitter, counts only
//   pitching: the same for a pitcher
// A no-season file (2020) has no tables and is written as it is.
//
// DRAFT for #62. Nothing imports this yet.
import { MILB_COLUMNS } from './milb.js'

const ENTRY = ['id', 'name', 'jersey', 'pos', 'status', 'statusText']
const LINE_CLUB = ['season', 'sportId', 'teamId', 'team', 'league']
// A line's columns: the club and player it belongs to, then its counts.
const lineColumns = (group) => ['teamId', 'id', ...MILB_COLUMNS[group].filter((k) => k !== 'season' && k !== 'club')]

export const SEASON_COLUMNS = {
  roster: ['teamId', ...ENTRY],
  hitting: lineColumns('hitting'),
  pitching: lineColumns('pitching'),
}
const GROUPS = ['hitting', 'pitching']

// What a line must say about its club, from the affiliate it sits under.
const clubFields = (season, a) => ({ season, sportId: a.sportId, teamId: a.id, team: a.name, league: a.league })

// Throws on a line that names another club, or on a field with no column, so
// packing can never drop or change a value in silence (docs/adr/0003).
export function packSeason(data) {
  if (data.noSeason) return data
  const { rosters, ...rest } = data
  const byId = new Map(data.affiliates.map((a) => [a.id, a]))
  const tables = { roster: [], hitting: [], pitching: [] }
  const toRow = (group, values) => {
    const unknown = Object.keys(values).filter((k) => !SEASON_COLUMNS[group].includes(k))
    if (unknown.length) throw new Error(`No ${group} column for "${unknown[0]}".`)
    return SEASON_COLUMNS[group].map((k) => values[k] ?? null)
  }
  for (const [teamId, entries] of Object.entries(rosters)) {
    const a = byId.get(Number(teamId))
    if (!a) throw new Error(`${data.season}: roster ${teamId} has no affiliate.`)
    const own = clubFields(data.season, a)
    for (const e of entries) {
      const { hitting, pitching, ...entry } = e
      tables.roster.push(toRow('roster', { teamId: a.id, ...entry }))
      for (const [group, line] of [['hitting', hitting], ['pitching', pitching]]) {
        if (!line) continue
        const off = LINE_CLUB.filter((k) => line[k] !== own[k])
        if (off.length) throw new Error(`${data.season}: ${e.name}'s ${group} line for ${a.name} has another ${off[0]}.`)
        const counts = Object.fromEntries(Object.entries(line).filter(([k]) => !LINE_CLUB.includes(k)))
        tables[group].push(toRow(group, { teamId: a.id, id: e.id, ...counts }))
      }
    }
  }
  return { ...rest, columns: SEASON_COLUMNS, ...tables }
}

// The reverse, reading column names from the file. Roster order is kept.
export function unpackSeason(file) {
  if (file.noSeason) return file
  const { columns, roster, hitting, pitching, ...rest } = file
  const byId = new Map(file.affiliates.map((a) => [a.id, a]))
  const obj = (group, values) => Object.fromEntries(columns[group].map((k, i) => [k, values[i]]))
  const lines = Object.fromEntries(GROUPS.map((g) => [g, new Map()]))
  for (const [group, table] of [['hitting', hitting], ['pitching', pitching]]) {
    for (const values of table ?? []) {
      const { teamId, id, ...counts } = obj(group, values)
      lines[group].set(`${teamId}:${id}`, { ...clubFields(file.season, byId.get(teamId)), ...counts })
    }
  }
  const rosters = Object.fromEntries(file.affiliates.map((a) => [a.id, []]))
  for (const values of roster ?? []) {
    const { teamId, ...entry } = obj('roster', values)
    const key = `${teamId}:${entry.id}`
    rosters[teamId].push({ ...entry, hitting: lines.hitting.get(key) ?? null, pitching: lines.pitching.get(key) ?? null })
  }
  return { ...rest, rosters }
}
