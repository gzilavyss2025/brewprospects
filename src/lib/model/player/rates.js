// Rate stats, computed from the counting stats a snapshot stores
// (docs/adr/0015). A snapshot keeps counts only; every rate a page shows comes
// from here, so a rate can never disagree with the counts beside it.
//
// Each function takes one row and returns the string the Stats API would send
// (".284", "3.67", "110.1"), or null when an input is missing. null renders as
// a dash (docs/adr/0003). The formulas, the rounding and the zero cases were
// checked against all 25,056 MLB rate values gen-mlb fetched on 2026-09-29:
// every computed string matched the API's own. What the API does at zero:
// - a hitting rate with a denominator of 0 is ".000" (a pitcher with no at
//   bats), and OPS is then OBP plus ".000";
// - a pitching rate with 0 outs is "-.--", which the snapshots store as null.

const known = (...xs) => xs.every((x) => Number.isFinite(x))

// Three places, no leading zero below 1: ".284", "1.000".
const three = (x) => x.toFixed(3).replace(/^0(?=\.)/, '')
const two = (x) => x.toFixed(2)

// num / den in whole units of 10^-places, rounded half up on the exact
// fraction, not on a float that may sit just below the half.
const units = (num, den, places) => Math.floor((num * 10 ** places * 2 + den) / (den * 2))

// Hitting rates: thousandths, and 0 when the denominator is 0.
const thousandths = (num, den) => (den > 0 ? units(num, den, 3) : 0)
const rate3 = (num, den) => three(thousandths(num, den) / 1000)
const rate2 = (num, den) => (den > 0 ? two(units(num, den, 2) / 100) : null)

const totalBases = (r) => r.h + r.d + 2 * r.t + 3 * r.hr

export function avg(r) {
  return known(r.h, r.ab) ? rate3(r.h, r.ab) : null
}

export function obp(r) {
  if (!known(r.h, r.bb, r.hbp, r.ab, r.sf)) return null
  return rate3(r.h + r.bb + r.hbp, r.ab + r.bb + r.hbp + r.sf)
}

export function slg(r) {
  return known(r.h, r.d, r.t, r.hr, r.ab) ? rate3(totalBases(r), r.ab) : null
}

// The rounded OBP plus the rounded SLG, as the API adds them: .826, not the
// .825 that rounding the exact sum once can give.
export function ops(r) {
  if (!known(r.h, r.bb, r.hbp, r.ab, r.sf, r.d, r.t, r.hr)) return null
  const onBase = thousandths(r.h + r.bb + r.hbp, r.ab + r.bb + r.hbp + r.sf)
  return three((onBase + thousandths(totalBases(r), r.ab)) / 1000)
}

// "110.1" is 110 innings and one out.
export function ip(r) {
  return known(r.outs) ? `${Math.floor(r.outs / 3)}.${r.outs % 3}` : null
}

export function era(r) {
  return known(r.er, r.outs) ? rate2(27 * r.er, r.outs) : null
}

export function whip(r) {
  return known(r.bb, r.h, r.outs) ? rate2(3 * (r.bb + r.h), r.outs) : null
}

export function k9(r) {
  return known(r.so, r.outs) ? rate2(27 * r.so, r.outs) : null
}

export function bb9(r) {
  return known(r.bb, r.outs) ? rate2(27 * r.bb, r.outs) : null
}

// The row with its rates added, under the names the stat tables read.
export function withRates(group, r) {
  if (group === 'hitting') return { ...r, avg: avg(r), obp: obp(r), slg: slg(r), ops: ops(r) }
  return { ...r, ip: ip(r), era: era(r), whip: whip(r), k9: k9(r), bb9: bb9(r) }
}
