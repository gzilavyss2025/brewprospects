#!/usr/bin/env node
// Exit 0 when any snapshot's DATA changed against HEAD, 1 when only
// `generatedAt` (or nothing) changed. Line-based diff filters cannot do this:
// org.json is a single line, so ignoring the generatedAt line ignores it all.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const FILES = ['src/data/org.json', 'src/data/pipeline.json']
const strip = (text) => {
  const { generatedAt: _generatedAt, ...rest } = JSON.parse(text)
  return JSON.stringify(rest)
}

const changed = FILES.filter((f) => {
  let before
  try {
    before = execFileSync('git', ['show', `HEAD:${f}`], { encoding: 'utf8', maxBuffer: 64 << 20 })
  } catch {
    return true // new file
  }
  return strip(before) !== strip(readFileSync(f, 'utf8'))
})
console.log(changed.length ? `Changed: ${changed.join(', ')}` : 'No data change.')
process.exit(changed.length ? 0 : 1)
