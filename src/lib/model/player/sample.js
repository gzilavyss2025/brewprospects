// The minimum sample, in one place (owner decision on #58, 2026-09-29). A
// player below it gets no rank and no "best" or "worst" label: a 4-PA hitter is
// not "99th". Import these; test/sample.test.js fails when a second copy of the
// numbers appears in src/.
//
// A hitter needs MIN_PA plate appearances. A pitcher needs MIN_IP innings, and
// a line stores outs, so compare `outs` to MIN_IP * 3.
export const MIN_PA = 100
export const MIN_IP = 30
