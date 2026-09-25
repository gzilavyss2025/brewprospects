// Display formatting. Every function returns DASH for a missing value, never
// a guess: MiLB feeds often lack fields, and a blank must read as "not known".
export const DASH = '—'

export function orDash(value) {
  if (value === null || value === undefined) return DASH
  if (typeof value === 'number' && !Number.isFinite(value)) return DASH
  const s = String(value).trim()
  return s === '' ? DASH : s
}

// "6' 1\"" + 221 -> "6' 1\", 221 lb". Either part may be missing.
export function heightWeight(height, weight) {
  const parts = [height ? String(height) : null, weight ? `${weight} lb` : null].filter(Boolean)
  return parts.length ? parts.join(', ') : DASH
}

// batSide/pitchHand codes -> "S/R". A missing side shows "?".
export function batsThrows(bats, throws) {
  if (!bats && !throws) return DASH
  return `${bats || '?'}/${throws || '?'}`
}
