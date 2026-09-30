// The Pipeline rank log, src/data/pipeline-log.json (#48, docs/adr/0015): the
// pack module, the append logic, and the file step fetch-pipeline runs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { packPipelineLog, unpackPipelineLog, PIPELINE_LOG_COLUMNS } from '../src/lib/snapshot/pipeline-log.js'
import { applyPipelineLog, updatePipelineLog } from '../scripts/data/live/pipeline-log.mjs'
import { packedProblems } from '../scripts/checks/snapshots.mjs'
import { stringifyByLine } from '../scripts/data/lib/by-line.mjs'

const row = (date, playerId, orgRank, topRank = null) => ({ date, playerId, orgRank, topRank })
const list = (...entries) => entries.map(([playerId, orgRank, topRank = null]) => ({ playerId, orgRank, topRank, name: 'x' }))
const rowsOf = (log) => (log ? unpackPipelineLog(log) : [])
const logOf = (...rows) => packPipelineLog(rows)

test('the columns are date, playerId, orgRank, topRank', () => {
  assert.deepEqual(PIPELINE_LOG_COLUMNS, { ranks: ['date', 'playerId', 'orgRank', 'topRank'] })
})

test('a log packs and unpacks to the same rows, and one row is a flat array', () => {
  const rows = [row('2026-09-29', 1, 1, 1), row('2026-09-29', 2, 2, null), row('2026-10-02', 2, 3, null)]
  const file = JSON.parse(stringifyByLine(packPipelineLog(rows)))
  assert.deepEqual(unpackPipelineLog(file), rows)
  assert.deepEqual(file.ranks[1], ['2026-09-29', 2, 2, null])
  assert.equal('generatedAt' in file, false, 'the first row is when the log began')
})

test('a packed log passes the snapshot check', () => {
  const file = logOf(row('2026-09-29', 1, 1, 1), row('2026-09-30', 1, null, null))
  assert.deepEqual(packedProblems('src/data/pipeline-log.json', file), [])
})

test('a field with no column throws instead of being dropped', () => {
  assert.throws(() => packPipelineLog([{ ...row('2026-09-29', 1, 1), name: 'x' }]), /No column/)
})

test('a file with other columns, a bad date or a repeated row does not unpack', () => {
  const good = logOf(row('2026-09-29', 1, 1))
  assert.throws(() => unpackPipelineLog({ ...good, columns: { ranks: ['date', 'playerId', 'topRank', 'orgRank'] } }), /columns/)
  assert.throws(() => unpackPipelineLog({ ...good, ranks: [['29 Sep', 1, 1, null]] }), /date/)
  assert.throws(() => unpackPipelineLog({ ...good, ranks: [['2026-09-29', 1, 1]] }), /width|values/)
  assert.throws(() => unpackPipelineLog({ ...good, ranks: [['2026-09-29', 1, 1, null], ['2026-09-29', 1, 2, null]] }), /twice/)
  assert.throws(() => unpackPipelineLog(null), /log/)
})

test('a new player gets a row, and the first run makes the log', () => {
  const next = applyPipelineLog(null, list([1, 1, 5], [2, 2]), '2026-09-29')
  assert.deepEqual(rowsOf(next), [row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2, null)])
  const added = applyPipelineLog(next, list([1, 1, 5], [2, 2], [3, 3]), '2026-09-30')
  assert.deepEqual(rowsOf(added).slice(2), [row('2026-09-30', 3, 3, null)])
})

test('a rank change adds a row for that player only', () => {
  const log = logOf(row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2))
  const next = applyPipelineLog(log, list([1, 1, 5], [2, 3]), '2026-09-30')
  assert.deepEqual(rowsOf(next).slice(2), [row('2026-09-30', 2, 3, null)])
})

test('a change in topRank alone counts, in both directions', () => {
  const log = logOf(row('2026-09-29', 1, 4, 80))
  const dropped = applyPipelineLog(log, list([1, 4, null]), '2026-09-30')
  assert.deepEqual(rowsOf(dropped).at(-1), row('2026-09-30', 1, 4, null))
  const back = applyPipelineLog(dropped, list([1, 4, 95]), '2026-10-01')
  assert.deepEqual(rowsOf(back).at(-1), row('2026-10-01', 1, 4, 95))
})

test('a null topRank is kept as null and is not a change on its own', () => {
  const log = logOf(row('2026-09-29', 1, 4, null))
  assert.equal(applyPipelineLog(log, list([1, 4, null]), '2026-09-30'), log)
  assert.equal(rowsOf(log)[0].topRank, null)
})

test('a player who leaves the list gets a row of nulls, once', () => {
  const log = logOf(row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2))
  const gone = applyPipelineLog(log, list([1, 1, 5]), '2026-09-30')
  assert.deepEqual(rowsOf(gone).slice(2), [row('2026-09-30', 2, null, null)])
  const still = applyPipelineLog(gone, list([1, 1, 5]), '2026-10-01')
  assert.equal(still, gone, 'a latest row that is already null gets no new row')
})

