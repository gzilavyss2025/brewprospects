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

// One hitting or pitching row: counts only, no rates (docs/adr/0015).
// src/lib/model/player/rates.js computes AVG, OBP, SLG and OPS from these,
// which is why HBP and SF are kept, and IP, ERA, WHIP, K/9 and BB/9 from outs
// and earned runs. MiLB and MLB rows share them. Fields checked live
// 2026-09-29: hitByPitch and sacFlies on hitting splits, outs and earnedRuns
// on pitching splits (test/fixtures/people-mlb-yearbyyear.json,
// people-yearbyyear.json, people-milb-careers.json and
// roster-season-2025-biloxi.json).
export function slimHitting(split) {
  const s = split.stat ?? {}
  return {
    ...base(split),
    g: num(s.gamesPlayed), pa: num(s.plateAppearances), ab: num(s.atBats),
    h: num(s.hits), d: num(s.doubles), t: num(s.triples), hr: num(s.homeRuns),
    r: num(s.runs), rbi: num(s.rbi), bb: num(s.baseOnBalls), so: num(s.strikeOuts),
    sb: num(s.stolenBases), cs: num(s.caughtStealing), hbp: num(s.hitByPitch), sf: num(s.sacFlies),
  }
}

export function slimPitching(split) {
  const s = split.stat ?? {}
  return {
    ...base(split),
    g: num(s.gamesPitched ?? s.gamesPlayed), gs: num(s.gamesStarted),
    w: num(s.wins), l: num(s.losses), sv: num(s.saves), outs: num(s.outs),
    h: num(s.hits), bb: num(s.baseOnBalls), so: num(s.strikeOuts), hr: num(s.homeRuns),
    er: num(s.earnedRuns),
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

// One past player's whole MiLB career, for gen-careers: the same hitting and
// pitching rows gen-org keeps, with every club and any no-team total as the
// API sent them. No bio: people.json has it (checked live 2026-09-29, the
// request in test/fixtures/manifest.json).
export function slimCareer(p) {
  const { hitting, pitching } = slimPerson(p)
  return { hitting, pitching }
}

// One archive roster entry: who, and his line FOR THIS CLUB only. The season
// stats hydrate returns one split per club at that level plus a no-team total
// when a player changed clubs (checked live: Biloxi 2025, Raúl Alcantara).
// Only the split whose team is this affiliate is kept; with none, the player
// was on the roster but did not play for this club, and the line is null.
export function slimArchiveEntry(e, teamId, sportId) {
  const lineFor = (group, slim) => {
    const splits = (e.person?.stats ?? []).find((s) => s.group?.displayName === group)?.splits ?? []
    const split = splits.find((s) => s.team?.id === teamId)
    return split ? slim({ ...split, sport: split.sport ?? { id: sportId } }) : null
  }
  return {
    ...slimRosterEntry(e),
    hitting: lineFor('hitting', slimHitting),
    pitching: lineFor('pitching', slimPitching),
  }
}

// The short bio kept for a past player. Same fields as slimPerson, no stats:
// a past player's lines come from the archive rosters.
export function slimBio(p) {
  const { hitting: _h, pitching: _p, ...bio } = slimPerson({ ...p, stats: [] })
  return bio
}

// One person's MLB yearByYear splits (hydrate `sportId=1`), for gen-mlb. Kept
// apart from slimPerson so no MiLB reader ever sees a big-league row. A player
// traded in-season has one split per club plus a total with no team and
// `numTeams` set (checked live 2026-09-29: Mike Cameron 2011). A player with
// no big-league rows comes back with no stats block at all.
export function slimMlbPerson(p) {
  const splitsFor = (group) =>
    (p.stats ?? []).find((s) => s.group?.displayName === group && s.type?.displayName === 'yearByYear')
      ?.splits ?? []
  const withTeams = (slim) => (split) => ({ ...slim(split), teams: num(split.numTeams) })
  return {
    hitting: splitsFor('hitting').map(withTeams(slimHitting)),
    pitching: splitsFor('pitching').map(withTeams(slimPitching)),
  }
}
