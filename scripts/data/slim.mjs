// Pure shaping for gen-org.mjs: raw MLB Stats API objects in, the small
// shapes src/data/org.json stores out. Kept apart from the fetch code so the
// unit tests can check it with captured rows and no network.
//
// Field paths below were checked against live 2026 responses
// (/teams/{id}/roster?rosterType=fullSeason, /people?hydrate=stats(...)).

export function slimAffiliate(t) {
  return {
    id: t.id,
    name: t.name ?? '',
    shortName: t.teamName ?? t.clubName ?? t.name ?? '',
    abbreviation: t.abbreviation ?? '',
    sportId: t.sport?.id ?? null,
    league: t.league?.name ?? '',
    city: t.locationName ?? '',
    venue: t.venue?.name ?? '',
  }
}

export function slimRosterEntry(e) {
  return {
    id: e.person?.id,
    name: e.person?.fullName ?? '',
    jersey: e.jerseyNumber || null,
    pos: e.position?.abbreviation ?? '',
    status: e.status?.code ?? '',
    statusText: e.status?.description ?? '',
  }
}

const num = (v) => (Number.isFinite(v) ? v : null)
const str = (v) => (typeof v === 'string' && v !== '' && !/^[.-]+$/.test(v) ? v : null)

function base(split) {
  return {
    season: String(split.season ?? ''),
    sportId: split.sport?.id ?? null,
    teamId: split.team?.id ?? null,
    team: split.team?.name ?? '',
    league: split.league?.name ?? '',
    age: num(split.stat?.age),
  }
}

export function slimHitting(split) {
  const s = split.stat ?? {}
  return {
    ...base(split),
    g: num(s.gamesPlayed), pa: num(s.plateAppearances), ab: num(s.atBats),
    h: num(s.hits), d: num(s.doubles), t: num(s.triples), hr: num(s.homeRuns),
    r: num(s.runs), rbi: num(s.rbi), bb: num(s.baseOnBalls), so: num(s.strikeOuts),
    sb: num(s.stolenBases), cs: num(s.caughtStealing),
    avg: str(s.avg), obp: str(s.obp), slg: str(s.slg), ops: str(s.ops),
  }
}

export function slimPitching(split) {
  const s = split.stat ?? {}
  return {
    ...base(split),
    g: num(s.gamesPitched ?? s.gamesPlayed), gs: num(s.gamesStarted),
    w: num(s.wins), l: num(s.losses), sv: num(s.saves),
    ip: str(s.inningsPitched), h: num(s.hits), bb: num(s.baseOnBalls),
    so: num(s.strikeOuts), hr: num(s.homeRuns),
    era: str(s.era), whip: str(s.whip), k9: str(s.strikeoutsPer9Inn), bb9: str(s.walksPer9Inn),
  }
}

// One person, with every MiLB yearByYear split. The API returns one stats
// block per group; a missing block means the player has no rows in it.
export function slimPerson(p) {
  const splitsFor = (group) =>
    (p.stats ?? []).find((s) => s.group?.displayName === group && s.type?.displayName === 'yearByYear')
      ?.splits ?? []
  const draft = (p.drafts ?? [])[0]
  return {
    id: p.id,
    name: p.fullName ?? '',
    firstName: p.useName ?? p.firstName ?? '',
    lastName: p.lastName ?? '',
    birthDate: p.birthDate ?? null,
    birthPlace: [p.birthCity, p.birthStateProvince, p.birthCountry].filter(Boolean).join(', ') || null,
    pos: p.primaryPosition?.abbreviation ?? '',
    bats: p.batSide?.code ?? null,
    throws: p.pitchHand?.code ?? null,
    height: p.height ?? null,
    weight: p.weight ?? null,
    mlbDebutDate: p.mlbDebutDate ?? null,
    draft: draft
      ? {
          year: p.draftYear ?? draft.year ?? null,
          round: draft.pickRound ?? null,
          pick: draft.pickNumber ?? null,
          team: draft.team?.name ?? null,
          school: draft.school?.name ?? null,
        }
      : null,
    hitting: splitsFor('hitting').map(slimHitting),
    pitching: splitsFor('pitching').map(slimPitching),
  }
}
