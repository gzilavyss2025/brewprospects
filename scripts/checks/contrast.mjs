// Contrast lines in tokens.css. PAIRS lists text on a background and needs
// WCAG AA text contrast (4.5:1). FOCUS lists the focus ring on each surface
// it can sit on and needs non-text contrast (3:1, WCAG 1.4.11). A pair is
// `fg/bg`; `a|b/bg` passes when either ring color reaches the bar, because
// the ring is two-tone (ring plus halo).
import { contrastRatio } from '../../src/lib/color.js'

export const LINES = [
  { label: 'PAIRS', min: 4.5 },
  { label: 'FOCUS', min: 3 },
]

export function checkContrastLines(css) {
  const vars = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]))
  return LINES.flatMap(({ label, min }) => {
    const pairs = (new RegExp(`${label}:([^*]*)\\*/`).exec(css)?.[1] ?? '').trim().split(/\s+/).filter(Boolean)
    if (!pairs.length) return [`tokens.css has no ${label} line to check.`]
    return pairs.flatMap((pair) => {
      const [fgs, bg] = pair.split('/')
      const ratios = fgs.split('|').map((fg) => contrastRatio(vars[fg], vars[bg]))
      if (ratios.includes(null)) return [`${label} pair ${pair}: unknown token.`]
      const best = Math.max(...ratios)
      return best < min ? [`${label} pair ${pair} is ${best.toFixed(2)}:1 (needs ${min}:1).`] : []
    })
  })
}
