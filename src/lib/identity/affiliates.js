// Per-affiliate accent colors. The Brewers identity leads everywhere; a club's
// own color appears only as an accent on its own sections.
//
// Colors are WEB RESEARCH copied from Tally (src/lib/data/milb-colors.json
// there), not an official source: the Stats API has no color field. Each entry
// keeps its source and confidence so the caveat travels with the value. A club
// with no researched pair (the complex clubs) uses Brewers navy; an invented
// hex would be worse than the fallback.
//
// Lint and rendering share one rule: a primary must reach 4.5:1 with the ink
// pickInk() picks for it. A failed or malformed entry stays in ACCENTS, so
// lint reports it, and accentFor() paints Brewers navy instead (ADR-0012).
import { contrastRatio, pickInk } from './color.js'

export const BREWERS = { navy: '#12284b', gold: '#ffc52f' }

export const ACCENT_MIN = 4.5

export const ACCENTS = {
  556: { primary: '#071d49', secondary: '#c8102e', confidence: 'medium', source: 'Wikipedia' },
  5015: { primary: '#0f69b1', secondary: '#e2b880', confidence: 'medium', source: 'sportsfancovers.com' },
  572: { primary: '#862633', secondary: '#010101', confidence: 'medium', source: 'trucolor.net' },
  249: { primary: '#091f2c', secondary: '#00677f', confidence: 'medium', source: 'trucolor.net' },
}

// The ink a primary gets and its ratio. A value that is not a six-digit hex
// gets no ink and no ratio, and is not ok.
export function measureAccent(primary) {
  if (!/^#[0-9a-f]{6}$/i.test(primary ?? '')) return { ink: null, ratio: null, ok: false }
  const ink = pickInk(primary)
  const ratio = contrastRatio(primary, ink)
  return { ink, ratio, ok: ratio >= ACCENT_MIN }
}

// One line per entry that fails. Lint prints these; the page still renders.
export function accentProblems(accents = ACCENTS) {
  return Object.entries(accents).flatMap(([id, a]) => {
    const { ink, ratio, ok } = measureAccent(a?.primary)
    if (ok) return []
    const why = ratio === null
      ? `has no valid primary color (${a?.primary ?? 'missing'})`
      : `${a.primary} with ${ink} ink is ${ratio.toFixed(2)}:1 (needs ${ACCENT_MIN}:1)`
    return [`Affiliate ${id} accent ${why}. It renders as Brewers navy.`]
  })
}

// `researched` says an entry exists (its provenance); `fallback` says the page
// paints Brewers navy, because there is no entry or it failed its check.
export function accentFor(teamId, accents = ACCENTS) {
  const a = accents[teamId]
  const usable = Boolean(a) && measureAccent(a.primary).ok
  const primary = usable ? a.primary : BREWERS.navy
  const secondary = (usable && a.secondary) || BREWERS.gold
  return { primary, secondary, ink: pickInk(primary), researched: Boolean(a), fallback: !usable }
}

// Logos come from MLB's public CDN, keyed by team id. Checked live for all
// seven 2026 affiliates and the Brewers.
export function teamLogoUrl(teamId) {
  return teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : null
}

// A team id outlives its club. Id 249 was the Carolina Mudcats through 2025 and
// is the Wilson Warbirds now; id 559 was the Brewers' Huntsville Stars and is
// another org's club today. The logo CDN and ACCENTS describe only the club
// that holds the id now, so a past club gets them only when its name that
// season matches the current name. Otherwise it gets no logo and the Brewers
// fallback accent: a missing logo beats a wrong one (ADR-0003).
// `currentName` is the id's name in org.json, or undefined for a non-affiliate.
export function clubIdentity(club, currentName) {
  const same = Boolean(club?.name) && club.name === currentName
  return {
    logo: same ? teamLogoUrl(club.id) : null,
    accent: accentFor(same ? club.id : null),
  }
}

// Headshots come in two kinds, keyed by person id. `silo` is the studio shot,
// which MLB keeps for players who reached the majors; `milb` exists for many
// prospects with no `silo`. Checked live on 2026-09-28 for 621097 (debuted
// 2019): both 200. A person with no photo of a kind gets 404 (999999999, and
// silo for 116034, a retired big-leaguer). The URL has no `d_` default, so a
// miss is an error the page can catch, not a generic silhouette.
export const HEADSHOT_KINDS = ['silo', 'milb']

export function headshotUrl(personId, width = 240, kind = 'milb') {
  return personId && HEADSHOT_KINDS.includes(kind)
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${personId}/headshot/${kind}/current`
    : null
}
