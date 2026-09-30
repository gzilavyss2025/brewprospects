// The peer-percentile pools, built once per build from org.json (#39). Pages
// call peerPercentiles(playerId); the pools come from src/lib/model/player/
// percentiles.js and are never rebuilt per page.
import { org, allPlayers } from './data.js'
import { brewersClubIds } from '../model/archive.js'
import { buildPeerIndex, peerPercentilesFor, belowMinimum } from '../model/player/percentiles.js'

// org.json holds this season's org players only, so the current season is the
// only one that can be pooled (owner decision on #39, 2026-09-30). allPlayers()
// leaves out a big-leaguer who is on a rehab assignment (src/lib/model/org.js).
const index = buildPeerIndex({
  players: allPlayers(),
  season: org.season,
  brewersIds: brewersClubIds(org),
})

// One entry for each group and level where the player has the minimum sample
// this season, highest level first; [] for a player under it, a player with
// no rows this season, or an unknown id. The entry's shape is documented at
// peerPercentilesFor.
export function peerPercentiles(playerId) {
  return peerPercentilesFor(index, Number(playerId))
}

// The lines a player has this season, at Brewers clubs, that are under the
// minimum, so the page can say why they have no percentile. [] for anyone not
// in the pool's population (a big-leaguer on a rehab assignment): no reason is
// on record, so the page says nothing.
const population = new Map(allPlayers().map((p) => [p.id, p]))
const brewersIds = brewersClubIds(org)
export function underMinimum(playerId) {
  const player = population.get(Number(playerId))
  return player ? belowMinimum(player, org.season, brewersIds) : []
}
