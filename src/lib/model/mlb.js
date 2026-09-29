// A player's major-league rows, kept apart from his MiLB rows on purpose. The
// level path, depth chart, and prospect card read only org.json and never see
// these, so a big-league line cannot change what they compute. Rows come from
// scripts/data/gen-mlb.mjs (src/data/mlb.json), shaped by slimMlbPerson.

const isTotal = (r) => !r.team && Boolean(r.teams)

// Oldest season first. Within a season the club rows come first and a
// traded player's total row (no team, `teams` set) comes last, labeled
// "2 teams". Nothing here adds up or derives a stat.
export function mlbRows(entry, group) {
  return [...(entry?.[group] ?? [])]
    .sort((a, b) => a.season.localeCompare(b.season) || Number(isTotal(a)) - Number(isTotal(b)))
    .map((r) => (isTotal(r) ? { ...r, team: `${r.teams} teams` } : r))
}
