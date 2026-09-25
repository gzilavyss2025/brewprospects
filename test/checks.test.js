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

test('schemaProblems names a field only one side declares', async () => {
  const { schemaProblems } = await import('../scripts/checks/content-config.mjs')
  const ks = { recaps: { title: 1, period: 1, body: 1 }, notes: { player: 1 } }
  const astro = { recaps: { title: 1 } }
  assert.deepEqual(schemaProblems(ks, astro), [
    'recaps.period is in Keystatic but not in src/content.config.js.',
    'Collection "notes" is only in keystatic.config.jsx.',
  ])
})

test('the real Keystatic and Astro content configs match', async () => {
  const { loadContentConfigs, schemaProblems } = await import('../scripts/checks/content-config.mjs')
  const { keystatic, astro } = await loadContentConfigs()
  const schemas = Object.fromEntries(Object.entries(keystatic).map(([k, v]) => [k, v.schema]))
  const shapes = Object.fromEntries(Object.entries(astro).map(([k, v]) => [k, v.schema.shape]))
  assert.deepEqual(schemaProblems(schemas, shapes), [])
})

test('clubListProblems catches the old six-club guide list', async () => {
  const { clubListProblems } = await import('../scripts/checks/content-config.mjs')
  const affiliates = [{ id: 2101, name: 'DSL Brewers Gold' }, { id: 607, name: 'DSL Brewers Blue' }]
  const options = [{ label: 'DSL Brewers (Dominican complex)', value: '2101' }]
  assert.deepEqual(clubListProblems(options, affiliates), [
    'Guide club 2101 is labeled "DSL Brewers (Dominican complex)"; it is DSL Brewers Gold.',
    'Guide club list is missing DSL Brewers Blue (607).',
  ])
})

test('two ADRs with one number are caught; gaps are fine', async () => {
  const { adrNumberProblems } = await import('../scripts/checks/docs.mjs')
  assert.deepEqual(adrNumberProblems(['0001-a.md', '0003-b.md']), [])
  assert.equal(adrNumberProblems(['0008-a.md', '0008-b.md', 'README.md']).length, 1)
})

test('the word list catches the other word, and an exempt line passes', async () => {
  const { wordProblems } = await import('../scripts/checks/docs.mjs')
  const other = ['play', 'offs'].join('')
  assert.deepEqual(wordProblems('a.md', `The ${other} start.`), [`a.md:1 says "${other}". Say "postseason".`])
  assert.deepEqual(wordProblems('a.md', `Best ${other} award <!-- word-choice-exempt: a real award -->`), [])
  assert.deepEqual(wordProblems('a.md', 'The postseason starts.'), [])
})
