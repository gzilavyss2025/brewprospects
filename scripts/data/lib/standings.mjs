// Fetch side of the standings block, shared by gen-archive (past seasons) and
// gen-org (the current season). The shaping is src/lib/model/standings.js.
//
// /standings takes a league id, and a club's league comes from /teams (the
// `league.id` field is there without any hydrate; checked live 2026-09-29).
// One league can hold two Brewers clubs (the Arizona League in 2019: AZL
// Brewers Blue 5430 and Gold 406), so the ids are grouped: one request per
// league, not per club. `getJson` is the caller's fetch, so a test can stub it.
import { standingsByTeam } from '../../../src/lib/model/standings.js'

// A /teams `teams` array in; Map of team id to league id out.
export function leagueIdsByTeam(teams) {
  return new Map(teams.filter((t) => t.league?.id).map((t) => [t.id, t.league.id]))
}

// { [teamId]: record | null } for every id asked for. A club with no league id
// on the teams list gets null, like a club the standings response lacks.
export async function fetchStandings(getJson, season, leagueOf, ids) {
  const byLeague = new Map()
  for (const id of ids) {
    const league = leagueOf.get(id)
    if (league) byLeague.set(league, [...(byLeague.get(league) ?? []), id])
  }
  const out = Object.fromEntries(ids.map((id) => [id, null]))
  for (const [league, teamIds] of byLeague) {
    const r = await getJson(`/standings?leagueId=${league}&season=${season}&standingsTypes=regularSeason`)
    Object.assign(out, standingsByTeam(r, teamIds))
  }
  return out
}
