#!/usr/bin/env node
// gen-careers: snapshot every past player's whole MiLB career, with any club,
// into src/data/archive/careers.json, keyed by player id (docs/adr/0006).
//
// A past player is an archive player who is not in this season's org. The
// archive holds only his lines with Brewers clubs; this holds all of them, in
// the shape gen-org stores for a current player (slimCareer), no-team totals
// included. MLB rows are gen-mlb's, not these (docs/adr/0014).
//
// Refresh rule (careerTargets in src/lib/model/careers.js): a run fetches only
// the ids with no entry. When gen-org moves to a new season, `throughSeason`
// no longer matches and every id is fetched again. Reads org.json and the
// archive, so it runs after gen-org and gen-archive. One request per 40 ids.
//
// Guards: throws, and leaves the last good file in place, when players come
// back missing or when most of a big batch has no MiLB rows at all, which
// means the hydrate stopped working (docs/adr/0003).
//
// The file is packed (packCareers): each club once, each row an array. This
// script works on the unpacked rows and packs on the way out.
//
// Usage: node scripts/data/gen-careers.mjs
import { readFile, readdir, writeFile, rename } from 'node:fs/promises'
import { orgPlayerIds } from '../../src/lib/model/org.js'
import { archiveOnlyIds, careerTargets, mergeCareers, packCareers, unpackCareers } from '../../src/lib/model/careers.js'
import { slimCareer } from './lib/slim.mjs'

const API = 'https://statsapi.mlb.com/api/v1'
const DIR = new URL('../../src/data/archive/', import.meta.url)
const OUT = new URL('careers.json', DIR)
const BATCH = 40
// Same hydrate as gen-org without `draft`: the bio is already in people.json.
const HYDRATE = 'stats(group=[hitting,pitching],type=[yearByYear],leagueListId=milb_all)'

const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'))

async function main() {
  const org = await readJson(new URL('../../src/data/org.json', import.meta.url))
  const files = (await readdir(DIR)).filter((f) => /^\d{4}\.json$/.test(f)).sort()
  const archive = await Promise.all(files.map((f) => readJson(new URL(f, DIR))))
  const ids = archiveOnlyIds(archive, orgPlayerIds(org.rosters))
  if (ids.length < 100) throw new Error(`Only ${ids.length} archive-only players; expected 100 or more.`)

  // No file is a first run. A file that will not parse or unpack is an error.
  const prev = await readJson(OUT).then(unpackCareers, (err) => {
    if (err.code === 'ENOENT') return null
    throw err
  })
  const targets = careerTargets(ids, prev, org.season)
  const fetched = {}
  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH)
    const res = await fetch(`${API}/people?personIds=${chunk.join(',')}&hydrate=${HYDRATE}`)
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching careers`)
    for (const p of (await res.json()).people ?? []) fetched[p.id] = slimCareer(p)
  }

  const got = Object.values(fetched)
  const missing = targets.filter((id) => !fetched[id])
  if (missing.length > targets.length * 0.05) {
    throw new Error(`${missing.length} of ${targets.length} players came back with no person record.`)
  }
  const withRows = got.filter((c) => c.hitting.length || c.pitching.length).length
  if (targets.length >= BATCH && withRows < got.length * 0.5) {
    throw new Error(`Only ${withRows} of ${got.length} players have MiLB rows; the hydrate looks broken.`)
  }

  const merged = mergeCareers(prev, fetched, { ids, season: org.season })
  const pruned = prev && prev.throughSeason === merged.throughSeason && Object.keys(prev.players).length !== Object.keys(merged.players).length
  if (!got.length && !pruned) {
    console.log(`gen-careers: all ${ids.length} past players already have a ${org.season} entry.`)
    return
  }
  const tmp = new URL('careers.json.tmp', DIR)
  await writeFile(tmp, JSON.stringify({ generatedAt: new Date().toISOString(), ...packCareers(merged) }) + '\n')
  await rename(tmp, OUT)
  console.log(`gen-careers: fetched ${got.length} of ${targets.length}; ${Object.keys(merged.players).length} of ${ids.length} past players on file (${org.season}), ${missing.length} without a record.`)
}

main().catch((err) => {
  console.error('gen-careers failed:', err.message)
  process.exit(1)
})
