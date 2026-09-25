// keystatic.config.jsx and src/content.config.js must match field for field
// (CLAUDE.md). Neither loads in plain Node: one is JSX, the other imports
// astro:content. esbuild bundles each with small stubs, and the checks
// compare what they declare.
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './paths.mjs'

const CACHE = join(ROOT, 'node_modules', '.cache', 'content-config')

// Stubs for the Astro virtual modules: a collection is its options object.
const astroStubs = {
  name: 'astro-stubs',
  setup(b) {
    b.onResolve({ filter: /^astro:content$|^astro\/loaders$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'export const defineCollection = (c) => c; export const glob = (o) => o',
      loader: 'js',
    }))
  },
}

async function load(entry) {
  const out = await build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    packages: 'external',
    define: { 'import.meta.env': '{}' },
    plugins: [astroStubs],
    logLevel: 'silent',
  })
  // Written under node_modules so the bundle's package imports resolve.
  const file = join(CACHE, `${basename(entry)}.mjs`)
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(file, out.outputFiles[0].text)
  return import(pathToFileURL(file).href)
}

export async function loadContentConfigs() {
  const keystatic = (await load('keystatic.config.jsx')).default.collections
  const astro = (await load('src/content.config.js')).collections
  return { keystatic, astro }
}

// The field that holds the body is the file's content, not frontmatter.
const CONTENT_FIELDS = new Set(['body', 'note'])

// `keystatic` maps a collection to its Keystatic schema; `astro` maps it to
// a zod object's shape. Returns one line per mismatch.
export function schemaProblems(keystatic, astro) {
  const problems = []
  for (const key of new Set([...Object.keys(keystatic), ...Object.keys(astro)])) {
    if (!keystatic[key] || !astro[key]) {
      problems.push(`Collection "${key}" is only in ${keystatic[key] ? 'keystatic.config.jsx' : 'src/content.config.js'}.`)
      continue
    }
    const ks = new Set(Object.keys(keystatic[key]).filter((f) => !CONTENT_FIELDS.has(f)))
    const as = new Set(Object.keys(astro[key]))
    for (const f of ks) if (!as.has(f)) problems.push(`${key}.${f} is in Keystatic but not in src/content.config.js.`)
    for (const f of as) if (!ks.has(f)) problems.push(`${key}.${f} is in src/content.config.js but not in Keystatic.`)
  }
  return problems
}

// The guide club list must be exactly the current affiliates, each labeled
// with its own name. It once listed six clubs, left out DSL Brewers Blue
// (607) and called 2101 "DSL Brewers".
export function clubListProblems(options, affiliates) {
  const problems = []
  for (const a of affiliates) {
    const o = options.find((x) => Number(x.value) === a.id)
    if (!o) problems.push(`Guide club list is missing ${a.name} (${a.id}).`)
    else if (!o.label.startsWith(a.name)) problems.push(`Guide club ${a.id} is labeled "${o.label}"; it is ${a.name}.`)
  }
  for (const o of options) {
    if (!affiliates.some((a) => a.id === Number(o.value))) problems.push(`Guide club list has ${o.label} (${o.value}), not a current affiliate.`)
  }
  return problems
}
