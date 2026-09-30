// The packed Pipeline rank log, src/data/pipeline-log.json (docs/adr/0015,
// #48). One row per change in a player's ranks: `date` (an ISO date, UTC),
// `playerId`, `orgRank` and `topRank`. A row of nulls means the player left
// the list on that date; the chart shows a gap there (docs/adr/0003). Rows are
// in date order. The file has no `generatedAt`: its first row's date is when
// the log began. There are no clubs in a row, so the club table is empty.
import { packer, unpacker } from './pack.js'

export const PIPELINE_LOG_COLUMNS = { ranks: ['date', 'playerId', 'orgRank', 'topRank'] }
const DATE = /^\d{4}-\d{2}-\d{2}$/

// Packs [{ date, playerId, orgRank, topRank }]. A field with no column throws.
export function packPipelineLog(rows) {
  const { row } = packer({ columns: PIPELINE_LOG_COLUMNS, clubColumns: [] })
  return { columns: PIPELINE_LOG_COLUMNS, ranks: rows.map((r) => row('ranks', r)) }
}

// The reverse: plain rows, in file order. It throws on a file that is not a
// log, so the nightly job never starts a new log over a broken one.
export function unpackPipelineLog(file) {
  const want = PIPELINE_LOG_COLUMNS.ranks
  if (!file || typeof file !== 'object') throw new Error('The Pipeline log is not an object.')
  if (JSON.stringify(file.columns?.ranks) !== JSON.stringify(want)) {
    throw new Error(`The Pipeline log columns are not ${want.join(', ')}.`)
  }
  if (!Array.isArray(file.ranks)) throw new Error('The Pipeline log has no ranks table.')
  const unpack = unpacker({ columns: file.columns, clubColumns: [], clubs: [] })
  const seen = new Set()
  return file.ranks.map((values, i) => {
    if (!Array.isArray(values) || values.length !== want.length) {
      throw new Error(`Pipeline log row ${i} is not an array of ${want.length} values.`)
    }
    const r = unpack('ranks', values)
    if (typeof r.date !== 'string' || !DATE.test(r.date)) throw new Error(`Pipeline log row ${i} has a bad date.`)
    if (!Number.isInteger(r.playerId)) throw new Error(`Pipeline log row ${i} has no player id.`)
    for (const k of ['orgRank', 'topRank']) {
      if (r[k] !== null && !Number.isInteger(r[k])) throw new Error(`Pipeline log row ${i} has a bad ${k}.`)
    }
    const key = `${r.date}/${r.playerId}`
    if (seen.has(key)) throw new Error(`Pipeline log has player ${r.playerId} twice on ${r.date}.`)
    seen.add(key)
    return r
  })
}
