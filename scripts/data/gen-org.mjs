#!/usr/bin/env node
// gen-org: snapshot the Brewers farm system into src/data/org.json.
//
// Reads the public MLB Stats API: the affiliates (parentOrgId 158), each
// affiliate's full-season roster, and every rostered player's MiLB
// year-by-year stats, plus each affiliate's regular-season record (the
// `standings` block, keyed by team id; null where the API has none, as before
// a season starts). Runs nightly in GitHub Actions and on demand with
// `npm run data`. About 20 requests in total.
//
// Guards: the script throws, and leaves the last good file in place, when the
// affiliate count or the player count looks wrong. A thin or broken response
// must never replace good data (docs/adr/0003).
//
// The players are packed, counts only (docs/adr/0015, packOrg), one player
// per line so a nightly diff shows only the players whose rows changed.
//
// Usage: node scripts/data/gen-org.mjs [season]
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { ORG_ID } from '../../src/config/site.js'
import { orgPlayerIds, rosterVerdict, snapshotAction } from '../../src/lib/model/org.js'
import { slimAffiliate, slimRosterEntry, slimPerson } from './lib/slim.mjs'
import { fetchStandings, leagueIdsByTeam } from './lib/standings.mjs'
import { stringifyByLine } from './lib/by-line.mjs'
import { packOrg } from '../../src/lib/snapshot/milb.js'

const API = 'https://statsapi.mlb.com/api/v1'
const MILB_SPORT_IDS = [11, 12, 13, 14, 16]
const OUT = new URL('../../src/data/org.json', import.meta.url)
const BATCH = 40

async function getJson(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  return res.json()
}

async function main() {
  const season = process.argv[2] ?? String(new Date().getFullYear())

  const teams = await getJson(`/teams?sportIds=${MILB_SPORT_IDS.join(',')}&season=${season}`)
  const affiliates = (teams.teams ?? [])
    .filter((t) => t.parentOrgId === ORG_ID)
    .map(slimAffiliate)
  // Four full-season clubs plus at least one complex club, every year since
  // the 2021 affiliate map. Fewer means a bad response, not a smaller org.
  if (affiliates.length < 5) {
    throw new Error(`Only ${affiliates.length} affiliates for ${season}; expected 5 or more.`)
  }

  const rosters = {}
  for (const a of affiliates) {
    const r = await getJson(`/teams/${a.id}/roster?rosterType=fullSeason&season=${season}`)
    rosters[a.id] = (r.roster ?? []).map(slimRosterEntry).filter((e) => e.id)
  }

  const ids = orgPlayerIds(rosters)
  // Between seasons, and while a new season's rosters fill in during spring,
  // keep last season's snapshot and succeed so the nightly job stays green.
  // A thin roster for the season already on disk still fails (snapshotAction).
  const onDisk = await readFile(OUT, 'utf8').then((t) => JSON.parse(t).season, () => null)
  const action = snapshotAction(rosterVerdict(ids.length), { season, onDisk, explicit: Boolean(process.argv[2]) })
  if (action === 'keep') {
    console.log(`gen-org: ${season} has ${ids.length} org players so far; keeping the ${onDisk} snapshot.`)
    return
  }
  if (action === 'fail') {
    throw new Error(`Only ${ids.length} org players for ${season}; expected 100 or more.`)
  }

  const players = {}
  const hydrate = 'draft,stats(group=[hitting,pitching],type=[yearByYear],leagueListId=milb_all)'
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const r = await getJson(`/people?personIds=${chunk.join(',')}&hydrate=${hydrate}`)
    for (const p of r.people ?? []) players[p.id] = slimPerson(p)
  }
  const missing = ids.filter((id) => !players[id])
  if (missing.length > ids.length * 0.05) {
    throw new Error(`${missing.length} of ${ids.length} players came back with no person record.`)
  }

  // No all-null guard here, unlike gen-archive: in spring a new season has no
  // games, so every record is null and that is true, not a bad response.
  const standings = await fetchStandings(getJson, season, leagueIdsByTeam(teams.teams ?? []), affiliates.map((a) => a.id))

  // packOrg throws on a field with no column, before anything is written.
  const snapshot = packOrg({ generatedAt: new Date().toISOString(), season, affiliates, rosters, players, standings })
  await mkdir(new URL('.', OUT), { recursive: true })
  const tmp = new URL('org.json.tmp', new URL('.', OUT))
  await writeFile(tmp, stringifyByLine(snapshot))
  await rename(tmp, OUT)
  console.log(`gen-org: ${affiliates.length} affiliates, ${Object.keys(players).length} players (${season}).`)
}

main().catch((err) => {
  console.error('gen-org failed:', err.message)
  process.exit(1)
})
