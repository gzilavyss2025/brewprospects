// A club's regular-season record: /standings?leagueId={id}&season={y}&standingsTypes=regularSeason,
// shaped to one small record per team id. Field paths were checked against live
// responses on 2026-09-29 (Pioneer League 2019, Arizona League 2006; see
// test/fixtures/manifest.json). Per team: wins, losses, runsScored and
// runsAllowed are numbers; winningPercentage and divisionRank are strings
// (".427", "3"). A league with no divisions sends no divisionRank (Arizona
// League 2006 to 2008), and that stays missing (ADR-0003).
// Key on the team id: team.name is only the nickname, and ids repeat across
// clubs (ADR-0008), so a record is one id in one season.

const num = (v) => (Number.isFinite(v) ? v : null)
const str = (v) => (typeof v === 'string' && v !== '' && !/^[.-]+$/.test(v) ? v : null)
const rank = (v) => {
  const n = Number(v)
  return typeof v === 'string' && v !== '' && Number.isInteger(n) && n > 0 ? n : null
}

// One teamRecord object in, one slim record out. With neither wins nor losses
// there is no record to show, so the answer is null and not a row of blanks.
export function slimStanding(t) {
  if (!Number.isFinite(t?.wins) && !Number.isFinite(t?.losses)) return null
  return {
    wins: num(t.wins),
    losses: num(t.losses),
    pct: str(t.winningPercentage),
    divRank: rank(t.divisionRank),
    rs: num(t.runsScored),
    ra: num(t.runsAllowed),
  }
}

// A whole /standings response in; { [teamId]: record | null } out, for exactly
// the ids asked for. A team the response does not hold gets null.
export function standingsByTeam(response, teamIds) {
  const held = new Map()
  for (const r of response?.records ?? []) {
    for (const t of r.teamRecords ?? []) held.set(t.team?.id, t)
  }
  return Object.fromEntries(teamIds.map((id) => [id, slimStanding(held.get(id))]))
}

// The season-level guard (ADR-0006): a finished season whose clubs mostly have
// no record means a bad response, not a bad year. Returns a sentence, or null
// when the block is fine. A season with no clubs has nothing to check.
export function standingsProblem(block) {
  const ids = Object.keys(block)
  const none = ids.filter((id) => block[id] === null).length
  return none * 2 > ids.length ? `${none} of ${ids.length} clubs have no standings record.` : null
}
