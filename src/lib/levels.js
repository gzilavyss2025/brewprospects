// MiLB levels, keyed by MLB Stats API sportId. Order is HIGH to LOW, the order
// the depth chart reads top to bottom. sportId 16 holds every complex league
// (ACL, DSL), which the API does not split by sportId.
export const LEVELS = [
  { sportId: 11, label: 'AAA', name: 'Triple-A' },
  { sportId: 12, label: 'AA', name: 'Double-A' },
  { sportId: 13, label: 'A+', name: 'High-A' },
  { sportId: 14, label: 'A', name: 'Single-A' },
  { sportId: 16, label: 'CPX', name: 'Complex' },
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
