// Pure logic for the live prospect card. The island fetches one person with
// this season's MiLB splits (leagueListId=milb_all) and these functions pick
// the line to show. Checked live: person 815908, 2026.
import { MILB_TOTAL_SPORT_ID, levelFor, levelRank } from './levels.js'
import { DASH } from '../format.js'

export function cardUrl(playerId) {
  return `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam,stats(group=[hitting,pitching],type=[season],leagueListId=milb_all)`
}

// A player who played at two levels this season has one split per level plus
// a MiLB total row. The card shows the total when there is one, and names the
// levels it covers; otherwise the single split.
export function pickSeasonLine(stats, group) {
  const splits = (stats ?? []).find((s) => s.group?.displayName === group)?.splits ?? []
  if (!splits.length) return null
  // Lowest level first, so a promotion reads left to right: "A/A+/AA".
  const levels = splits
    .filter((s) => levelFor(s.sport?.id))
    .sort((a, b) => levelRank(b.sport.id) - levelRank(a.sport.id))
  const total = splits.find((s) => s.sport?.id === MILB_TOTAL_SPORT_ID)
  const chosen = total && levels.length > 1 ? total : levels[levels.length - 1] ?? splits[0]
  return {
    season: chosen.season,
    stat: chosen.stat ?? {},
    levels: levels.map((s) => levelFor(s.sport.id).label),
  }
}

const v = (x) => (x === null || x === undefined || x === '' ? DASH : x)

// ".271/.344/.430, 14 HR, 37 SB" or "3.31 ERA, 85.0 IP, 89 SO".
export function lineText(line, group) {
  if (!line) return 'No games this season.'
  const s = line.stat
  if (group === 'pitching') return `${v(s.era)} ERA, ${v(s.inningsPitched)} IP, ${v(s.strikeOuts)} SO`
  return `${v(s.avg)}/${v(s.obp)}/${v(s.slg)}, ${v(s.homeRuns)} HR, ${v(s.stolenBases)} SB`
}
