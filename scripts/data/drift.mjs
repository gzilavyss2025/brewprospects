#!/usr/bin/env node
// API shape drift: CLAUDE.md rule 2 with a script behind it. For each
// captured fixture in test/fixtures/manifest.json, fetch its source URL again
// and list every field path the fixture has that the fresh response lacks.
// Each source URL names a finished season, so its content cannot change; a
// missing path means MLB changed the API's shape. Fields MLB added are not
// flagged. Adapted from bbsbh scripts/check-feed-shape-drift.mjs.
//
// Needs the network, so it runs in the nightly job, not in lint or tests.
//
// Usage: node scripts/data/drift.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Object nesting only; arrays do not count. Stat leaves sit at depth 4
// (people[].stats[].splits[].stat.avg), so 8 leaves room.
const MAX_DEPTH = 8

// Every dotted path in a JSON value. An array is `name[]`, and its paths are
// the union over ALL its elements, so a trimmed fixture and a full fresh
// response compare fairly even when rows differ in optional fields.
export function collectPaths(value, prefix = '', depth = 0, out = new Set()) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, `${prefix}[]`, depth, out)
    return out
  }
  for (const [key, child] of Object.entries(value)) {
    const p = prefix ? `${prefix}.${key}` : key
    out.add(p)
    collectPaths(child, p, depth + 1, out)
  }
  return out
}

export function missingPaths(fixture, fresh) {
  const have = collectPaths(fresh)
  return [...collectPaths(fixture)].filter((p) => !have.has(p)).sort()
}

async function main() {
  const dir = new URL('../../test/fixtures/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'))
  let failed = false
  for (const [file, { sourceUrl }] of Object.entries(manifest)) {
    const fixture = JSON.parse(readFileSync(new URL(file, dir), 'utf8'))
    let fresh
    try {
      const res = await fetch(sourceUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      fresh = await res.json()
    } catch (err) {
      console.error(`✗ ${file}: could not fetch ${sourceUrl} (${err.message}).`)
      failed = true
      continue
    }
    const missing = missingPaths(fixture, fresh)
    if (missing.length) {
      console.error(`✗ ${file}: ${missing.length} path(s) no longer in the API response:`)
      for (const p of missing) console.error(`    ${p}`)
      failed = true
    } else {
      console.log(`✓ ${file}: shape holds.`)
    }
  }
  if (failed) {
    console.error('\nVerify against a live response, fix the reader, then recapture the fixture and update manifest.json.')
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
