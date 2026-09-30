// JSON text for a packed snapshot (docs/adr/0015) with one entry per line in
// each large table: one club per line in `clubs`, one player per line in
// `players`, and one row per line in a season file's `roster`, `hitting` and
// `pitching` (src/lib/snapshot/season.js). gamelog.json's `opponents` table
// is one team per line too. It parses to the same value as
// JSON.stringify, but a nightly diff shows only the entries that changed, and
// a reviewer can read it.
const TABLES = ['clubs', 'players', 'roster', 'hitting', 'pitching', 'opponents']

function table(value) {
  const lines = Array.isArray(value)
    ? value.map((v) => JSON.stringify(v))
    : Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  return lines.length ? `${open}\n${lines.join(',\n')}\n${close}` : `${open}${close}`
}

export function stringifyByLine(snapshot) {
  const parts = Object.entries(snapshot).map(([k, v]) =>
    `${JSON.stringify(k)}:${TABLES.includes(k) && v && typeof v === 'object' ? table(v) : JSON.stringify(v)}`,
  )
  return `{${parts.join(',\n')}}\n`
}
