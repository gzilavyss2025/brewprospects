#!/usr/bin/env node
// Exit 0 when any snapshot's DATA changed against HEAD, 1 when only
// `generatedAt` (or nothing) changed. Line-based diff filters cannot do this:
// org.json is a single line, so ignoring the generatedAt line ignores it all.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

// Every snapshot the nightly job can write, including each archive season: a
// new season file is how a finished season joins the archive.
const FILES = [
  'src/data/org.json',
  'src/data/pipeline.json',
  'src/data/prospect-history.json',
  ...(existsSync('src/data/archive') ? readdirSync('src/data/archive') : [])
    .filter((f) => f.endsWith('.json'))
    .map((f) => `src/data/archive/${f}`),
]
const strip = (text) => {
  const { generatedAt: _generatedAt, ...rest } = JSON.parse(text)
  return JSON.stringify(rest)
}

const changed = FILES.filter((f) => {
  let before
  try {
    before = execFileSync('git', ['show', `HEAD:${f}`], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return true // new file
  }
  return strip(before) !== strip(readFileSync(f, 'utf8'))
})
console.log(changed.length ? `Changed: ${changed.join(', ')}` : 'No data change.')
process.exit(changed.length ? 0 : 1)
