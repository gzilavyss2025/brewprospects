// Levels, keyed by MLB Stats API sportId. Order is HIGH to LOW, the order the
// depth chart reads top to bottom. MLB (1) is here so a player's big-league
// rows show. sportId 15 is short-season A (before 2021). sportId 5442 is
// Rookie Advanced, seen for 2019 only (checked 2026-09-29: retired, not in
// /sports). sportId 16 holds every complex league (ACL, DSL, and the Pioneer
// League through 2018), which the API does not split.
export const LEVELS = [
  { sportId: 1, label: 'MLB', name: 'Major League Baseball' },
  { sportId: 11, label: 'AAA', name: 'Triple-A' },
  { sportId: 12, label: 'AA', name: 'Double-A' },
  { sportId: 13, label: 'A+', name: 'High-A' },
  { sportId: 14, label: 'A', name: 'Single-A' },
  { sportId: 15, label: 'SS-A', name: 'Short-season A' },
  { sportId: 5442, label: 'ROK+', name: 'Rookie Advanced' },
  { sportId: 16, label: 'ROK', name: 'Rookie' },
]

// sportId 21 is the API's "Minor League Baseball" total row. It is a sum of
// the other rows, not a level, so level views must drop it.
export const MILB_TOTAL_SPORT_ID = 21

const BY_SPORT = new Map(LEVELS.map((l) => [l.sportId, l]))

export function levelFor(sportId) {
  return BY_SPORT.get(sportId) ?? null
}

// Lower number = higher level. Unknown sportIds sort last.
export function levelRank(sportId) {
  const i = LEVELS.findIndex((l) => l.sportId === sportId)
  return i === -1 ? LEVELS.length : i
}
