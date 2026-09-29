// Site-wide settings. The name is a placeholder until one is chosen: change it
// here and every page, title and feed follows.
export const SITE_NAME = 'Brew Prospects'
export const SITE_TAGLINE = 'The Milwaukee Brewers farm system, level by level.'

// MLB Stats API team id of the parent club. Every affiliate carries it as
// `parentOrgId`.
export const ORG_ID = 158

// Shown in the footer on every page. The site uses MLB Stats API data and MLB
// Pipeline rankings, and is not run by MLB, MiLB or the Brewers.
export const DISCLAIMER =
  'Fan site. Not affiliated with MLB, MiLB or the Milwaukee Brewers. Stats from the MLB Stats API; prospect ranks from MLB Pipeline and, for 2006–2008, Baseball America.'

// Shared by /about and the RSS channel description, so the two never drift.
export const SITE_DESCRIPTION = `${SITE_NAME} is a fan site about the Milwaukee Brewers farm system. ${DISCLAIMER}`

// The feed needs an absolute origin even before SITE_URL is set (ADR-0009).
// Used only for the feed: astro.config.mjs's `site` stays unset, so pages
// still emit no canonical link and no og:url until the domain is chosen.
const FEED_ORIGIN_FALLBACK = 'https://brewprospects.vercel.app'
export function feedOrigin(siteUrl) {
  return siteUrl || FEED_ORIGIN_FALLBACK
}

// The archive's first season. Past seasons run from here to the season before
// the current one; the current season lives in src/data/org.json.
export const ARCHIVE_FIRST_SEASON = 2006

// Seasons with no minor-league games at all. The archive records them with a
// reason instead of treating their empty rosters as a bad response.
export const NO_MILB_SEASONS = { 2020: 'No minor-league season was played in 2020 (COVID-19).' }
