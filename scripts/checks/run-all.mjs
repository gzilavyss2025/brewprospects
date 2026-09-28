#!/usr/bin/env node
// Structural guards, run by `npm run lint` and in CI. Each check returns a
// list of problems; any problem fails the run. Caps are enforced, not
// suggested (Tally ADR-0038): when a check fails, split the file or folder,
// do not raise the cap.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { checkContrastLines } from './contrast.mjs'
import { adrNumberProblems, wordProblems } from './docs.mjs'
import { loadContentConfigs, schemaProblems, clubListProblems } from './content-config.mjs'
import { ROOT, relPath } from './paths.mjs'
import { rawValueProblems } from './raw-values.mjs'
import { classShapeProblems } from './class-shape.mjs'
import { accentProblems } from '../../src/lib/identity/affiliates.js'

const SKIP = new Set(['node_modules', '.git', 'dist', '.astro', '.vercel', 'fixtures', 'data'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// CLAUDE.md files load into agent sessions; their size is a fixed cost.
function checkClaudeMd(files) {
  const CAP = 150
  return files
    .filter((f) => f.endsWith('CLAUDE.md'))
    .map((f) => [f, readFileSync(f, 'utf8').split('\n').length])
    .filter(([, n]) => n > CAP)
    .map(([f, n]) => `${relPath(ROOT, f)} has ${n} lines (cap ${CAP}). Move detail to docs/.`)
}

// A code folder past 10 files needs a subfolder. Content folders are exempt:
// posts are meant to pile up.
function checkDirSize(files) {
  const CAP = 10
  const counts = new Map()
  for (const f of files) {
    const rel = relPath(ROOT, f)
    if (!rel.startsWith('src/') && !rel.startsWith('scripts/')) continue
    if (rel.startsWith('src/content/')) continue
    const dir = rel.slice(0, rel.lastIndexOf('/'))
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }
  return [...counts]
    .filter(([, n]) => n > CAP)
    .map(([d, n]) => `${d}/ has ${n} files (cap ${CAP}). Split it into subfolders.`)
}

function checkFileSize(files) {
  const CAP = 300
  return files
    .filter((f) => /\.(js|jsx|mjs|astro|css)$/.test(f))
    .map((f) => [f, readFileSync(f, 'utf8').split('\n').length])
    .filter(([, n]) => n > CAP)
    .map(([f, n]) => `${relPath(ROOT, f)} has ${n} lines (cap ${CAP}). Split it.`)
}

// The PAIRS and FOCUS lines of tokens.css must pass WCAG in both themes
// (see contrast.mjs).
function checkContrast() {
  return checkContrastLines(readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8'))
}

// Pages and components use tokens, not raw colors. Only the token file and
// the two color modules may hold a hex value.
function checkRawHex(files) {
  const ALLOWED = ['src/styles/tokens.css', 'src/lib/identity/affiliates.js', 'src/lib/identity/color.js']
  return files
    .filter((f) => /\.(astro|css|jsx)$/.test(f))
    .filter((f) => !ALLOWED.includes(relPath(ROOT, f)))
    .filter((f) => /#[0-9a-f]{6}\b/i.test(readFileSync(f, 'utf8')))
    .map((f) => `${relPath(ROOT, f)} has a raw hex color. Use a token from tokens.css.`)
}

// Every text file uses LF. One CRLF file on Windows can turn a two-line edit
// into a whole-file conflict (Tally 7646ae1eb). .gitattributes sets eol=lf;
// this catches a file written before git normalizes it.
function checkLineEndings(files) {
  return files
    .filter((f) => /\.(js|jsx|mjs|astro|css|json|md|mdoc|yml|yaml|txt)$/.test(f))
    .filter((f) => readFileSync(f, 'utf8').includes('\r\n'))
    .map((f) => `${relPath(ROOT, f)} has CRLF line endings. Save it with LF.`)
}

// Keystatic and Astro declare the same fields, and the guide club list is
// the current affiliates. This is lint, not a unit test, so a change in the
// affiliates never blocks the nightly data job.
async function checkContentConfig() {
  const { keystatic, astro } = await loadContentConfigs()
  const shape = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.schema.shape]))
  const schemas = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.schema]))
  const org = JSON.parse(readFileSync(join(ROOT, 'src/data/org.json'), 'utf8'))
  return [
    ...schemaProblems(schemas(keystatic), shape(astro)),
    ...clubListProblems(keystatic.guides.schema.affiliateId.options, org.affiliates),
  ]
}

function checkAdrNumbers() {
  return adrNumberProblems(readdirSync(join(ROOT, 'docs/adr')))
}

// Our own words: code, styles, docs and posts. JSON data is left out, because
// it carries other people's values (a real award may say the other word).
function checkWords(files) {
  const own = files.filter((f) => /\.(js|jsx|mjs|astro|css|md|mdoc)$/.test(f))
  // Guard the guard: if the walk finds almost nothing, the scope moved.
  if (own.length < 50) return [`Word check found only ${own.length} files. Fix its scope; do not delete this line.`]
  return own
    .filter((f) => !relPath(ROOT, f).startsWith('scripts/checks/docs.mjs'))
    .flatMap((f) => wordProblems(relPath(ROOT, f), readFileSync(f, 'utf8')))
}

const files = walk(ROOT)
const problems = [
  ...checkClaudeMd(files),
  ...checkDirSize(files),
  ...checkFileSize(files),
  ...checkContrast(),
  // Every affiliate accent reaches 4.5:1 with its ink. A failure fails lint;
  // the page meanwhile paints Brewers navy (ADR-0012).
  ...accentProblems(),
  ...checkRawHex(files),
  ...files.flatMap((f) => rawValueProblems(relPath(ROOT, f), readFileSync(f, 'utf8'))),
  // ADR-0010: a class is named for its job, never its shape.
  ...files.flatMap((f) => classShapeProblems(relPath(ROOT, f), readFileSync(f, 'utf8'))),
  ...checkLineEndings(files),
  ...checkAdrNumbers(),
  ...checkWords(files),
  ...(await checkContentConfig()),
]
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log('checks: all passed')
