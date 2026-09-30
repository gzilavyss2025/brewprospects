// The plain-language season summary on the player page (#50): one or two short
// sentences, plain text, also used as the page's meta description. Pure logic.
//
// "Hitting .287/.360/.451 for Biloxi Shuckers. 88th percentile in OPS among 14
// Brewers Double-A hitters."
//
// What it reuses, and never redoes:
// - The line is one of peerLines (percentiles.js): Brewers rows only (by team
//   id), two Brewers clubs at one level summed. Its rates come from rates.js.
//   Which one: his primary group first (a pitcher's stray at bat is not his
//   season), then a line over the minimum before one under it (eight PA at
//   Triple-A do not hide a season at Double-A), then the highest level, hitting
//   before pitching. Code review of #73 found both traps in the real snapshot.
// - The ranking clause is the peer entry (peerPercentilesFor) for that group
//   and level: the percentile of OPS for a hitter, of ERA for a pitcher, with
//   the pool size. Owner decision, 2026-09-30: a percentile and a pool size,
//   never a place in a list ("Third among ...").
// - The minimum is belowMinimum (percentiles.js), which reads MIN_PA and
//   MIN_IP from sample.js.
//
// A missing part is dropped, never filled (ADR-0003).
import { peerLines, belowMinimum } from './percentiles.js'
import { levelFor } from '../levels.js'
import { primaryGroup } from '../org.js'
import { ordinal } from '../../format.js'

// The stat each group is ranked on, and the ones its line shows.
const RANKED = { hitting: 'ops', pitching: 'era' }
const HEADING = { hitting: 'Hitting', pitching: 'Pitching' }
const PLAYERS = { hitting: 'hitters', pitching: 'pitchers' }
const LINE = {
  hitting: [{ key: 'avg', label: 'AVG' }, { key: 'obp', label: 'OBP' }, { key: 'slg', label: 'SLG' }],
  pitching: [{ key: 'era', label: 'ERA' }, { key: 'whip', label: 'WHIP' }],
}

// rates.js gives null for a missing rate, and the API's own blanks (".---",
// "-.--") hold no digit. A real ".000" or "0.00" has digits, so it stays.
const present = (v) => (typeof v === 'string' || Number.isFinite(v)) && /\d/.test(String(v))

// 0 is a real percentile, but ordinal() has no word for it.
const nth = (n) => (n === 0 ? '0th' : ordinal(n))

// ".287/.360/.451" when all three hitting rates are on record. Otherwise the
// ones that are, each with its label: a slash line with a hole would read as a
// different line.
function lineText(group, line) {
  const parts = LINE[group].filter(({ key }) => present(line[key]))
  if (parts.length === 0) return null
  if (group === 'hitting' && parts.length === LINE.hitting.length) return parts.map(({ key }) => line[key]).join('/')
  return parts.map(({ key, label }) => `${line[key]} ${label}`).join(', ')
}

// "for <club>" when he played for one Brewers club at that level and its name
// is on record; otherwise "at <level>". A club outside the system is never
// named: only Brewers rows reach here.
function whereText(player, group, sportId, season, brewersIds, clubNames) {
  const ids = new Set(
    (player[group] ?? [])
      .filter((r) => String(r.season) === String(season) && r.sportId === sportId && brewersIds.has(r.teamId))
      .map((r) => r.teamId),
  )
  const name = ids.size === 1 ? clubNames?.get([...ids][0]) : null
  return name ? `for ${name}` : `at ${levelFor(sportId).name}`
}

// { text } for a player's current season, or null when he has no Brewers line
// this season (or no line worth a sentence).
// - `player`: { hitting, pitching } rows with rates and teamId.
// - `season`: the current season; falsy gives null.
// - `brewersIds`: the Brewers club team ids (brewersClubIds in archive.js).
// - `peers`: his peerPercentiles entries.
// - `clubNames`: Map of team id to club name.
export function seasonSummary({ player, season, brewersIds, peers = [], clubNames }) {
  if (!season) return null
  const smalls = belowMinimum(player, season, brewersIds)
  const isSmall = (l) => smalls.some((b) => b.group === l.group && b.sportId === l.sportId)
  const primary = primaryGroup(player)
  // The sort is stable, so the level order from peerLines breaks every tie.
  const first = peerLines(player, season, brewersIds).sort(
    (a, b) => (a.group !== primary) - (b.group !== primary) || isSmall(a) - isSmall(b),
  )[0]
  if (!first) return null
  const { group, sportId, line } = first

  const sentences = []
  const stats = lineText(group, line)
  if (stats) sentences.push(`${HEADING[group]} ${stats} ${whereText(player, group, sportId, season, brewersIds, clubNames)}.`)

  if (isSmall(first)) {
    if (stats) sentences.push('Small sample.')
  } else {
    const entry = peers.find((e) => e.group === group && e.sportId === sportId && String(e.season) === String(season))
    const ranked = entry?.stats.find((s) => s.key === RANKED[group])
    if (ranked && Number.isInteger(ranked.pct)) {
      sentences.push(`${nth(ranked.pct)} percentile in ${ranked.label} among ${entry.size} Brewers ${entry.level.name} ${PLAYERS[group]}.`)
    }
  }
  return sentences.length ? { text: sentences.join(' ') } : null
}

// The page's meta description: the player's name, then the summary, so a search
// snippet says whose page it is. null when there is no summary; the page keeps
// its own description then.
export function summaryDescription(name, summary) {
  return summary ? `${name}: ${summary.text}` : null
}
