// WCAG 2.x contrast math. Used at build time to pick readable text on an
// affiliate's accent color, and by scripts/checks/check-contrast.mjs.

function channel(c) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function luminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// The more readable of the candidate inks on this background.
export function pickInk(bg, inks = ['#ffffff', '#12284b']) {
  let best = inks[0]
  let bestRatio = -1
  for (const ink of inks) {
    const r = contrastRatio(bg, ink) ?? -1
    if (r > bestRatio) {
      best = ink
      bestRatio = r
    }
  }
  return best
}
