// The Brewers clubs at one level, season by season (ADR-0006, ADR-0008).
// Pure: the seasons come in as argument. Each is an archive season or the
// current season shaped like one ({ season, affiliates, standings }).
import { LEVELS } from './levels.js'

// Public slugs for the level pages (ADR-0009). Keyed on sportId.
const SLUGS = new Map([
  [11, 'aaa'],
  [12, 'double-a'],
  [13, 'high-a'],
  [14, 'single-a'],
  [15, 'short-season-a'],
  [5442, 'rookie-advanced'],
  [16, 'rookie'],
])

export function levelSlug(sportId) {
  return SLUGS.get(sportId) ?? null
}

export function levelBySlug(slug) {
  return LEVELS.find((l) => SLUGS.get(l.sportId) === slug) ?? null
}

// One row per club-season at the level, oldest first. A season with no club at
// the level is a `gap` row; a season with no minor-league season (2020) is a
// `noSeason` row. Neither carries a guess. The club keeps its own name for that
// season, never today's (ADR-0008). A level with no club in any season gives [].
export function levelHistory(sportId, seasons) {
  const ordered = [...seasons].sort((a, b) => a.season.localeCompare(b.season))
  const rows = []
  for (const s of ordered) {
    if (s.noSeason) {
      rows.push({ season: s.season, kind: 'noSeason' })
      continue
    }
    const clubs = (s.affiliates ?? []).filter((a) => a.sportId === sportId)
    if (!clubs.length) {
      rows.push({ season: s.season, kind: 'gap' })
      continue
    }
    for (const c of clubs) {
      rows.push({
        season: s.season, kind: 'club', clubId: c.id, name: c.name, league: c.league ?? null,
        record: s.standings?.[c.id] ?? null,
      })
    }
  }
  return rows.some((r) => r.kind === 'club') ? rows : []
}
