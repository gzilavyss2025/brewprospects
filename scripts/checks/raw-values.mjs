// Adapted from bbsbh/scripts/check-raw-values.mjs: comment masking,
// declaration scanning and numeric lengths. No budgets or exemptions.
// Unlike Tally, var() fallbacks are checked too: a raw fallback is still raw.
const blank = (s) => s.replace(/[^\n]/g, ' ')
const maskComments = (s) => s.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, blank)
const PROPERTY = /^(?:(?:padding|margin)(?:-(?:top|right|bottom|left|block|inline)(?:-start|-end)?)?|(?:row-|column-)?gap|border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius)$/
const PX = /(?<![\w.#-])[+-]?(?:\d*\.\d+|\d+)px\b/gi

// Walk strings and balanced expressions so commas in calc()/var() and
// braces in inline template strings do not cut a declaration short.
function endOf(source, start, stops) {
  const stack = []
  let quote = null
  for (let i = start; i < source.length; i++) {
    const c = source[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (!stack.length && stops.includes(c) && !(c === '{' && source[i - 1] === '$')) return i
    if ('"\'`'.includes(c)) quote = c
    else if ('({['.includes(c)) stack.push(c)
    else if (')}]'.includes(c)) stack.pop()
  }
  return source.length
}

function styleSources(path, source) {
  if (path.endsWith('.css')) return [{ text: source, offset: 0 }]
  const snippets = []
  for (const m of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    snippets.push({ text: m[1], offset: m.index + m[0].indexOf('>') + 1 })
  }
  const attrs = /\bstyle\s*=\s*/gi
  while (attrs.exec(source)) {
    const start = attrs.lastIndex
    const first = source[start]
    let end
    if ('"\'`'.includes(first)) {
      end = start + 1
      while (end < source.length && source[end] !== first) {
        if (source[end] === '\\') end++
        end++
      }
    } else if (first === '{') end = endOf(source, start + 1, '}')
    else continue
    snippets.push({ text: source.slice(start + 1, end), offset: start + 1 })
    attrs.lastIndex = end + 1
  }
  return snippets
}

export function rawValueProblems(path, raw) {
  path = path.replaceAll('\\', '/')
  if (path === 'src/styles/tokens.css' ||
      !/^src\/(?:styles|components|layouts|pages)\/.*\.(?:css|astro|jsx|tsx|html)$/.test(path)) return []
  const source = maskComments(raw)
  const problems = []
  for (const { text, offset } of styleSources(path, source)) {
    const props = /(?<![\w.#:-])["']?([a-z][a-zA-Z-]*)["']?\s*:\s*/gi
    for (let m; (m = props.exec(text));) {
      const prop = m[1] === m[1].toUpperCase() ? m[1].toLowerCase()
        : m[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      if (!PROPERTY.test(prop)) continue
      const end = endOf(text, props.lastIndex, ';},{')
      if (text[end] === '{') continue // selector, not a declaration
      const value = text.slice(props.lastIndex, end)
      const values = [...value.matchAll(PX)].map((v) => v[0])
        .filter((v) => ![0, 1, 2].includes(Number(v.slice(0, -2))))
      if (values.length) {
        const line = source.slice(0, offset + m.index).split('\n').length
        problems.push(`${path}:${line} ${prop} has raw px (${values.join(', ')}). Use a token from tokens.css.`)
      }
      props.lastIndex = end
    }
  }
  return problems
}
