#!/usr/bin/env node
// fetch-pipeline: snapshot MLB Pipeline's Brewers Top 30 (and each Brewer's
// overall Top 100 rank) into src/data/pipeline.json.
//
// Adapted from Tally's scripts/fetch-top-prospects.mjs. The source is an
// editorial page on www.mlb.com, not a documented API: it embeds the list as an
// inline `var data = [...]`. It sends no CORS headers, so this must run on a
// server (GitHub Actions), never in the browser. See docs/adr/0004.
//
// Two URLs, two different datasets on the SAME page:
//   bare URL                 -> the overall Top 100 (ranks 1-100, unique)
//   ?type=all&minPA=1        -> every org's own list (rank = rank inside the org)
// The same bare URL has, at least once, served the per-org shape instead, so
// each fetch checks its shape and the script fails rather than write bad data.
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { ORG_ID } from '../../src/config/site.js'
import { extractEntries, assertTop100Shape, assertOrgShape, dedupeByPlayer, statLineFor } from './pipeline-parse.mjs'

const TOP100_URL = 'https://www.mlb.com/prospects/stats/top-prospects'
const ORG_URL = 'https://www.mlb.com/prospects/stats/top-prospects?type=all&minPA=1'
const OUT = new URL('../../src/data/pipeline.json', import.meta.url)
const UA = 'brewprospects-pipeline/0.1 (fan site prospect-rank snapshot)'

async function fetchEntries(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return extractEntries(await res.text())
}

async function main() {
  const [top100Raw, orgRaw] = await Promise.all([fetchEntries(TOP100_URL), fetchEntries(ORG_URL)])
  assertTop100Shape(top100Raw)
  assertOrgShape(orgRaw)

  const topRank = new Map(dedupeByPlayer(top100Raw).map((e) => [e.playerId, e.rank]))
  const prospects = dedupeByPlayer(orgRaw)
    .filter((e) => e.teamId === ORG_ID)
    .map((e) => ({
      orgRank: e.rank,
      topRank: topRank.get(e.playerId) ?? null,
      playerId: e.playerId,
      name: e.name ?? '',
      position: e.position ?? '',
      levelRaw: e.sportAbbrev ?? '',
      statLine: statLineFor(e),
      age: e.age ?? null,
    }))
    .sort((a, b) => a.orgRank - b.orgRank)
  if (prospects.length < 15) {
    throw new Error(`Only ${prospects.length} ranked Brewers prospects; expected about 30.`)
  }

  const snapshot = { generatedAt: new Date().toISOString(), source: ORG_URL, prospects }
  await mkdir(new URL('.', OUT), { recursive: true })
  const tmp = new URL('pipeline.json.tmp', new URL('.', OUT))
  await writeFile(tmp, JSON.stringify(snapshot, null, 2) + '\n')
  await rename(tmp, OUT)
  console.log(`fetch-pipeline: ${prospects.length} ranked Brewers prospects.`)
}

main().catch((err) => {
  console.error('fetch-pipeline failed:', err.message)
  process.exit(1)
})
