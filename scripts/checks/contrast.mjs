// Contrast lines in tokens.css. PAIRS lists text on a background and needs
// WCAG AA text contrast (4.5:1). FOCUS lists the focus ring on each surface
// it can sit on and needs non-text contrast (3:1, WCAG 1.4.11). A pair is
// `fg/bg`; `a|b/bg` passes when either ring color reaches the bar, because
// the ring is two-tone (ring plus halo).
//
// Every line is checked in every theme. Each theme block is read into its own
// map, so a dark value never stands in for a light one. A token defined as
// var(--other) resolves inside its own theme. A token that does not resolve
// to a six-digit hex fails; it is never skipped (ADR-0012).
import { contrastRatio } from '../../src/lib/color.js'

export const LINES = [
  { label: 'PAIRS', min: 4.5 },
  { label: 'FOCUS', min: 3 },
]

export const THEMES = [
  { name: 'light', selector: ':root' },
  { name: 'dark', selector: '[data-theme="dark"]' },
]

// Color roles (ADR-0012). Each one is defined in every theme.
const ROLE = /^(?:surface|text|line|focus|brand|club)-/
// Brewers and club colors are identity, not theme: the same hex everywhere.
const FIXED = /^(?:brand|club)-/
const HEX = /^#[0-9a-f]{6}$/i

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const normalize = (selector) => selector.replace(/\s+/g, '').replaceAll("'", '"')

// { light: { 'text-ink': '#12284b', ... }, dark: {...} }. A theme with no block
// is left out, and the caller reports it.
export function readThemes(css) {
  const themes = {}
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const theme = THEMES.find((t) => normalize(t.selector) === normalize(m[1]))
    if (!theme) continue
    const vars = (themes[theme.name] ??= {})
    for (const d of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)) vars[d[1]] = d[2].trim()
  }
  return themes
}

// The hex a token ends at in one theme, following var(--x) links, or null.
export function resolveToken(vars, name, seen = new Set()) {
  const value = vars[name]
  if (value === undefined || seen.has(name)) return null
  if (HEX.test(value)) return value
  const ref = /^var\(\s*--([\w-]+)\s*\)$/.exec(value)
  return ref ? resolveToken(vars, ref[1], seen.add(name)) : null
}

function roleProblems(themes) {
  const roles = [...new Set(Object.values(themes).flatMap((v) => Object.keys(v)))].filter((n) => ROLE.test(n)).sort()
  const problems = []
  for (const role of roles) {
    const hexes = THEMES.map(({ name, selector }) => {
      const hex = resolveToken(themes[name], role)
      if (!hex) problems.push(`Color role --${role} does not resolve to a hex color in ${selector} (${name}).`)
      return hex?.toLowerCase()
    })
    if (FIXED.test(role) && hexes.every(Boolean) && new Set(hexes).size > 1) {
      problems.push(`Color role --${role} changes between themes (${hexes.join(' vs ')}). Brand and club colors do not.`)
    }
  }
  return problems
}

function lineProblems(label, min, pairs, name, vars) {
  return pairs.flatMap((pair) => {
    const [fgs, bg, extra] = pair.split('/')
    if (!fgs || !bg || extra !== undefined) return [`${label} pair ${pair} is not fg/bg.`]
    const tokens = [...fgs.split('|'), bg]
    const missing = tokens.filter((t) => !resolveToken(vars, t))
    if (missing.length) {
      return [`${label} pair ${pair} in ${name}: ${missing.map((t) => `--${t}`).join(', ')} does not resolve to a hex color.`]
    }
    const best = Math.max(...fgs.split('|').map((fg) => contrastRatio(resolveToken(vars, fg), resolveToken(vars, bg))))
    return best < min ? [`${label} pair ${pair} is ${best.toFixed(2)}:1 in ${name} (needs ${min}:1).`] : []
  })
}

export function checkContrastLines(css) {
  const themes = readThemes(css)
  const absent = THEMES.filter((t) => !themes[t.name])
  if (absent.length) return absent.map((t) => `tokens.css has no ${t.selector} block (${t.name} theme).`)
  const problems = roleProblems(themes)
  for (const { label, min } of LINES) {
    const pairs = (new RegExp(`${label}:([^*]*)\\*/`).exec(css)?.[1] ?? '').trim().split(/\s+/).filter(Boolean)
    if (!pairs.length) {
      problems.push(`tokens.css has no ${label} line to check.`)
      continue
    }
    for (const { name } of THEMES) problems.push(...lineProblems(label, min, pairs, name, themes[name]))
  }
  return problems
}
