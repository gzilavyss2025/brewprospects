// Build-time access to the generated snapshots. Pages import from here, not
// from the JSON files, so a file shape change touches one module.
import orgFile from '../../data/org.json' with { type: 'json' }
import pipeline from '../../data/pipeline.json' with { type: 'json' }
import mlbFile from '../../data/mlb.json' with { type: 'json' }
import { levelRank } from '../model/levels.js'
import { unpackMlb } from '../model/mlb.js'
import { playersWithRates } from '../model/player/rates.js'
import { unpackOrg } from '../snapshot/milb.js'
import { currentAssignments, orgPlayerIds } from '../model/org.js'
import { paths } from '../slug.js'

// org.json and mlb.json are packed and store counts (docs/adr/0015); every
// reader gets plain rows. org.json rows get their rates here, once; mlbRows
// adds the MLB rates.
const unpacked = unpackOrg(orgFile)
const org = { ...unpacked, players: playersWithRates(unpacked.players) }
const mlb = unpackMlb(mlbFile)

export { org, pipeline, mlb }

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

// A player's big-league rows, or null when he has none (ADR-0014).
export function mlbFor(playerId) {
  return mlb.players[playerId] ?? null
}
