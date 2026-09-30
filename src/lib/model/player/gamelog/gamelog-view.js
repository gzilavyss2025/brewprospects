// The game log as the page shows it (#35): rows in, display cells out. Pure.
// The rows come newest first from gamelogFor and stay in that order. Every
// missing value is a dash (docs/adr/0003); a real 0 is "0".
import { levelFor } from '../../levels.js'
import { DASH, orDash } from '../../../format.js'
import { ip } from '../rates.js'

// Columns after the five lead columns, as [row key, label].
export const GAMELOG_COLS = {
  hitting: [
    ['pa', 'PA'], ['ab', 'AB'], ['r', 'R'], ['h', 'H'], ['d', '2B'], ['t', '3B'],
    ['hr', 'HR'], ['rbi', 'RBI'], ['bb', 'BB'], ['so', 'SO'],
  ],
  pitching: [
    ['gs', 'GS'], ['ip', 'IP'], ['h', 'H'], ['r', 'R'], ['er', 'ER'], ['bb', 'BB'], ['so', 'SO'],
  ],
}
export const GAMELOG_LEAD = ['Date', 'Opp', 'W/L', 'Lvl', 'Club']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 20260604 -> "Jun 4". A date that is not yyyymmdd is a dash.
export function dateText(date) {
  if (!Number.isInteger(date)) return DASH
  const month = MONTHS[Math.floor(date / 100) % 100 - 1]
  return month ? `${month} ${date % 100}` : DASH
}

// "@ Name" away, the name at home. When isHome is not known we cannot say where
// he played, so the name shows bare. No name is a dash.
export function oppText(row) {
  if (!row.opp) return DASH
  return row.isHome === false ? `@ ${row.opp}` : row.opp
}

// The team's result, as a letter so it never rests on color alone.
export function resultText(row) {
  if (row.isWin === true) return 'W'
  if (row.isWin === false) return 'L'
  return DASH
}

// The IP cell reads `outs`; 0 outs is "0.0", a missing count is a dash.
const cell = (group, key, row) => orDash(group === 'pitching' && key === 'ip' ? ip(row) : row[key])

// One display row per game: a key (gamePk, since a doubleheader shares a date)
// and the cells in column order. Order is kept.
export function gameLogRows(group, rows) {
  return rows.map((row) => ({
    key: row.gamePk,
    cells: [
      dateText(row.date),
      oppText(row),
      resultText(row),
      levelFor(row.sportId)?.label ?? DASH,
      orDash(row.team),
      ...GAMELOG_COLS[group].map(([key]) => cell(group, key, row)),
    ],
  }))
}

export const gameLogHead = (group) => [...GAMELOG_LEAD, ...GAMELOG_COLS[group].map(([, label]) => label)]

// "Jun 4, 2026", from the newest row's date. null when no row has one.
export function throughText(season, rows) {
  const dates = rows.map((r) => r.date).filter(Number.isInteger)
  return dates.length ? `${dateText(Math.max(...dates))}, ${season}` : null
}
