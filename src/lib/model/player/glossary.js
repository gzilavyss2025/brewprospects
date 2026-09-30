// One plain sentence for each stat column header (#57). The words follow
// CONTEXT.md. A label means different things by group (R and H are runs and
// hits scored by a hitter, allowed by a pitcher), so each group has its own
// list. test/glossary.test.js fails when a column has no entry here.
export const STAT_TERMS = {
  hitting: {
    G: 'Games played.',
    PA: 'Plate appearances: every trip to the plate, walks and hit-by-pitches included.',
    AB: 'At-bats: plate appearances that are not walks, hit-by-pitches, sacrifices or interference.',
    H: 'Hits.',
    '2B': 'Doubles.',
    '3B': 'Triples.',
    HR: 'Home runs.',
    R: 'Runs scored.',
    RBI: 'Runs batted in.',
    BB: 'Walks.',
    SO: 'Strikeouts.',
    SB: 'Stolen bases.',
    AVG: 'Batting average: hits divided by at-bats.',
    OBP: 'On-base percentage: how often he reaches base by a hit, walk or hit-by-pitch.',
    SLG: 'Slugging percentage: total bases divided by at-bats.',
    OPS: 'On-base plus slugging: OBP and SLG added together.',
    ISO: 'Isolated power: SLG minus AVG. It counts only the extra bases.',
    'K%': 'Strikeout rate: strikeouts divided by plate appearances.',
    'BB%': 'Walk rate: walks divided by plate appearances.',
    BABIP: 'Batting average on balls in play: hits other than home runs, divided by at-bats that ended with the ball in play.',
  },
  pitching: {
    G: 'Games pitched in.',
    GS: 'Games started.',
    W: 'Wins.',
    L: 'Losses.',
    SV: 'Saves.',
    IP: 'Innings pitched. The digit after the point is outs: 110.1 is 110 innings and one out.',
    H: 'Hits allowed.',
    R: 'Runs allowed, earned or not.',
    ER: 'Earned runs allowed.',
    BB: 'Walks allowed.',
    SO: 'Strikeouts.',
    HR: 'Home runs allowed.',
    ERA: 'Earned run average: earned runs allowed per nine innings.',
    WHIP: 'Walks plus hits allowed per inning pitched.',
    'K/9': 'Strikeouts per nine innings.',
    'BB/9': 'Walks per nine innings.',
    'K%': 'Strikeout rate: strikeouts divided by batters faced.',
    'BB%': 'Walk rate: walks divided by batters faced.',
    'K-BB%': 'Strikeout rate minus walk rate, both as a share of batters faced.',
  },
}

// The sentence for a header, or null when there is none (the header then shows
// as plain text, never a guess).
export function termFor(group, label) {
  return STAT_TERMS[group]?.[label] ?? null
}
