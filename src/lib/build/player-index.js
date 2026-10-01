// The A to Z index for /players/a-z: every player in playerPages(), grouped
// by last-name letter. The grouping is pure and lives in the model.
import { org } from './data.js'
import { archive, playerPages } from './archive.js'
import { buildPlayerIndex } from '../model/player/a-z-index.js'

export function playerIndex() {
  return buildPlayerIndex(playerPages(), archive, { currentSeason: org.season })
}
