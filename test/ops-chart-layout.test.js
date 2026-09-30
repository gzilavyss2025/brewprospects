// The geometry of the per-game OPS chart (#37), in
// src/lib/model/player/gamelog/ops-chart-layout.js. Pure numbers: no color, no
// markup. Games here are hand-made entries shaped like opsChart() games.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VIEW, PLOT, OPS_CAP, MIN_BAR_WIDTH, MAX_BAR_WIDTH,
  opsThousandths, opsLabel, yFor, xCenter, barRect, rollingSegments, seasonLine, gridLines,
  markerPath, chevronPath, chartLayout,
} from '../src/lib/model/player/gamelog/ops-chart-layout.js'
import { opsBand } from '../src/lib/model/player/gamelog/ops-band.js'

const game = (n, text, over = {}) => ({
  gamePk: 900000 + n, outside: false, ops: text, band: opsBand(text), missing: text === null, ...over,
})
const games = (texts) => texts.map((t, i) => game(i + 1, t))
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} is not near ${b}`)
// Every number in a value, walked, that is not finite. JSON hides NaN as null.
const badNumbers = (value, path = 'out') => {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [path]
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => badNumbers(v, `${path}.${k}`))
  return []
}
const FLOOR = VIEW.height - PLOT.bottom

test('the view is fixed, and the plot sits inside it', () => {
  assert.ok(PLOT.left > 0 && PLOT.top > 0)
  assert.ok(VIEW.width - PLOT.right > PLOT.left)
  assert.ok(FLOOR > PLOT.top)
  assert.equal(OPS_CAP, 2000)
})

test('opsThousandths reads the digits of an OPS string', () => {
  assert.equal(opsThousandths('.826'), 826)
  assert.equal(opsThousandths('.000'), 0)
  assert.equal(opsThousandths('1.100'), 1100)
  assert.equal(opsThousandths('2.500'), 2500)
  assert.equal(opsThousandths('10.000'), 10000)
})

test('opsThousandths gives null for anything that is not an OPS string', () => {
  for (const bad of [null, undefined, '', '-', '—', 'abc', '.82', '0.826', 826, NaN]) {
    assert.equal(opsThousandths(bad), null, `for ${String(bad)}`)
  }
})

test('opsLabel writes thousandths the way ops() does', () => {
  assert.equal(opsLabel(0), '.000')
  assert.equal(opsLabel(500), '.500')
  assert.equal(opsLabel(800), '.800')
  assert.equal(opsLabel(1100), '1.100')
  assert.equal(opsLabel(2000), '2.000')
})

test('yFor maps 0 to the floor and the cap to the top of the plot', () => {
  near(yFor(0), FLOOR)
  near(yFor(OPS_CAP), PLOT.top)
  near(yFor(OPS_CAP / 2), (FLOOR + PLOT.top) / 2)
})

test('yFor clips above the cap and below zero, never past the plot', () => {
  assert.equal(yFor(OPS_CAP + 1), yFor(OPS_CAP))
  assert.equal(yFor(9000), PLOT.top)
  assert.equal(yFor(-5), FLOOR)
})

test('xCenter puts the oldest game on the left, one slot per game', () => {
  const count = 10
  const xs = Array.from({ length: count }, (_, i) => xCenter(i, count))
  for (let i = 1; i < count; i++) assert.ok(xs[i] > xs[i - 1])
  near(xs[1] - xs[0], (VIEW.width - PLOT.left - PLOT.right) / count)
  assert.ok(xs[0] > PLOT.left && xs[count - 1] < VIEW.width - PLOT.right)
})

test('a bar rises from the floor, and a higher OPS is a taller bar', () => {
  const low = barRect(game(1, '.400'), 0, 3)
  const high = barRect(game(2, '.900'), 1, 3)
  near(low.y + low.height, FLOOR)
  near(high.y + high.height, FLOOR)
  assert.ok(high.height > low.height)
  near(high.height, FLOOR - yFor(900))
  assert.equal(low.clipped, false)
})

test('a bar is centered on its slot and never wider than the maximum', () => {
  const b = barRect(game(1, '.700'), 0, 1)
  assert.equal(b.width, MAX_BAR_WIDTH)
  near(b.x + b.width / 2, xCenter(0, 1))
})

test('a real .000 is a bar of height 0 on the floor, not a missing game', () => {
  const b = barRect(game(1, '.000'), 0, 1)
  assert.equal(b.height, 0)
  near(b.y, FLOOR)
})

test('an OPS above the cap is clipped at the top and flagged', () => {
  const b = barRect(game(1, '2.500'), 0, 5)
  assert.equal(b.clipped, true)
  near(b.y, PLOT.top)
  near(b.y + b.height, FLOOR)
  const edge = barRect(game(2, '2.000'), 0, 5)
  assert.equal(edge.clipped, false)
  near(edge.y, PLOT.top)
})

test('a missing game has no bar', () => {
  assert.equal(barRect(game(1, null), 0, 3), null)
  assert.equal(barRect({ ...game(1, '.800'), missing: true }, 0, 3), null)
  assert.equal(barRect(game(1, 'bad', { missing: false }), 0, 3), null)
})

test('127 games: bars stay at least the minimum width, inside the plot, and apart', () => {
  const count = 127
  const rects = Array.from({ length: count }, (_, i) => barRect(game(i + 1, '.750'), i, count))
  for (const r of rects) {
    assert.ok(r.width >= MIN_BAR_WIDTH, `width ${r.width}`)
    assert.ok(r.x >= PLOT.left && r.x + r.width <= VIEW.width - PLOT.right + 0.001)
  }
  for (let i = 1; i < count; i++) assert.ok(rects[i].x >= rects[i - 1].x + rects[i - 1].width, `bars ${i - 1} and ${i} touch`)
})

test('a few games do not make fat bars', () => {
  assert.equal(barRect(game(1, '.750'), 0, 3).width, MAX_BAR_WIDTH)
})

test('rollingSegments: one run of points is one segment, at the right places', () => {
  const rolling = [{ index: 9, ops: '.800', pa: 40 }, { index: 10, ops: '.900', pa: 41 }, { index: 11, ops: '.700', pa: 39 }]
  const segments = rollingSegments(rolling, 12)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].length, 3)
  near(segments[0][0].x, xCenter(9, 12))
  near(segments[0][1].y, yFor(900))
  assert.deepEqual(segments[0].map((p) => p.index), [9, 10, 11])
})

test('rollingSegments breaks the line where a point is missing', () => {
  const at = (index) => ({ index, ops: '.800', pa: 35 })
  const segments = rollingSegments([at(9), at(10), at(13), at(14), at(15), at(20)], 22)
  assert.deepEqual(segments.map((s) => s.map((p) => p.index)), [[9, 10], [13, 14, 15], [20]])
})

test('rollingSegments: no points is no segment, and no point is invented', () => {
  assert.deepEqual(rollingSegments([], 5), [])
  assert.deepEqual(rollingSegments([{ index: 9, ops: null, pa: 40 }, { index: 10, ops: 'bad', pa: 40 }], 12), [])
})

test('rollingSegments clips a point above the cap', () => {
  const [[p]] = rollingSegments([{ index: 0, ops: '2.400', pa: 50 }], 1)
  assert.equal(p.clipped, true)
  assert.equal(p.y, PLOT.top)
})

test('seasonLine runs the width of the plot at the season OPS', () => {
  const line = seasonLine('.826')
  near(line.y, yFor(826))
  assert.equal(line.x1, PLOT.left)
  assert.equal(line.x2, VIEW.width - PLOT.right)
  assert.equal(line.clipped, false)
  assert.equal(seasonLine('2.200').clipped, true)
})

test('seasonLine is null when there is no season OPS', () => {
  assert.equal(seasonLine(null), null)
  assert.equal(seasonLine('bad'), null)
})

test('gridLines: the band edges, with text labels, plus the floor and the cap', () => {
  const lines = gridLines()
  assert.deepEqual(lines.map((l) => l.label), ['.000', '.500', '.800', '1.100', '2.000'])
  assert.deepEqual(lines.map((l) => l.edge), [false, true, true, true, false])
  for (let i = 1; i < lines.length; i++) assert.ok(lines[i].y < lines[i - 1].y)
  near(lines[1].y, yFor(500))
})

test('marker paths are closed shapes and have no NaN', () => {
  for (const d of [markerPath(50, 40), chevronPath(50, 40)]) {
    assert.match(d, /^M/)
    assert.doesNotMatch(d, /NaN|undefined/)
  }
  assert.match(markerPath(50, 40), /z$/i)
})

test('chartLayout with 0 games draws nothing and holds no NaN', () => {
  const out = chartLayout({ games: [], season: null, rolling: [] })
  assert.deepEqual(out.bars, [])
  assert.deepEqual(out.missingMarks, [])
  assert.deepEqual(out.outsideMarks, [])
  assert.deepEqual(out.rolling, [])
  assert.equal(out.season, null)
  assert.equal(out.grid.length, 5)
  assert.deepEqual(badNumbers(out), [])
})

test('chartLayout with 1 game draws one bar', () => {
  const out = chartLayout({ games: games(['.875']), season: '.875', rolling: [] })
  assert.equal(out.bars.length, 1)
  assert.equal(out.bars[0].band, 'good')
  assert.equal(out.rolling.length, 0)
  near(out.season.y, yFor(875))
})

test('chartLayout with every game missing has no bar and one mark per game', () => {
  const out = chartLayout({ games: games([null, null, null]), season: null, rolling: [] })
  assert.deepEqual(out.bars, [])
  assert.equal(out.missingMarks.length, 3)
  assert.equal(out.season, null)
  const [a, b] = out.missingMarks
  assert.ok(b.x > a.x)
  assert.ok(a.y1 >= FLOOR && a.y2 > a.y1, 'the tick sits at or below the floor, where no bar goes')
  assert.deepEqual(out.missingMarks.map((m) => m.index), [0, 1, 2])
})

test('chartLayout keeps a missing game between two bars in its own slot', () => {
  const out = chartLayout({ games: games(['.600', null, '.900']), season: '.750', rolling: [] })
  assert.deepEqual(out.bars.map((b) => b.index), [0, 2])
  assert.deepEqual(out.missingMarks.map((m) => m.index), [1])
  assert.ok(out.missingMarks[0].x > out.bars[0].x && out.missingMarks[0].x < out.bars[1].x)
})

test('chartLayout marks a game outside the system above its bar', () => {
  const list = [game(1, '.600'), game(2, '.900', { outside: true }), game(3, null, { outside: true })]
  const out = chartLayout({ games: list, season: '.750', rolling: [] })
  assert.deepEqual(out.outsideMarks.map((m) => m.index), [1, 2])
  const bar = out.bars.find((b) => b.index === 1)
  assert.ok(out.outsideMarks[0].y < bar.y, 'the mark is above the bar')
  assert.ok(out.outsideMarks[1].y < FLOOR, 'a missing game gets its mark above the floor')
  assert.equal(out.bars.find((b) => b.index === 0).outside, false)
  assert.equal(bar.outside, true)
})

test('chartLayout: a clipped bar gets a clip mark, and its outside mark rises clear of it', () => {
  const list = [game(1, '3.000', { outside: true }), game(2, '.900')]
  const out = chartLayout({ games: list, season: '1.000', rolling: [] })
  assert.equal(out.bars[0].clipped, true)
  assert.deepEqual(out.clipMarks.map((m) => m.index), [0])
  assert.ok(out.outsideMarks[0].y < out.clipMarks[0].y)
  assert.ok(out.outsideMarks[0].y > 0, 'the mark stays inside the view')
})

test('chartLayout carries the band key and the game key onto each bar', () => {
  const out = chartLayout({ games: games(['.100', '.500', '.800', '1.100']), season: '.600', rolling: [] })
  assert.deepEqual(out.bars.map((b) => b.band), ['low', 'fair', 'good', 'great'])
  assert.deepEqual(out.bars.map((b) => b.gamePk), [900001, 900002, 900003, 900004])
})

test('chartLayout turns the rolling series into segments with a gap kept', () => {
  const list = games(Array(14).fill('.700'))
  const rolling = [9, 10, 12, 13].map((index) => ({ index, ops: '.700', pa: 40 }))
  const out = chartLayout({ games: list, season: '.700', rolling })
  assert.deepEqual(out.rolling.map((s) => s.length), [2, 2])
})

test('every number chartLayout gives is finite, whatever the log', () => {
  const list = [game(1, '.000'), game(2, null), game(3, '2.750', { outside: true }), game(4, '1.234')]
  const out = chartLayout({ games: list, season: '1.000', rolling: [{ index: 3, ops: '1.100', pa: 33 }] })
  assert.deepEqual(badNumbers(out), [])
  assert.doesNotMatch(JSON.stringify(out), /NaN|Infinity|undefined/)
})
