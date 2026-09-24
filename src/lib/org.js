// Pure org-model logic over the generated src/data/org.json. No fetching here:
// scripts/data/gen-org.mjs fetches, these functions shape, and both the pages
// and the unit tests call them.
import { levelFor, levelRank, MILB_TOTAL_SPORT_ID } from './levels.js'

// Roster status codes (MLB Stats API `status.code`), grouped by what the site
// says about a player. Seen live on 2026 Brewers rosters: A, ASG, D7, D60, DEV,
// FA, NYR, RA, RL, TAX. An unknown code falls to 'other' and never crashes.
export function statusGroup(code) {
  if (code === 'A') return 'active'
  if (/^D\d+$/.test(code ?? '')) return 'injured'
  if (code === 'RA') return 'rehab'
  if (code === 'ASG') return 'moved'
  if (code === 'RL' || code === 'FA') return 'gone'
  return 'other'
}

// Where a player is NOW, across every affiliate's full-season roster. A player
// promoted mid-season sits on two rosters: 'moved' on the old one and 'active'
// on the new one, so the strongest status wins.
const STATUS_PRIORITY = ['active', 'injured', 'other', 'rehab', 'moved', 'gone']

export function currentAssignments(rosters) {
  const best = new Map()
  for (const [teamId, entries] of Object.entries(rosters)) {
    for (const e of entries) {
      const group = statusGroup(e.status)
      const prev = best.get(e.id)
      if (!prev || STATUS_PRIORITY.indexOf(group) < STATUS_PRIORITY.indexOf(prev.group)) {
        best.set(e.id, { teamId: Number(teamId), status: e.status, group })
      }
    }
  }
  return best
}

// Every player who belongs on the site: anyone on an affiliate's full-season
// roster this year. A player whose ONLY entries are rehab assignments is a
// big-leaguer passing through, not a farmhand, so he is left out.
export function orgPlayerIds(rosters) {
  const assignments = currentAssignments(rosters)
  return [...assignments.entries()]
    .filter(([, a]) => a.group !== 'rehab')
    .map(([id]) => id)
}

// Position buckets for the depth chart. Pitchers split into starters and
// relievers by this season's starts at that club (see isStarter).
export const BUCKETS = [
  { key: 'sp', label: 'Starting pitchers' },
  { key: 'rp', label: 'Relief pitchers' },
  { key: 'c', label: 'Catchers' },
  { key: 'if', label: 'Infielders' },
  { key: 'of', label: 'Outfielders' },
  { key: 'ut', label: 'DH & utility' },
]

const POS_BUCKET = {
  C: 'c', '1B': 'if', '2B': 'if', '3B': 'if', SS: 'if', IF: 'if',
  LF: 'of', CF: 'of', RF: 'of', OF: 'of', DH: 'ut', UT: 'ut', TWP: 'ut',
}

// A pitcher counts as a starter when half or more of his games at this club
// this season were starts. With no split for the club, he is a reliever: the
// roster has no role field, and 'reliever' is the more common MiLB role.
export function isStarter(player, teamId, season) {
  const row = (player?.pitching ?? []).find((s) => s.season === season && s.teamId === teamId)
  if (!row || !row.g) return false
  return (row.gs ?? 0) * 2 >= row.g
}

export function bucketFor(entry, player, teamId, season) {
  if (entry.pos === 'P') return isStarter(player, teamId, season) ? 'sp' : 'rp'
  return POS_BUCKET[entry.pos] ?? 'ut'
}

// One affiliate's depth chart: active players by bucket, plus the injured
// list. Every bucket is always present, so an empty one can say so.
export function depthChart(teamId, rosters, players, season) {
  const entries = rosters[teamId] ?? []
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b.key, []]))
  const injured = []
  for (const e of entries) {
    const group = statusGroup(e.status)
    if (group === 'injured') injured.push(e)
    if (group !== 'active') continue
    buckets[bucketFor(e, players[e.id], teamId, season)].push(e)
  }
  const byName = (a, b) => a.name.localeCompare(b.name)
  for (const list of Object.values(buckets)) list.sort(byName)
  injured.sort(byName)
  return { buckets, injured }
}

// The levels a player has played, oldest first: one stop per season, level
// and club. The total row (sportId 21) is not a level and is dropped.
export function levelPath(player) {
  const seen = new Map()
  for (const s of [...(player?.hitting ?? []), ...(player?.pitching ?? [])]) {
    if (s.sportId === MILB_TOTAL_SPORT_ID || !levelFor(s.sportId)) continue
    const key = `${s.season}:${s.sportId}:${s.teamId}`
    if (!seen.has(key)) {
      seen.set(key, { season: s.season, sportId: s.sportId, label: levelFor(s.sportId).label, teamId: s.teamId, team: s.team })
    }
  }
  // Within a season, lower levels come first: a promotion reads left to right.
  return [...seen.values()].sort(
    (a, b) => a.season.localeCompare(b.season) || levelRank(b.sportId) - levelRank(a.sportId),
  )
}

// Stat rows for one group, in the same order as levelPath.
export function statRows(player, group) {
  return (player?.[group] ?? [])
    .filter((s) => s.sportId !== MILB_TOTAL_SPORT_ID && levelFor(s.sportId))
    .sort((a, b) => a.season.localeCompare(b.season) || levelRank(b.sportId) - levelRank(a.sportId))
}

// A two-way or position-change player has both groups. The primary group is
// the one his position says; the other shows below it only when it has rows.
export function primaryGroup(player) {
  return player?.pos === 'P' || player?.pos === 'TWP' ? 'pitching' : 'hitting'
}
