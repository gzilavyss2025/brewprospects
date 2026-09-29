// ADR-0015: the lint check that keeps snapshots packed and counts-only, and
// the one-entry-per-line writer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packedProblems, snapshotProblems, EXEMPT } from '../scripts/checks/snapshots.mjs'
import { stringifyByLine } from '../scripts/data/lib/by-line.mjs'

const packed = () => ({
  generatedAt: 'x',
  columns: { hitting: ['season', 'club', 'h', 'ab'] },
  clubColumns: ['teamId', 'team'],
  clubs: [[158, 'Milwaukee Brewers']],
  players: { 1: { hitting: [[2026, 0, 10, 40]] } },
})

test('a packed, counts-only file passes', () => {
  assert.deepEqual(packedProblems('f', packed()), [])
})

test('a file with no columns table fails', () => {
  assert.match(packedProblems('f', { players: { 1: { hitting: [{ h: 1 }] } } })[0], /no "columns"/)
})

test('a rate fails, as a column or as a key anywhere', () => {
  const asColumn = packed()
  asColumn.columns.hitting.push('avg')
  asColumn.players[1].hitting[0].push('.250')
  assert.ok(packedProblems('f', asColumn).some((p) => /columns\.hitting stores "avg"/.test(p)))
  const asKey = { ...packed(), leaders: [{ id: 1, ops: '.900' }] }
  assert.ok(packedProblems('f', asKey).some((p) => /"ops" key/.test(p)))
})

test('a row of the wrong width, or an object row, fails once per group', () => {
  const f = packed()
  f.players[2] = { hitting: [[2026, 0, 1]] }
  f.players[3] = { hitting: [{ season: 2026 }] }
  assert.deepEqual(packedProblems('f', f), ['f: 2 hitting row(s) are not arrays of 4 values.'])
})

test('a row that points past the club table fails', () => {
  const f = packed()
  f.players[1].hitting[0][1] = 5
  assert.deepEqual(packedProblems('f', f), ['f: 1 hitting row(s) point at a club not in the table.'])
})

test('a new file in src/data must be packed or exempt, and a stale exemption fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'snap-'))
  mkdirSync(join(root, 'src/data/archive'), { recursive: true })
  for (const key of Object.keys(EXEMPT)) {
    writeFileSync(join(root, key.replace('{season}', '2025')), '{}')
  }
  writeFileSync(join(root, 'src/data/gamelog.json'), JSON.stringify({ players: { 1: [{ date: '2026-04-03', h: 2 }] } }))
  assert.deepEqual(snapshotProblems(root), [
    'src/data/gamelog.json has no "columns" table. Pack it (ADR-0015) or add it to EXEMPT with a reason.',
  ])
  writeFileSync(join(root, 'src/data/gamelog.json'), JSON.stringify(packed()))
  assert.deepEqual(snapshotProblems(root), [])
  // A tree with none of the exempt files: every exemption is stale.
  const bare = mkdtempSync(join(tmpdir(), 'snap-'))
  mkdirSync(join(bare, 'src/data'), { recursive: true })
  assert.equal(snapshotProblems(bare).filter((p) => p.endsWith('which is gone. Remove the line.')).length, Object.keys(EXEMPT).length)
})

test('stringifyByLine parses to the same value, one entry per line', () => {
  const f = packed()
  f.players[2] = { hitting: [] }
  const text = stringifyByLine(f)
  assert.deepEqual(JSON.parse(text), f)
  assert.ok(text.includes('\n"1":{"hitting":[[2026,0,10,40]]},\n"2":'))
  assert.ok(text.endsWith('\n'))
  assert.deepEqual(JSON.parse(stringifyByLine({ clubs: [], players: {} })), { clubs: [], players: {} })
})
