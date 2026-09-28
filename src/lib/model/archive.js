// Pure logic over the archive (src/data/archive/*.json) and the historical
// Top 100 rows (data/sources/top-prospects-history/). No fetching here.
import { levelRank } from './levels.js'

// Every player id on any affiliate roster in one archive season.
export function affiliatePlayerIds(seasonData) {
  return new Set(Object.values(seasonData?.rosters ?? {}).flat().map((e) => e.id))
}

// Which of one season's ranked players count as Brewers prospects
// (docs/adr/0007). The rows carry no team, and a list comes out before the
// season while trades happen all year, so the site claims only what the
// rosters show: he played in the Brewers system THAT season, on an affiliate
// or in Milwaukee. A prospect traded mid-season can count for two clubs. In a
// season with no farm rosters (2020), Milwaukee's non-roster invitees count as
// well, and the season is marked incomplete by the generator.
export function brewersRanked(rows, seasonData) {
  const farm = affiliatePlayerIds(seasonData)
  const mke = new Set(seasonData?.milwaukee ?? [])
  const invited = new Set(seasonData?.invitees ?? [])
  return rows
    .filter((r) => farm.has(r.mlbId) || mke.has(r.mlbId) || invited.has(r.mlbId))
    .map((r) => ({
      rank: r.rank,
      source: r.source,
      playerId: r.mlbId,
      onFarm: farm.has(r.mlbId),
      inMilwaukee: mke.has(r.mlbId),
      invited: invited.has(r.mlbId),
    }))
    .sort((a, b) => a.rank - b.rank)
}

// Team ids that were Brewers clubs in one season: its affiliates plus
// Milwaukee itself (MLB team id 158).
export function brewersClubIds(seasonData) {
  return new Set([158, ...(seasonData?.affiliates ?? []).map((a) => a.id)])
}

// Names of the non-Brewers clubs a player appears for in one season's splits.
// Total rows (no team) are ignored. Sorted and unique.
export function otherClubs(splits, season, brewersIds) {
  const names = (splits ?? [])
    .filter((s) => String(s.season) === String(season) && s.team?.id && !brewersIds.has(s.team.id))
    .map((s) => s.team.name)
  return [...new Set(names)].sort()
}

// Every Brewers-system season of one player, as stat rows in the shape the
// player page already reads (see org.js statRows). Lines are for the
// affiliate named on the row only.
export function archiveLines(archive, playerId) {
  const hitting = []
  const pitching = []
  const seasons = []
  for (const season of archive) {
    for (const [teamId, entries] of Object.entries(season.rosters ?? {})) {
      const e = entries.find((x) => x.id === playerId)
      if (!e) continue
      seasons.push({ season: season.season, teamId: Number(teamId), pos: e.pos })
      if (e.hitting) hitting.push(e.hitting)
      if (e.pitching) pitching.push(e.pitching)
    }
  }
  return { hitting, pitching, seasons }
}

// id -> { id, name, pos } for every archive player. The name and position
// come from his LATEST archive season, which is how the org last knew him.
export function archiveIndex(archive) {
  const index = new Map()
  const ordered = [...archive].sort((a, b) => a.season.localeCompare(b.season))
  for (const season of ordered) {
    for (const entries of Object.values(season.rosters ?? {})) {
      for (const e of entries) index.set(e.id, { id: e.id, name: e.name, pos: e.pos })
    }
  }
  return index
}

// A past-only player's page model: bio from people.json, stats from the
// archive. `archiveOnly` tells the page to say the lines cover his Brewers
// seasons, not his whole career.
export function pastPlayer(id, archive, people) {
  const known = archiveIndex(archive).get(id)
  if (!known) return null
  const bio = people?.[id] ?? {}
  const { hitting, pitching } = archiveLines(archive, id)
  return {
    ...bio,
    id,
    name: bio.name || known.name,
    pos: bio.pos || known.pos,
    hitting,
    pitching,
    archiveOnly: true,
  }
}

// One archive season's affiliates, highest level first.
export function clubsByLevel(seasonData) {
  return [...(seasonData?.affiliates ?? [])].sort(
    (a, b) => levelRank(a.sportId) - levelRank(b.sportId) || a.name.localeCompare(b.name),
  )
}

// Rank history for one player across every list: [{ season, rank, source }].
export function rankHistory(historySeasons, playerId) {
  return historySeasons
    .flatMap((s) => s.prospects.filter((p) => p.playerId === playerId).map((p) => ({ season: s.season, rank: p.rank, source: s.source })))
    .sort((a, b) => a.season - b.season)
}
