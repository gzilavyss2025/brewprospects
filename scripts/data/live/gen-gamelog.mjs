#!/usr/bin/env node
// gen-gamelog: snapshot every org player's game log for the current season
// into src/data/gamelog.json (#35).
//
// Reads the season and the player ids from src/data/org.json, so run it after
// gen-org. One request per 40 players:
//   /people?personIds={ids}&hydrate=stats(group=[hitting,pitching],type=[gameLog],season={y},leagueListId=milb_all)
// `milb_all` returns every level in one request; without it a MiLB game log
// has no rows (docs/api.md). The file is packed and counts only, one player
// per line (docs/adr/0015).
//
// Guards (scripts/data/live/gamelog-guards.mjs): the script throws, and leaves
// the last good file in place, when more than 5% of the ids have no person
// record, when no rows come back, or when the same season would lose more than
// 10% of its rows. Before opening day it keeps an older season and exits 0.
//
// Usage: node scripts/data/live/gen-gamelog.mjs
import { readFile, writeFile, rename } from 'node:fs/promises'
import { orgPlayerIds } from '../../../src/lib/model/org.js'
import { packGamelog, countRows } from '../../../src/lib/snapshot/gamelog.js'
import { stringifyByLine } from '../lib/by-line.mjs'
import { slimGamelogPerson } from './gamelog-slim.mjs'
import { missingPeopleProblem, gamelogAction } from './gamelog-guards.mjs'

const API = 'https://statsapi.mlb.com/api/v1'
const OUT = new URL('../../../src/data/gamelog.json', import.meta.url)
const ORG = new URL('../../../src/data/org.json', import.meta.url)
const BATCH = 40

async function getJson(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  return res.json()
}

const readJson = (url) => readFile(url, 'utf8').then((t) => JSON.parse(t), () => null)

async function main() {
  const org = await readJson(ORG)
  if (!org?.season) throw new Error('src/data/org.json has no season. Run gen-org first.')
  const season = Number(org.season)
  const ids = orgPlayerIds(org.rosters)

  const hydrate = `stats(group=[hitting,pitching],type=[gameLog],season=${season},leagueListId=milb_all)`
  const players = {}
  const opponents = {}
  const seen = new Set()
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const r = await getJson(`/people?personIds=${chunk.join(',')}&hydrate=${hydrate}`)
    for (const p of r.people ?? []) {
      seen.add(p.id)
      const { hitting, pitching, opponents: names } = slimGamelogPerson(p)
      players[p.id] = { hitting, pitching }
      for (const [id, name] of Object.entries(names)) opponents[id] ??= name
    }
  }
  const problem = missingPeopleProblem(ids.filter((id) => !seen.has(id)).length, ids.length)
  if (problem) throw new Error(problem)

  // packGamelog throws on a field with no column, before anything is written.
  const snapshot = packGamelog({
    generatedAt: new Date().toISOString(),
    season,
    players,
    opponents: Object.fromEntries(Object.entries(opponents).sort(([a], [b]) => a - b)),
  })
  const rows = countRows(snapshot)
  const disk = await readJson(OUT)
  const { action, reason } = gamelogAction({ season, rows, onDisk: disk ? { season: disk.season, rows: countRows(disk) } : null })
  if (action === 'fail') throw new Error(reason)
  if (action === 'keep') {
    console.log(`gen-gamelog: ${reason}`)
    return
  }

  const tmp = new URL('gamelog.json.tmp', OUT)
  await writeFile(tmp, stringifyByLine(snapshot))
  await rename(tmp, OUT)
  console.log(`gen-gamelog: ${Object.keys(snapshot.players).length} players, ${rows} rows (${season}).`)
}

main().catch((err) => {
  console.error('gen-gamelog failed:', err.message)
  process.exit(1)
})
