// The stat columns of the year-by-year tables, as [row key, label]. The lead
// columns (Year, Lvl, Club, Age) are not stats and sit in StatTable. The game
// log's own stat columns are GAMELOG_COLS in gamelog-view.js.
export const STAT_COLS = {
  hitting: [
    ['g', 'G'], ['pa', 'PA'], ['h', 'H'], ['d', '2B'], ['t', '3B'], ['hr', 'HR'], ['r', 'R'], ['rbi', 'RBI'],
    ['bb', 'BB'], ['so', 'SO'], ['sb', 'SB'], ['avg', 'AVG'], ['obp', 'OBP'], ['slg', 'SLG'], ['ops', 'OPS'],
    ['iso', 'ISO'], ['kPct', 'K%'], ['bbPct', 'BB%'], ['babip', 'BABIP'],
  ],
  pitching: [
    ['g', 'G'], ['gs', 'GS'], ['w', 'W'], ['l', 'L'], ['sv', 'SV'], ['ip', 'IP'], ['h', 'H'], ['bb', 'BB'],
    ['so', 'SO'], ['hr', 'HR'], ['era', 'ERA'], ['whip', 'WHIP'], ['k9', 'K/9'], ['bb9', 'BB/9'],
    ['kPct', 'K%'], ['bbPct', 'BB%'], ['kbbPct', 'K-BB%'],
  ],
}
