// The game log row model (#35). Pure: rows in, rows out. A row is one game a
// player played, with the fields src/lib/snapshot/gamelog.js unpacks.

// Oldest first: by date, then by game number (game 2 of a doubleheader is
// later than game 1), then by gamePk so the order is always the same. A
// missing game number sorts first; the date decides nearly every row anyway.
export function compareGames(a, b) {
  return a.date - b.date || (a.gameNumber ?? 0) - (b.gameNumber ?? 0) || a.gamePk - b.gamePk
}

// A new array, newest game first. Streaks and windows (#36, #46) read the
// same rows back to front.
export function newestFirst(rows) {
  return [...rows].sort((a, b) => compareGames(b, a))
}
