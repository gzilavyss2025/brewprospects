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

// A club record (src/lib/model/standings.js) -> "32-43 (.427)". Null when the
// club has no wins-and-losses on record; the caller then says "not on record".
export function recordText(record) {
  if (!Number.isFinite(record?.wins) || !Number.isFinite(record?.losses)) return null
  return record.pct ? `${record.wins}-${record.losses} (${record.pct})` : `${record.wins}-${record.losses}`
}

// 3 -> "3rd". A missing or non-positive rank is DASH.
export function ordinal(n) {
  if (!Number.isInteger(n) || n < 1) return DASH
  const tail = n % 100
  const suffix = tail >= 11 && tail <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'
  return `${n}${suffix}`
}
