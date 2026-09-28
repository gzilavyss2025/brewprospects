// Player id to current path, for the 404 page's redirect (ADR-0009). Built
// from the same list as the player pages, so each entry has a page.
import { playerPathMap } from '../lib/build/archive.js'

export function GET() {
  return new Response(JSON.stringify(playerPathMap()), { headers: { 'Content-Type': 'application/json' } })
}
