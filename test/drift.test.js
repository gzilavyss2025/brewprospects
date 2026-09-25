import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { collectPaths, missingPaths } from '../scripts/data/drift.mjs'
import manifest from './fixtures/manifest.json' with { type: 'json' }

test('every fixture has a manifest entry with a capture date and source URL, and back', () => {
  const files = readdirSync(new URL('./fixtures/', import.meta.url)).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  assert.deepEqual(Object.keys(manifest).sort(), files.sort())
  for (const [file, meta] of Object.entries(manifest)) {
    assert.match(meta.capturedAt, /^\d{4}-\d{2}-\d{2}$/, file)
    assert.match(meta.sourceUrl, /^https:\/\/statsapi\.mlb\.com\//, file)
  }
})

test('array paths are the union over every element', () => {
  const paths = collectPaths({ roster: [{ a: 1 }, { b: { c: 2 } }] })
  assert.deepEqual([...paths].sort(), ['roster', 'roster[].a', 'roster[].b', 'roster[].b.c'])
})

test('a renamed field is drift; an added field is not', () => {
  const fixture = { people: [{ id: 1, stats: [{ splits: [{ stat: { avg: '.300' } }] }] }] }
  const fresh = { people: [{ id: 1, extra: true, stats: [{ splits: [{ stat: { battingAverage: '.300' } }] }] }] }
  assert.deepEqual(missingPaths(fixture, fresh), ['people[].stats[].splits[].stat.avg'])
})

test('a trimmed fixture matches a fuller response', () => {
  const fixture = { roster: [{ person: { id: 1, birthStateProvince: 'IL' } }] }
  const fresh = { roster: [{ person: { id: 2 } }, { person: { id: 1, birthStateProvince: 'IL' } }] }
  assert.deepEqual(missingPaths(fixture, fresh), [])
})

test('stat leaves are deep enough to be checked', () => {
  const paths = collectPaths({ people: [{ stats: [{ splits: [{ stat: { avg: '.300' } }] }] }] })
  assert.ok(paths.has('people[].stats[].splits[].stat.avg'))
})
