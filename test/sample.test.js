// The minimum sample (#58): one copy of the numbers, in
// src/lib/model/player/sample.js. #39, #42, #50 and #52 import it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { MIN_PA, MIN_IP } from '../src/lib/model/player/sample.js'

test('the minimum is 100 plate appearances and 30 innings', () => {
  assert.equal(MIN_PA, 100)
  assert.equal(MIN_IP, 30)
})

const SOURCE = /\.(js|mjs|jsx|astro)$/
const sample = join('src', 'lib', 'model', 'player', 'sample.js')

function sourceFiles() {
  return readdirSync('src', { recursive: true })
    .map((f) => join('src', f))
    .filter((f) => SOURCE.test(f) && relative('.', f) !== sample)
}

// A second declaration of either name, or a stat count compared to one of the
// three numbers a copy would use (100 PA, 30 IP, 90 outs), either way round.
export const COPIES = [
  { what: 'a declaration', re: /\b(?:const|let|var)\s+(?:MIN_PA|MIN_IP)\b|\b(?:MIN_PA|MIN_IP)\s*[:=]\s*\d/ },
  { what: 'a comparison', re: /\b(?:pa|outs)\s*(?:[<>]=?|[!=]==?)\s*(?:100|90|30)\b/ },
  { what: 'a comparison', re: /\b(?:100|90|30)\s*(?:[<>]=?|[!=]==?)\s*[\w.?]*\b(?:pa|outs)\b/ },
]

test('no file in src/ but sample.js holds a copy of the minimum', () => {
  const found = []
  for (const file of sourceFiles()) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const { what, re } of COPIES) {
        if (re.test(line)) found.push(`${file}:${i + 1} has ${what} of the minimum: ${line.trim()}`)
      }
    })
  }
  assert.deepEqual(found, [], 'import MIN_PA and MIN_IP from src/lib/model/player/sample.js')
})

test('the copy patterns catch what they should and pass what they should', () => {
  const hit = (s) => COPIES.some(({ re }) => re.test(s))
  for (const bad of [
    'const MIN_PA = 100', 'export const MIN_IP = 30', 'let MIN_PA = 50', 'MIN_PA: 100,',
    'if (line.pa >= 100)', 'r.pa < 100', 'row.outs >= 90', 'r.outs>=30', '100 <= r.pa', '90 < line.outs',
  ]) assert.ok(hit(bad), `should flag: ${bad}`)
  for (const ok of [
    'import { MIN_PA, MIN_IP } from "./sample.js"', 'line.pa >= MIN_PA', 'line.outs >= MIN_IP * 3',
    'const pace = 100', 'r.outs >= 1', 'gs === 30', 'const total = pa + 100',
  ]) assert.ok(!hit(ok), `should pass: ${ok}`)
})