test('a player who comes back gets a row after his gap', () => {
  const log = logOf(row('2026-09-29', 2, 2), row('2026-09-30', 2, null, null))
  const back = applyPipelineLog(log, list([2, 7]), '2026-10-03')
  assert.deepEqual(rowsOf(back).slice(2), [row('2026-10-03', 2, 7, null)])
})

test('no change returns the log it was given, not a copy', () => {
  const log = logOf(row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2))
  assert.equal(applyPipelineLog(log, list([2, 2], [1, 1, 5]), '2026-09-30'), log)
  assert.equal(applyPipelineLog(log, list([2, 2], [1, 1, 5]), '2026-09-29'), log, 'the same date again, same ranks')
})

test('the same date twice replaces that player row and never adds a second', () => {
  const log = logOf(row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2), row('2026-09-30', 2, 4))
  const next = applyPipelineLog(log, list([1, 1, 5], [2, 6]), '2026-09-30')
  assert.deepEqual(rowsOf(next), [row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2), row('2026-09-30', 2, 6, null)])
})

test('the same date twice, back to the old value, removes that row', () => {
  const log = logOf(row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2), row('2026-09-30', 2, 4))
  const next = applyPipelineLog(log, list([1, 1, 5], [2, 2]), '2026-09-30')
  assert.deepEqual(rowsOf(next), [row('2026-09-29', 1, 1, 5), row('2026-09-29', 2, 2)])
})

test('a player who leaves and returns to his old rank on one date loses the gap row', () => {
  const log = logOf(row('2026-09-29', 2, 2), row('2026-09-30', 2, null, null))
  const next = applyPipelineLog(log, list([2, 2]), '2026-09-30')
  assert.deepEqual(rowsOf(next), [row('2026-09-29', 2, 2)])
})

test('a player who leaves on a date already logged for him is written once', () => {
  const log = logOf(row('2026-09-29', 2, 2), row('2026-09-30', 2, 4))
  const next = applyPipelineLog(log, list([1, 1]), '2026-09-30')
  assert.deepEqual(rowsOf(next).filter((r) => r.playerId === 2), [row('2026-09-29', 2, 2), row('2026-09-30', 2, null, null)])
})

test('a first-day player who is gone on a second run of that day has no row', () => {
  const log = logOf(row('2026-09-29', 1, 1), row('2026-09-29', 2, 2))
  const next = applyPipelineLog(log, list([1, 1]), '2026-09-29')
  assert.deepEqual(rowsOf(next), [row('2026-09-29', 1, 1)])
})

test('rows dated before today never change, and rows stay in date order', () => {
  const log = logOf(row('2026-09-29', 1, 1), row('2026-09-30', 1, 2))
  const before = JSON.stringify(log.ranks)
  const next = applyPipelineLog(log, list([1, 3], [9, 1]), '2026-10-02')
  assert.equal(JSON.stringify(next.ranks.slice(0, 2)), before)
  const dates = rowsOf(next).map((r) => r.date)
  assert.deepEqual(dates, [...dates].sort())
})

test('a date earlier than the latest row is an error, and the log is not touched', () => {
  const log = logOf(row('2026-09-30', 1, 1))
  assert.throws(() => applyPipelineLog(log, list([1, 2]), '2026-09-29'), /earlier/)
  assert.throws(() => applyPipelineLog(log, list([1, 2]), 'today'), /date/)
})

test('the function does not change the log or the list it was given', () => {
  const log = logOf(row('2026-09-29', 1, 1))
  const copy = JSON.stringify(log)
  const prospects = list([1, 2])
  const before = JSON.stringify(prospects)
  applyPipelineLog(log, prospects, '2026-09-30')
  assert.equal(JSON.stringify(log), copy)
  assert.equal(JSON.stringify(prospects), before)
})

// The file step.
async function inTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'pipeline-log-'))
  try {
    return await fn(pathToFileURL(join(dir, 'pipeline-log.json')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('a missing file is the start of a log; a second run with the same list writes nothing', async () => {
  await inTempDir(async (url) => {
    assert.equal(await updatePipelineLog(url, list([1, 1, 2]), '2026-09-29'), 'wrote')
    const first = await readFile(url, 'utf8')
    assert.equal(first.endsWith('\n'), true)
    assert.match(first, /\n\["2026-09-29",1,1,2\]\n/, 'one row per line')
    assert.equal(await updatePipelineLog(url, list([1, 1, 2]), '2026-09-30'), 'unchanged')
    assert.equal(await readFile(url, 'utf8'), first)
    assert.equal(await updatePipelineLog(url, list([1, 2, 2]), '2026-09-30'), 'wrote')
    assert.equal(rowsOf(JSON.parse(await readFile(url, 'utf8'))).length, 2)
  })
})

test('a file that does not parse or unpack is an error, and it is left as it was', async () => {
  for (const text of ['{ not json', JSON.stringify({ columns: { ranks: ['a'] }, ranks: [] }), '']) {
    await inTempDir(async (url) => {
      await writeFile(url, text)
      await assert.rejects(updatePipelineLog(url, list([1, 1]), '2026-09-29'))
      assert.equal(await readFile(url, 'utf8'), text, 'never start a new log over a broken one')
    })
  }
})
