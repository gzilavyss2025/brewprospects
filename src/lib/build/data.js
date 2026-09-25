// Build-time access to the generated snapshots. Pages import from here, not
// from the JSON files, so a file shape change touches one module.
import org from '../../data/org.json' with { type: 'json' }
import pipeline from '../../data/pipeline.json' with { type: 'json' }
import { levelRank } from '../levels.js'
import { currentAssignments, orgPlayerIds } from '../org.js'
import { paths } from '../slug.js'

export { org, pipeline }

export const affiliates = [...org.affiliates].sort(
  (a, b) => levelRank(a.sportId) - levelRank(b.sportId) || a.name.localeCompare(b.name),
)

export const affiliateById = new Map(org.affiliates.map((a) => [a.id, a]))

export const assignments = currentAssignments(org.rosters)

export const rankById = new Map(pipeline.prospects.map((p) => [p.playerId, p]))

export function playerUrl(player) {
  return paths.player(player.name, player.id)
}

// Every org player with his current assignment and rank, for list pages.
export function allPlayers() {
  return orgPlayerIds(org.rosters)
    .map((id) => org.players[id])
    .filter(Boolean)
    .map((p) => ({ ...p, assignment: assignments.get(p.id) ?? null, rank: rankById.get(p.id) ?? null }))
}
