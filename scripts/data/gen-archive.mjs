#!/usr/bin/env node
// gen-archive: snapshot past Brewers farm seasons into src/data/archive/.
//
// One file per season ({season}.json): every affiliate that season, each
// one's full-season roster with the player's line FOR THAT CLUB, and the
// Milwaukee roster's ids (used to credit a ranked prospect who spent the year
// in the majors). Plus people.json: a short bio for every archive player.
//
// Past seasons do not change, so a season already on disk is skipped. Pass
// --refetch to rebuild every season (use it after a parser fix), or
// --season 2015 to rebuild one. The default run is cheap: it only fills
// seasons that are missing, which is how a finished season joins the archive.
//
// Guards (docs/adr/0006): a season throws, and nothing is written, when it has
// fewer than 4 affiliates, fewer than 100 players, or more than half its
// clubs with an empty roster. A season in NO_MILB_SEASONS is written as a
// record of why it is empty. Requests run one at a time.
//
// Usage: node scripts/data/gen-archive.mjs [--refetch] [--season YYYY]
import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises'
import { ORG_ID, ARCHIVE_FIRST_SEASON, NO_MILB_SEASONS } from '../../src/config/site.js'
import { slimAffiliate, slimArchiveEntry, slimBio } from './lib/slim.mjs'

const API = 'https://statsapi.mlb.com/api/v1'
// 15 was short-season A before 2021. The Brewers had no club there in the
// archive window, but a season that did would still be read.
const MILB_SPORT_IDS = [11, 12, 13, 14, 15, 16]
const DIR = new URL('../../src/data/archive/', import.meta.url)
const BATCH = 40

async function getJson(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  return res.json()
}

async function exists(url) {
  try {
    await access(url)
    return true
  } catch {
    return false
  }
}

async function writeJson(name, data) {
  const out = new URL(name, DIR)
  const tmp = new URL(`${name}.tmp`, DIR)
  await writeFile(tmp, JSON.stringify(data) + '\n')
  await rename(tmp, out)
}

async function buildSeason(season) {
  if (NO_MILB_SEASONS[season]) {
    // No farm rosters exist, so keep what the API does have: Milwaukee's
    // roster and its non-roster invitees to big-league camp (2020: 44 and 25,
    // checked live). docs/adr/0007 uses both to credit ranked prospects.
    const ids = async (type) =>
      ((await getJson(`/teams/${ORG_ID}/roster?rosterType=${type}&season=${season}`)).roster ?? [])
        .map((e) => e.person?.id)
        .filter(Boolean)
    return {
      season: String(season),
      noSeason: NO_MILB_SEASONS[season],
      affiliates: [],
      rosters: {},
      milwaukee: await ids('fullSeason'),
      invitees: await ids('nonRosterInvitees'),
    }
  }
  const teams = await getJson(`/teams?sportIds=${MILB_SPORT_IDS.join(',')}&season=${season}`)
  const affiliates = (teams.teams ?? []).filter((t) => t.parentOrgId === ORG_ID).map(slimAffiliate)
  const rosters = {}
  for (const a of affiliates) {
    const hydrate = `person(stats(type=season,group=[hitting,pitching],sportId=${a.sportId},season=${season}))`
    const r = await getJson(`/teams/${a.id}/roster?rosterType=fullSeason&season=${season}&hydrate=${hydrate}`)
    rosters[a.id] = (r.roster ?? []).map((e) => slimArchiveEntry(e, a.id, a.sportId)).filter((e) => e.id)
  }
  // The teams list can name a club that fielded no roster that year (the
  // DSL clubs before 2010, checked live). Those are dropped, not shown empty.
  const fielded = affiliates.filter((a) => rosters[a.id].length > 0)
  const players = new Set(fielded.flatMap((a) => rosters[a.id].map((e) => e.id))).size
  if (fielded.length < 4 || players < 100) {
    throw new Error(`${season}: ${fielded.length} clubs with rosters, ${players} players. Expected 4+ and 100+.`)
  }
  if (fielded.length * 2 < affiliates.length) {
    throw new Error(`${season}: only ${fielded.length} of ${affiliates.length} clubs have a roster.`)
  }
  const mke = await getJson(`/teams/${ORG_ID}/roster?rosterType=fullSeason&season=${season}`)
  return {
    season: String(season),
    generatedAt: new Date().toISOString(),
    affiliates: fielded,
    rosters: Object.fromEntries(fielded.map((a) => [a.id, rosters[a.id]])),
    milwaukee: (mke.roster ?? []).map((e) => e.person?.id).filter(Boolean),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const refetch = args.includes('--refetch')
  const only = args.includes('--season') ? Number(args[args.indexOf('--season') + 1]) : null
  const org = JSON.parse(await readFile(new URL('../../src/data/org.json', import.meta.url), 'utf8'))
  const last = Number(org.season) - 1
  await mkdir(DIR, { recursive: true })

  const seasons = []
  for (let s = ARCHIVE_FIRST_SEASON; s <= last; s++) seasons.push(s)
  const archive = []
  for (const s of seasons) {
    const file = new URL(`${s}.json`, DIR)
    if ((only === null || only === s) && (refetch || only === s || !(await exists(file)))) {
      const data = await buildSeason(s)
      await writeJson(`${s}.json`, data)
      console.log(`gen-archive: ${s} written (${data.affiliates.length} clubs).`)
      archive.push(data)
    } else {
      archive.push(JSON.parse(await readFile(file, 'utf8')))
    }
  }

  // Bios for every archive player, fetched only for ids not already on disk.
  const peopleFile = new URL('people.json', DIR)
  const people = !refetch && (await exists(peopleFile)) ? JSON.parse(await readFile(peopleFile, 'utf8')) : {}
  const ids = [...new Set(archive.flatMap((a) => Object.values(a.rosters).flat().map((e) => e.id)))]
  const missing = ids.filter((id) => !people[id])
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH)
    const r = await getJson(`/people?personIds=${chunk.join(',')}&hydrate=draft`)
    for (const p of r.people ?? []) people[p.id] = slimBio(p)
  }
  const stillMissing = ids.filter((id) => !people[id]).length
  if (stillMissing > ids.length * 0.02) {
    throw new Error(`${stillMissing} of ${ids.length} archive players came back with no person record.`)
  }
  await writeJson('people.json', people)
  console.log(`gen-archive: ${archive.length} seasons, ${ids.length} players, ${missing.length} new bios.`)
}

main().catch((err) => {
  console.error('gen-archive failed:', err.message)
  process.exit(1)
})
