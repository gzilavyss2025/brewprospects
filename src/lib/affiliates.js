// Per-affiliate accent colors. The Brewers identity leads everywhere; a club's
// own color appears only as an accent on its own sections.
//
// Colors are WEB RESEARCH copied from Tally (src/lib/data/milb-colors.json
// there), not an official source: the Stats API has no color field. Each entry
// keeps its source and confidence so the caveat travels with the value. A club
// with no researched pair (the complex clubs) uses Brewers navy; an invented
// hex would be worse than the fallback.
import { pickInk } from './color.js'

export const BREWERS = { navy: '#12284b', gold: '#ffc52f' }

const ACCENTS = {
  556: { primary: '#071d49', secondary: '#c8102e', confidence: 'medium', source: 'Wikipedia' },
  5015: { primary: '#0f69b1', secondary: '#e2b880', confidence: 'medium', source: 'sportsfancovers.com' },
  572: { primary: '#862633', secondary: '#010101', confidence: 'medium', source: 'trucolor.net' },
  249: { primary: '#091f2c', secondary: '#00677f', confidence: 'medium', source: 'trucolor.net' },
}

export function accentFor(teamId) {
  const a = ACCENTS[teamId]
  const primary = a?.primary ?? BREWERS.navy
  return { primary, secondary: a?.secondary ?? BREWERS.gold, ink: pickInk(primary), researched: Boolean(a) }
}

// Logos come from MLB's public CDN, keyed by team id. Checked live for all
// seven 2026 affiliates and the Brewers.
export function teamLogoUrl(teamId) {
  return teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : null
}

// The `milb` headshot exists for many prospects whose studio `silo` shot does
// not. A player with no photo 404s, and the page falls back to initials.
export function headshotUrl(personId, width = 240) {
  return personId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${personId}/headshot/milb/current`
    : null
}
