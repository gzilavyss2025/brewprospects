// The Pipeline rank log (#48, docs/adr/0015): src/data/pipeline-log.json keeps
// a player's ranks only on the dates they changed. fetch-pipeline.mjs calls
// updatePipelineLog after it writes pipeline.json. The rows are packed by
// src/lib/snapshot/pipeline-log.js.
import { readFile, writeFile, rename } from 'node:fs/promises'
import { packPipelineLog, unpackPipelineLog } from '../../../src/lib/snapshot/pipeline-log.js'
import { stringifyByLine } from '../lib/by-line.mjs'

const same = (a, b) => a[0] === b[0] && a[1] === b[1]
const DATE = /^\d{4}-\d{2}-\d{2}$/

// The new packed log for today's `prospects`, or `log` itself (the same
// object) when nothing changed. `log` is null when there is no file yet.
//
// A row is a change from the player's latest row before `today`:
// - a player not yet in the log, or with other ranks, gets a row;
// - a player who left the list gets a row of nulls (a gap, never a fill);
// - a player whose latest row is already null gets no row.
// Running twice on one date replaces that date's row, and drops it when the
// ranks are back to what they were. Earlier rows never change.
export function applyPipelineLog(log, prospects, today) {
  if (typeof today !== 'string' || !DATE.test(today)) throw new Error(`The log date "${today}" is not a yyyy-mm-dd date.`)
  const rows = log ? unpackPipelineLog(log) : []
  const latest = rows.reduce((max, r) => (r.date > max ? r.date : max), '')
  if (latest > today) throw new Error(`The log date ${today} is earlier than its latest row (${latest}).`)

  const before = new Map() // playerId -> [orgRank, topRank] as of the day before `today`
  for (const r of rows) if (r.date < today) before.set(r.playerId, [r.orgRank, r.topRank])
  const ranked = new Map(prospects.map((p) => [p.playerId, [p.orgRank, p.topRank ?? null]]))

  const known = new Set([...before.keys(), ...rows.filter((r) => r.date === today).map((r) => r.playerId), ...ranked.keys()])
  const next = []
  for (const playerId of [...known].sort((a, b) => a - b)) {
    const now = ranked.get(playerId) ?? [null, null]
    const prior = before.get(playerId)
    if (prior ? same(prior, now) : !ranked.has(playerId)) continue
    next.push({ date: today, playerId, orgRank: now[0], topRank: now[1] })
  }

  const current = rows.filter((r) => r.date === today)
  if (current.length === next.length && current.every((r, i) => same([r.orgRank, r.topRank], [next[i].orgRank, next[i].topRank]) && r.playerId === next[i].playerId)) {
    return log
  }
  return packPipelineLog([...rows.filter((r) => r.date < today), ...next])
}

// The file, or null when there is none. A file that does not parse or unpack
// throws: never start a new log over a broken one.
async function readPipelineLog(url) {
  let text
  try {
    text = await readFile(url, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
  const file = JSON.parse(text)
  unpackPipelineLog(file)
  return file
}

// Same step as the other snapshots: a temp file, then a rename.
export async function writePipelineLog(url, log) {
  const tmp = new URL(`${url.pathname.split('/').pop()}.tmp`, url)
  await writeFile(tmp, stringifyByLine(log))
  await rename(tmp, url)
}

// Reads the log, applies today's list, and writes only on a change.
// Returns 'wrote' or 'unchanged'.
export async function updatePipelineLog(url, prospects, today) {
  const log = await readPipelineLog(url)
  const next = applyPipelineLog(log, prospects, today)
  if (next === log) return 'unchanged'
  await writePipelineLog(url, next)
  return 'wrote'
}
