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

// ISO is the rounded SLG minus the rounded AVG, in thousandths, as ops adds
// rounded values. Then ISO always equals the SLG and AVG cells beside it. The
// API does not send ISO. AVG and SLG give ".000" at zero at bats because the
// API does; ISO, K%, BB% and BABIP have no API zero to copy, or (BABIP) the API
// sends ".---", which we read as null. So each returns null when a denominator
// is 0 or less, or an input is missing (ADR-0003).
export function iso(r) {
  if (!known(r.h, r.d, r.t, r.hr, r.ab) || r.ab <= 0) return null
  return three((thousandths(totalBases(r), r.ab) - thousandths(r.h, r.ab)) / 1000)
}

// Tenths of a percent, half up on the exact fraction: 224 is 22.4%. null when
// a count is missing or the denominator is 0 or less.
const tenthsOf = (num, den) => (known(num, den) && den > 0 ? units(num, den, 3) : null)

// Tenths as one decimal with a percent sign, "22.4%" or "-3.1%".
const showTenths = (t) => (t === null ? null : `${t < 0 ? '-' : ''}${Math.floor(Math.abs(t) / 10)}.${Math.abs(t) % 10}%`)

// so / pa and bb / pa to one decimal: "22.4%".
const percent = (num, den) => showTenths(tenthsOf(num, den))

export function kPct(r) {
  return percent(r.so, r.pa)
}

export function bbPct(r) {
  return percent(r.bb, r.pa)
}

// A pitcher's K% and BB% are so / bf and bb / bf, from batters faced. The API
// sends neither (nor K-BB%) for a pitcher, so there is no API string to check
// them against; the fixture tests only prove bf is on the rows.
export function pitchKPct(r) {
  return percent(r.so, r.bf)
}

export function pitchBbPct(r) {
  return percent(r.bb, r.bf)
}

// The rounded K% minus the rounded BB%, in tenths, as iso and ops subtract and
// add rounded values. K-BB% then always equals the two cells beside it: 21.7%
// and 7.9% give 13.8%, though the exact 64 / 466 is 13.7%.
export function kbbPct(r) {
  const k = tenthsOf(r.so, r.bf)
  const bb = tenthsOf(r.bb, r.bf)
  return k === null || bb === null ? null : showTenths(k - bb)
}

// (H - HR) / (AB - SO - HR + SF). The API sends babip on MiLB and MLB lines
// (checked in test/fixtures/people-*.json).
export function babip(r) {
  if (!known(r.h, r.hr, r.ab, r.so, r.sf)) return null
  const den = r.ab - r.so - r.hr + r.sf
  return den > 0 ? three(units(r.h - r.hr, den, 3) / 1000) : null
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
  if (group === 'hitting') {
    const base = { avg: avg(r), obp: obp(r), slg: slg(r), ops: ops(r) }
    return { ...r, ...base, iso: iso(r), kPct: kPct(r), bbPct: bbPct(r), babip: babip(r) }
  }
  const base = { ip: ip(r), era: era(r), whip: whip(r), k9: k9(r), bb9: bb9(r) }
  return { ...r, ...base, kPct: pitchKPct(r), bbPct: pitchBbPct(r), kbbPct: kbbPct(r) }
}

// One entry with rates on every row: an org.json or careers.json player, whose
// groups are lists of rows, or an archive roster entry, whose groups are one
// line or null. src/lib/build/ calls it once per entry as a file loads, so
// every model and page reads the rows with rates, as before the files were
// packed.
export function entryWithRates(e) {
  const add = (group, v) => (Array.isArray(v) ? v.map((r) => withRates(group, r)) : v && withRates(group, v))
  return { ...e, hitting: add('hitting', e.hitting), pitching: add('pitching', e.pitching) }
}

// entryWithRates on every player of { [id]: entry }.
export function playersWithRates(players) {
  return Object.fromEntries(Object.entries(players).map(([id, p]) => [id, entryWithRates(p)]))
}
