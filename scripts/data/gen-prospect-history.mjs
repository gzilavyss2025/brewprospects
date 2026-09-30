#!/usr/bin/env node
// gen-prospect-history: which Brewers were on each preseason Top 100 list,
// written to src/data/prospect-history.json.
//
// Source rows are copied from bbsbh's .scratch/top-prospects-history/ into
// data/sources/top-prospects-history/ (see its PROVENANCE.md): MLB Pipeline
// 2009-2024 and Baseball America 2005-2008. The rows name the player by MLB id
// only, with no team, so a ranked player counts as a Brewer for a season when
// the archive shows him in the Brewers system that season (docs/adr/0007,
// src/lib/model/archive.js brewersRanked). Runs offline except for names the
// archive does not know (2020 invitees), fetched from the Stats API.
//
// Usage: node scripts/data/gen-prospect-history.mjs
import { readFile, writeFile, rename } from 'node:fs/promises'
import { ARCHIVE_FIRST_SEASON, NO_MILB_SEASONS } from '../../src/config/site.js'
import { brewersRanked, brewersClubIds, otherClubs } from '../../src/lib/model/archive.js'
import { readSeason } from './lib/season-file.mjs'

const SRC = new URL('../../data/sources/top-prospects-history/', import.meta.url)
const ARCHIVE = new URL('../../src/data/archive/', import.meta.url)
const OUT = new URL('../../src/data/prospect-history.json', import.meta.url)
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'))

const SOURCE_LABEL = { 'mlb-pipeline': 'MLB Pipeline', 'baseball-america': 'Baseball America' }

async function main() {
  const rows = await readJson(new URL('rows.json', SRC))
  const meta = await readJson(new URL('seasons.json', SRC))
  const nonDebuts = await readJson(new URL('ba-non-debuts.json', SRC))
  const people = await readJson(new URL('people.json', ARCHIVE))
  const org = await readJson(new URL('../../src/data/org.json', import.meta.url))
  const lastArchive = Number(org.season) - 1
  const lastList = Math.max(...rows.map((r) => r.season))

  const seasons = []
  for (let s = ARCHIVE_FIRST_SEASON; s <= lastArchive; s++) {
    const m = meta.find((x) => x.season === s)
    if (!m || m.status !== 'ok') {
      seasons.push({ season: s, missing: `No Top 100 list on record for ${s} yet.` })
      continue
    }
    const seasonData = await readSeason(new URL(`${s}.json`, ARCHIVE))
    const list = rows.filter((r) => r.season === s)
    const source = list[0]?.source ?? m.source ?? 'mlb-pipeline'
    seasons.push({
      season: s,
      source,
      sourceLabel: SOURCE_LABEL[source] ?? source,
      depth: m.depth,
      incomplete: NO_MILB_SEASONS[s]
        ? 'No farm rosters exist for this season. Only prospects on the Milwaukee roster or invited to big-league camp can be matched.'
        : null,
      prospects: brewersRanked(list, seasonData),
      // Baseball America ranked some players who never reached the majors;
      // they have no MLB id, so the only team on record is BA's own label.
      unlinked: nonDebuts
        .filter((n) => n.season === s && n.team === 'Brewers')
        .map((n) => ({ rank: n.rank, name: n.playerName })),
    })
  }

  // Names: the archive's bios first, the Stats API for the rest.
  const need = [...new Set(seasons.flatMap((s) => s.prospects ?? []).map((p) => p.playerId))].filter((id) => !people[id])
  const names = {}
  if (need.length) {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${need.join(',')}`)
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${need.length} names`)
    for (const p of (await res.json()).people ?? []) names[p.id] = { name: p.fullName, pos: p.primaryPosition?.abbreviation ?? '' }
  }
  for (const s of seasons) {
    for (const p of s.prospects ?? []) {
      const who = people[p.playerId] ?? names[p.playerId]
      if (!who?.name) throw new Error(`${s.season} #${p.rank}: no name for player ${p.playerId}.`)
      p.name = who.name
      p.pos = who.pos ?? ''
    }
  }

  // Other clubs each ranked Brewer played for THAT season (a trade either
  // way). Read from his year-by-year splits, MiLB and MLB; a split whose team
  // is not a Brewers club that season is another organization's.
  const ranked = [...new Set(seasons.flatMap((s) => s.prospects ?? []).map((p) => p.playerId))]
  const splits = new Map(ranked.map((id) => [id, []]))
  for (const query of ['leagueListId=milb_all', 'sportId=1']) {
    for (let i = 0; i < ranked.length; i += 40) {
      const chunk = ranked.slice(i, i + 40)
      const hydrate = `stats(group=[hitting,pitching],type=[yearByYear],${query})`
      const res = await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${chunk.join(',')}&hydrate=${hydrate}`)
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching year-by-year splits`)
      for (const p of (await res.json()).people ?? []) {
        for (const st of p.stats ?? []) splits.get(p.id)?.push(...(st.splits ?? []))
      }
    }
  }
  for (const s of seasons) {
    if (!s.prospects?.length) continue
    const seasonData = await readSeason(new URL(`${s.season}.json`, ARCHIVE))
    const ours = brewersClubIds(seasonData)
    for (const p of s.prospects) p.otherClubs = otherClubs(splits.get(p.playerId), s.season, ours)
  }

  const total = seasons.reduce((n, s) => n + (s.prospects?.length ?? 0), 0)
  if (total < 40) throw new Error(`Only ${total} ranked Brewers across all seasons; expected far more.`)

  const out = { generatedAt: new Date().toISOString(), lastList, seasons }
  const tmp = new URL('prospect-history.json.tmp', new URL('.', OUT))
  await writeFile(tmp, JSON.stringify(out, null, 1) + '\n')
  await rename(tmp, OUT)
  console.log(`gen-prospect-history: ${total} ranked Brewers across ${seasons.length} seasons (lists through ${lastList}).`)
}

main().catch((err) => {
  console.error('gen-prospect-history failed:', err.message)
  process.exit(1)
})
