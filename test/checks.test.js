import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix, win32 } from 'node:path'
import { ROOT, relPath } from '../scripts/checks/paths.mjs'
import { checkContrastLines } from '../scripts/checks/contrast.mjs'

test('ROOT is the repo folder on this platform', () => {
  // `new URL(...).pathname` gave '/C:/...' on Windows, and every check
  // read a path that did not exist.
  assert.ok(existsSync(join(ROOT, 'package.json')))
})

test('relPath gives forward slashes for a Windows path', () => {
  assert.equal(relPath('C:\\repo\\', 'C:\\repo\\src\\lib\\org.js', win32), 'src/lib/org.js')
})

test('relPath leaves a POSIX path as it is', () => {
  assert.equal(relPath('/repo/', '/repo/src/lib/org.js', posix), 'src/lib/org.js')
})

test('the focus ring passes 3:1 on every surface in tokens.css', () => {
  // The ring was gold: 1.47:1 on paper, and invisible on the gold header.
  const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8')
  assert.deepEqual(checkContrastLines(css), [])
})

test('a gold focus ring on paper fails the FOCUS line', () => {
  const css = '--gold: #ffc52f; --paper: #fbf6e9; /* PAIRS: gold/gold */ /* FOCUS: gold/paper */'
  assert.match(checkContrastLines(css).join('\n'), /FOCUS pair gold\/paper is 1\.\d\d:1/)
})
