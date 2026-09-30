// Rows and pools for the peer-percentile tests (test/percentiles.test.js and
// test/peer-pools.test.js). Rows are built from counts and get their rates from
// rates.js, as src/lib/build/data.js does.
import { withRates } from '../src/lib/model/player/rates.js'
import { buildPeerIndex, peerPercentilesFor } from '../src/lib/model/player/percentiles.js'

export const SEASON = '2026'
export const BREWERS = new Set([556, 5015, 572, 249, 406, 2101, 607])
const CLUBS = {
  aaa: { sportId: 11, teamId: 556, team: 'Nashville Sounds', league: 'International League' },
  aa: { sportId: 12, teamId: 5015, team: 'Biloxi Shuckers', league: 'Southern League' },
  aPlus: { sportId: 13, teamId: 572, team: 'Wisconsin Timber Rattlers', league: 'Midwest League' },
  acl: { sportId: 16, teamId: 406, team: 'ACL Brewers', league: 'Arizona Complex League' },
  dsl: { sportId: 16, teamId: 2101, team: 'DSL Brewers Gold', league: 'Dominican Summer League' },
  dslBlue: { sportId: 16, teamId: 607, team: 'DSL Brewers Blue', league: 'Dominican Summer League' },
  cards: { sportId: 12, teamId: 440, team: 'Springfield Cardinals', league: 'Texas League' },
  aaTotal: { sportId: 12, teamId: null, team: '', league: '' },
  milb: { sportId: 21, teamId: null, team: '', league: '' },
}

// A hitting row: `h` hits in `ab` at bats, with `bb` walks and `so` strikeouts.
// pa = ab + bb, so the sample is easy to set.
export function hit(club, { ab = 200, h = 50, bb = 20, so = 40, hr = 5, season = SEASON } = {}) {
  return withRates('hitting', {
    season, ...CLUBS[club], age: 22, g: 50, pa: ab + bb, ab, h, d: 8, t: 1, hr, r: 20, rbi: 20, bb, so, sb: 3, cs: 1, hbp: 0, sf: 0,
  })
}

// A pitching row: `ip` innings, `er` earned runs, `bf` batters faced.
export function pitch(club, { ip = 50, er = 20, h = 45, bb = 15, so = 55, bf = 210, season = SEASON } = {}) {
  return withRates('pitching', {
    season, ...CLUBS[club], age: 23, g: 12, gs: 10, w: 3, l: 3, sv: 0, outs: ip * 3, h, bb, so, hr: 4, er, bf,
  })
}

export const player = (id, { hitting = [], pitching = [] }) => ({ id, hitting, pitching })
export const index = (...players) => buildPeerIndex({ players, season: SEASON, brewersIds: BREWERS })
export const entries = (idx, id) => peerPercentilesFor(idx, id)
export const stat = (entry, key) => entry.stats.find((s) => s.key === key)

// Five AA hitters, 250 AB each, with hits 40, 50, 60, 70 and 55.
export const ladder = () =>
  [40, 50, 60, 70, 55].map((h, i) => player(i + 1, { hitting: [hit('aa', { ab: 250, h })] }))
