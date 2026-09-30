// ADR-0015: a snapshot in src/data/ is packed and stores counts only. Every
// JSON file there must pass, or be listed in EXEMPT with the reason it may
// not. A new file (a game log, splits, a Pipeline log) starts packed; adding
// it to EXEMPT is a change a reviewer sees.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { relPath } from './paths.mjs'

// Stats a page computes from counts (src/lib/model/player/rates.js). No
// packed file may store one, as a column or as a key.
export const DERIVED = new Set([
  'avg', 'obp', 'slg', 'ops', 'iso', 'babip', 'kPct', 'bbPct',
  'ip', 'era', 'whip', 'k9', 'bb9', 'h9', 'hr9', 'fip',
])

// Files that do not follow ADR-0015 yet, each with its reason. Remove a line
// when its file is packed; a line for a file that is gone fails.
export const EXEMPT = {
  'src/data/archive/people.json': 'Bios, not stat rows.',
  'src/data/pipeline.json': 'A ranked list, not stat rows.',
  'src/data/prospect-history.json': 'A ranked list, not stat rows.',
}

// Every key anywhere in a JSON value, except inside `columns`, whose values
// are names and are checked on their own.
function keysIn(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => keysIn(v, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      if (k !== 'columns') keysIn(v, out)
    }
  }
  return out
}

// Every array under a key named for a column group, anywhere in the file.
function tablesIn(value, groups, out = []) {
  if (Array.isArray(value)) value.forEach((v) => tablesIn(v, groups, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'columns') continue
      if (groups.includes(k) && Array.isArray(v)) out.push([k, v])
      else tablesIn(v, groups, out)
    }
  }
  return out
}

// Problems with one parsed file, named `rel`. Pure, for the tests.
export function packedProblems(rel, file) {
  const { columns } = file ?? {}
  if (!columns || typeof columns !== 'object' || Array.isArray(columns)) {
    return [`${rel} has no "columns" table. Pack it (ADR-0015) or add it to EXEMPT with a reason.`]
  }
  const problems = []
  const groups = Object.keys(columns)
  for (const [group, names] of Object.entries(columns)) {
    if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) {
      problems.push(`${rel}: columns.${group} must be a list of names.`)
      continue
    }
    if (new Set(names).size !== names.length) problems.push(`${rel}: columns.${group} names a column twice.`)
    for (const n of names.filter((n) => DERIVED.has(n))) {
      problems.push(`${rel}: columns.${group} stores "${n}", a rate. Store its counts; compute it in rates.js.`)
    }
    if (names.includes('club') && !(Array.isArray(file.clubs) && Array.isArray(file.clubColumns))) {
      problems.push(`${rel}: columns.${group} has "club" but the file has no clubs and clubColumns.`)
    }
  }
  for (const k of [...keysIn(file)].filter((k) => DERIVED.has(k))) {
    problems.push(`${rel} has a "${k}" key, a rate. Store its counts; compute it in rates.js.`)
  }
  // One line per group and fault, however many tables hold the rows.
  const count = new Map()
  const add = (key) => count.set(key, (count.get(key) ?? 0) + 1)
  for (const [group, rows] of tablesIn(file, groups)) {
    const width = columns[group]?.length
    const clubAt = columns[group]?.indexOf('club') ?? -1
    for (const r of rows) {
      if (!Array.isArray(r) || r.length !== width) add(`${group} row(s) are not arrays of ${width} values.`)
      else if (clubAt >= 0 && !(Number.isInteger(r[clubAt]) && r[clubAt] < (file.clubs?.length ?? 0))) {
        add(`${group} row(s) point at a club not in the table.`)
      }
    }
  }
  for (const [fault, n] of count) problems.push(`${rel}: ${n} ${fault}`)
  return problems
}

function jsonFiles(dir, root, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) jsonFiles(p, root, out)
    else if (name.endsWith('.json')) out.push(relPath(root, p))
  }
  return out
}

export function snapshotProblems(root) {
  const files = jsonFiles(join(root, 'src/data'), root)
  const problems = []
  for (const rel of files) {
    if (EXEMPT[rel]) continue
    let file
    try {
      file = JSON.parse(readFileSync(join(root, rel), 'utf8'))
    } catch (err) {
      problems.push(`${rel} is not valid JSON (${err.message}).`)
      continue
    }
    problems.push(...packedProblems(rel, file))
  }
  for (const key of Object.keys(EXEMPT)) {
    if (!existsSync(join(root, key))) problems.push(`EXEMPT in scripts/checks/snapshots.mjs names ${key}, which is gone. Remove the line.`)
  }
  return problems
}
