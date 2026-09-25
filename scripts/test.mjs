#!/usr/bin/env node
// `npm test`. Collects test/**/*.test.js itself and fails when it finds none.
// A shell or Node version that does not expand the glob would otherwise run
// zero tests and pass (Tally d0a4924d6).
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const files = readdirSync('test', { recursive: true })
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => join('test', f))

if (!files.length) {
  console.error('npm test found no test files under test/. Refusing to pass.')
  process.exit(1)
}
const run = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
process.exit(run.status ?? 1)
