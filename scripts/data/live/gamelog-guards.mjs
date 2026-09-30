// The checks gen-gamelog.mjs runs before it replaces src/data/gamelog.json.
// Pure, so the tests can walk each rule (test/gamelog.test.js). A thin or
// broken response must never replace good data (docs/adr/0003).

// More than 5% of the ids with no person record is a bad response. Returns
// the message to throw, or null.
export function missingPeopleProblem(missing, total) {
  return missing > total * 0.05 ? `${missing} of ${total} players came back with no person record.` : null
}

// What the generator does with the rows it fetched. `rows` counts every
// hitting and pitching row; `onDisk` is { season, rows } for the file now on
// disk, or null. Returns { action, reason }.
// - 'keep': nobody has a row yet (before opening day) and the file holds an
//   older season. Leave it, log it, exit 0, as gen-org does.
// - 'fail': no rows and nothing older to keep; an older season than the one
//   on disk; or the same season with more than 10% fewer rows than on disk.
//   A game log only grows within a season.
// - 'write': anything else, including a new season's first few rows.
export function gamelogAction({ season, rows, onDisk }) {
  const fetched = Number(season)
  if (onDisk && Number(onDisk.season) > fetched) {
    return { action: 'fail', reason: `The file holds ${onDisk.season}; refusing to replace it with ${season}.` }
  }
  if (rows === 0) {
    if (onDisk && Number(onDisk.season) < fetched) {
      return { action: 'keep', reason: `No ${season} games yet; keeping the ${onDisk.season} game log.` }
    }
    return { action: 'fail', reason: `No game log rows came back for ${season}.` }
  }
  if (onDisk && Number(onDisk.season) === fetched && onDisk.rows - rows > onDisk.rows * 0.1) {
    return { action: 'fail', reason: `${rows} rows for ${season} against ${onDisk.rows} on disk: more than 10% lost.` }
  }
  return { action: 'write', reason: `${rows} rows for ${season}.` }
}
