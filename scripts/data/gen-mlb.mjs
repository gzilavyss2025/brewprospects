#!/usr/bin/env node
// gen-mlb: snapshot every site player's major-league year-by-year stats into
// src/data/mlb.json, keyed by player id. A player with no big-league rows is
// left out, so the file holds only the players who reached MLB.
//
// Covers every player who has a page: the org players in org.json and the
// past players in src/data/archive/people.json (ADR-0006). One request per 40
// players. It is a separate file from org.json on purpose: no MiLB reader
// ever sees an MLB row (docs/adr/0014).
//
// Guards: throws, and leaves the last good file in place, when players come
// back missing or no one at all has a big-league row (docs/adr/0003).
//
// Usage: node scripts/data/gen-mlb.mjs
import { readFile, writeFile, rename } from 'node:fs/promises'
import { slimMlbPerson } from './lib/slim.mjs'

const API = 'https://statsapi.mlb.com/api/v1'
const OUT = new URL('../../src/data/mlb.json', import.meta.url)
const BATCH = 40
const HYDRATE = 'stats(group=[hitting,pitching],type=[yearByYear],sportId=1)'

const readJson = async (rel) => JSON.parse(await readFile(new URL(rel, import.meta.url), 'utf8'))

async function main() {
  const org = await readJson('../../src/data/org.json')
  const people = await readJson('../../src/data/archive/people.json')
  const ids = [...new Set([...Object.keys(org.players), ...Object.keys(people)].map(Number))].sort((a, b) => a - b)

  const players = {}
  const seen = new Set()
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const res = await fetch(`${API}/people?personIds=${chunk.join(',')}&hydrate=${HYDRATE}`)
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching MLB splits`)
    for (const p of (await res.json()).people ?? []) {
      seen.add(p.id)
      const slim = slimMlbPerson(p)
      if (slim.hitting.length || slim.pitching.length) players[p.id] = slim
    }
  }
  const missing = ids.filter((id) => !seen.has(id))
  if (missing.length > ids.length * 0.05) {
    throw new Error(`${missing.length} of ${ids.length} players came back with no person record.`)
  }
  // Brewers alumni fill the archive, so a healthy run finds hundreds.
  if (Object.keys(players).length < 50) {
    throw new Error(`Only ${Object.keys(players).length} players with MLB rows; expected 50 or more.`)
  }

  const snapshot = { generatedAt: new Date().toISOString(), players }
  const tmp = new URL('mlb.json.tmp', OUT)
  await writeFile(tmp, JSON.stringify(snapshot) + '\n')
  await rename(tmp, OUT)
  console.log(`gen-mlb: ${Object.keys(players).length} of ${ids.length} players have MLB rows.`)
}

main().catch((err) => {
  console.error('gen-mlb failed:', err.message)
  process.exit(1)
})
