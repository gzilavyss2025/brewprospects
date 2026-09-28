// ADR-0010: a class is named for its job, never its shape. A shape word may
// be carried only by the one class the ADR names as its owner; every other
// class that carries one is drift, the `.pcard`/`.rank-chip` kind this check
// exists to catch. Adapted from raw-values.mjs's comment masking and
// style-block scanning; scope matches rawValueProblems exactly.
//
// Blind spot, recorded in ADR-0010 ("What C3 does not cover"): a class name
// assembled by string interpolation or Object.assign is invisible here. This
// reads `className: 'x'`, a literal string, not `className: x + 'y'`.

// The shape-word table from ADR-0010's "Shape words" section. The value is
// the one class name allowed to carry the word (its owner); `null` means the
// word is reserved or dropped and no class may carry it yet.
export const SHAPE_WORDS = {
  card: 'card',
  pennant: 'pennant',
  pill: null,
  chip: null,
  notice: null,
  tag: null,
  btn: null,
  door: null,
  sheet: null,
}

const SCOPE = /^src\/(?:styles|components|layouts|pages)\/.*\.(?:css|astro|jsx|tsx|html)$/

const blank = (s) => s.replace(/[^\n]/g, ' ')
const maskComments = (s) => s.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, blank)

// A shape word matches a class name only as the whole name, a hyphen
// segment, or a suffix (ADR-0010's matching rule): `card` matches `.card`,
// `.club-card` and `.eventcard`, never `.cardinal` or `.pillar`.
function matchesShapeWord(name, word) {
  if (name === word) return true
  if (name.split('-').includes(word)) return true
  return name.length > word.length && name.endsWith(word)
}

// Selectors come only from .css files and <style> blocks, each kept with its
// offset in the masked source so problems report the right line.
function styleBlocks(path, source) {
  if (path.endsWith('.css')) return [{ text: source, offset: 0 }]
  const blocks = []
  for (const m of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push({ text: m[1], offset: m.index + m[0].indexOf('>') + 1 })
  }
  return blocks
}

// Class names named in a selector list: the text before each rule's `{`.
// `@media (...) {` has no leading dot, so it contributes nothing.
function selectorClasses(text) {
  const found = []
  const re = /([^{}]*)\{/g
  for (let m; (m = re.exec(text));) {
    for (const c of m[1].matchAll(/\.([A-Za-z_][\w-]*)/g)) found.push({ name: c[1], index: m.index })
  }
  return found
}

// class=, className= and className: (Headshot's onerror string) literal
// values, read from the whole masked source, frontmatter included — but
// frontmatter never carries one of these three patterns, so `p.data.title`
// is never mistaken for a class.
function attrClasses(source) {
  const found = []
  const re = /\b(?:class|className)\s*[:=]\s*(["'`])([^"'`]*)\1/g
  for (let m; (m = re.exec(source));) {
    for (const name of m[2].split(/\s+/)) if (name) found.push({ name, index: m.index })
  }
  return found
}

export function classShapeProblems(path, raw) {
  path = path.replaceAll('\\', '/')
  if (path === 'src/styles/tokens.css' || !SCOPE.test(path)) return []
  const source = maskComments(raw)
  const words = Object.keys(SHAPE_WORDS)
  const occurrences = [
    ...styleBlocks(path, source).flatMap(({ text, offset }) =>
      selectorClasses(text).map((c) => ({ ...c, index: c.index + offset }))),
    ...attrClasses(source),
  ]
  const problems = []
  for (const { name, index } of occurrences) {
    for (const word of words) {
      if (!matchesShapeWord(name, word)) continue
      const owner = SHAPE_WORDS[word]
      if (name === owner) continue
      const line = source.slice(0, index).split('\n').length
      const who = owner ? `only .${owner} may carry it` : 'no class may carry it yet'
      problems.push(`${path}:${line} class "${name}" carries the shape word "${word}" (${who}). See ADR-0010.`)
    }
  }
  return problems
}
