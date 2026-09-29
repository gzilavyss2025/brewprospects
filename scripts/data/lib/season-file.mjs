// Archive season files on disk, for the scripts (docs/adr/0006). A file is
// packed (src/lib/snapshot/season.js), so it has no `rosters` key until it
// is unpacked. Every script that reads or writes a season file goes through
// here: a raw read sees no rosters, and brewersRanked then matches 0 ranked
// prospects with no error (the #62 prep notes, trap 1).
import { readFile, readdir } from 'node:fs/promises'
import { packSeason, unpackSeason } from '../../../src/lib/snapshot/season.js'
import { stringifyByLine } from './by-line.mjs'

const SEASON_FILE = /^\d{4}\.json$/

// One season, unpacked: { season, affiliates, rosters, milwaukee, standings }.
export async function readSeason(url) {
  return unpackSeason(JSON.parse(await readFile(url, 'utf8')))
}

// Every season file in `dir`, unpacked, oldest first.
export async function readSeasons(dir) {
  const files = (await readdir(dir)).filter((f) => SEASON_FILE.test(f)).sort()
  return Promise.all(files.map((f) => readSeason(new URL(f, dir))))
}

// The text to write for one season. packSeason throws on a line that names
// another club or a field with no column, before anything is written.
export function seasonText(data) {
  return stringifyByLine(packSeason(data))
}
