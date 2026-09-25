#!/usr/bin/env node
// Structural guards, run by `npm run lint` and in CI. Each check returns a
// list of problems; any problem fails the run. Caps are enforced, not
// suggested (Tally ADR-0038): when a check fails, split the file or folder,
// do not raise the cap.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { contrastRatio } from '../../src/lib/color.js'

const ROOT = new URL('../../', import.meta.url).pathname
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
    .map(([f, n]) => `${relative(ROOT, f)} has ${n} lines (cap ${CAP}). Move detail to docs/.`)
}

// A code folder past 10 files needs a subfolder. Content folders are exempt:
// posts are meant to pile up.
function checkDirSize(files) {
  const CAP = 10
  const counts = new Map()
  for (const f of files) {
    const rel = relative(ROOT, f)
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
    .map(([f, n]) => `${relative(ROOT, f)} has ${n} lines (cap ${CAP}). Split it.`)
}

// Every token pair named on the PAIRS line of tokens.css must pass WCAG AA.
function checkContrast() {
  const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8')
  const vars = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]))
  const pairs = (/PAIRS:([^*]*)\*\//.exec(css)?.[1] ?? '').trim().split(/\s+/).filter(Boolean)
  if (!pairs.length) return ['tokens.css has no PAIRS line to check.']
  return pairs.flatMap((pair) => {
    const [fg, bg] = pair.split('/')
    const ratio = contrastRatio(vars[fg], vars[bg])
    if (ratio === null) return [`Contrast pair ${pair}: unknown token.`]
    return ratio < 4.5 ? [`Contrast pair ${pair} is ${ratio.toFixed(2)}:1 (needs 4.5:1).`] : []
  })
}

// Pages and components use tokens, not raw colors. Only the token file, the
// color data module and the Keystatic config may hold a hex value.
function checkRawHex(files) {
  const ALLOWED = ['src/styles/tokens.css', 'src/lib/affiliates.js', 'src/lib/color.js']
  return files
    .filter((f) => /\.(astro|css|jsx)$/.test(f))
    .filter((f) => !ALLOWED.includes(relative(ROOT, f)))
    .filter((f) => /#[0-9a-f]{6}\b/i.test(readFileSync(f, 'utf8')))
    .map((f) => `${relative(ROOT, f)} has a raw hex color. Use a token from tokens.css.`)
}

const files = walk(ROOT)
const problems = [
  ...checkClaudeMd(files),
  ...checkDirSize(files),
  ...checkFileSize(files),
  ...checkContrast(),
  ...checkRawHex(files),
]
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log('checks: all passed')
