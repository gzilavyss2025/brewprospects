// The geometry of the per-game OPS chart (#37). Pure: chart data in, numbers
// out. It draws no markup and picks no color; OpsChart.astro reads these
// numbers and the band `key`, and the style sheet picks the look.
//
// Every coordinate is a unitless SVG user unit inside the fixed VIEW box. It
// is not a CSS pixel: the box scales to the width of its wrapper.
//
// The y scale is fixed, 0 to OPS_CAP. A game above the cap is clipped at the
// top and flagged `clipped`, so no bar runs off the chart and the scale never
// shrinks to fit one big game. A missing game has no bar at all (ADR-0003).
import { OPS_BAND_EDGES } from './ops-band.js'

export const VIEW = Object.freeze({ width: 720, height: 300 })
// Room around the plot: labels on the left, a marker row on the top, and on
// the bottom the ticks for missing games and the date labels.
export const PLOT = Object.freeze({ left: 48, right: 12, top: 24, bottom: 40 })
// The top of the y scale, in thousandths of OPS.
export const OPS_CAP = 2000
// A bar is 70% of its slot, but never thinner than this (a season of 127
// games still shows every bar) and never fatter than that (one game is not a
// slab). A slot is the room for one game.
export const MIN_BAR_WIDTH = 2
export const MAX_BAR_WIDTH = 28
const BAR_SHARE = 0.7

const FLOOR = VIEW.height - PLOT.bottom
const PLOT_WIDTH = VIEW.width - PLOT.left - PLOT.right
const PLOT_HEIGHT = FLOOR - PLOT.top

const OPS_TEXT = /^([1-9]\d*)?\.(\d{3})$/
const round = (n) => Math.round(n * 100) / 100

// Thousandths from an OPS string, read as digits so no float error can move a
// value (".826" is 826, "1.100" is 1100). null when the text is not one.
export function opsThousandths(text) {
  if (typeof text !== 'string') return null
  const m = OPS_TEXT.exec(text)
  return m ? Number(m[1] ?? 0) * 1000 + Number(m[2]) : null
}

// Thousandths back to the text ops() writes: three places, no leading zero.
export function opsLabel(thousandths) {
  const whole = Math.floor(thousandths / 1000)
  const rest = String(thousandths % 1000).padStart(3, '0')
  return `${whole || ''}.${rest}`
}

// The y of a value. Above the cap or below zero, the edge of the plot.
export function yFor(thousandths) {
  const t = Math.min(OPS_CAP, Math.max(0, thousandths))
  return round(FLOOR - (t / OPS_CAP) * PLOT_HEIGHT)
}

const slotWidth = (count) => PLOT_WIDTH / Math.max(1, count)

// The middle of a game's slot. Index 0 is the oldest game, on the left.
export function xCenter(index, count) {
  return round(PLOT.left + slotWidth(count) * (index + 0.5))
}

// The rect of one bar, or null for a game with no value. A real .000 (a game
// of at-bats with no hits) is a bar of height 0: it is a value, not a gap.
export function barRect(game, index, count) {
  if (!game || game.missing) return null
  const t = opsThousandths(game.ops)
  if (t === null) return null
  const slot = slotWidth(count)
  const width = Math.min(slot, Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slot * BAR_SHARE)))
  const y = yFor(t)
  return {
    x: round(PLOT.left + slot * index + (slot - width) / 2),
    y,
    width: round(width),
    height: round(FLOOR - y),
    clipped: t > OPS_CAP,
  }
}

// The rolling line, as runs of points. A point is a game with a value: a game
// without one is left out, and the line breaks there instead of joining across
// the gap. A run can hold one point.
export function rollingSegments(rolling, count) {
  const segments = []
  let last = null
  for (const point of rolling) {
    const t = opsThousandths(point.ops)
    if (t === null) continue
    const p = { index: point.index, x: xCenter(point.index, count), y: yFor(t), clipped: t > OPS_CAP }
    if (last !== null && point.index === last + 1) segments[segments.length - 1].push(p)
    else segments.push([p])
    last = point.index
  }
  return segments
}

// The season OPS line: level across the plot. null when there is no value.
export function seasonLine(season) {
  const t = opsThousandths(season)
  if (t === null) return null
  return { y: yFor(t), x1: PLOT.left, x2: VIEW.width - PLOT.right, clipped: t > OPS_CAP }
}

// The lines behind the bars: the floor, each band edge and the cap, low to
// high, each with its label text. `edge` is true for a band edge.
export function gridLines() {
  const line = (value, edge) => ({ value, label: opsLabel(value), y: yFor(value), edge })
  return [line(0, false), ...OPS_BAND_EDGES.map((edge) => line(edge, true)), line(OPS_CAP, false)]
}

// A small diamond around a point: the mark for a game at a club outside the
// system. It has no color of its own.
const MARK_RADIUS = 3.5
export function markerPath(x, y) {
  const r = MARK_RADIUS
  return `M${x} ${round(y - r)}L${round(x + r)} ${y}L${x} ${round(y + r)}L${round(x - r)} ${y}z`
}

// A small chevron with its tip up at a point: the mark on a clipped bar.
export function chevronPath(x, y) {
  return `M${round(x - 3.5)} ${round(y + 3.5)}L${x} ${y}L${round(x + 3.5)} ${round(y + 3.5)}`
}

// Everything the component draws, from opsChart() output. An empty log gives
// empty lists and the grid; nothing here is NaN.
export function chartLayout({ games, season, rolling }) {
  const count = games.length
  const bars = []
  const missingMarks = []
  const outsideMarks = []
  const clipMarks = []
  games.forEach((game, index) => {
    const rect = barRect(game, index, count)
    const x = xCenter(index, count)
    const key = { index, gamePk: game.gamePk }
    let outsideY = FLOOR - 6
    if (rect) {
      bars.push({ ...key, ...rect, band: game.band?.key ?? null, outside: Boolean(game.outside) })
      outsideY = rect.y - 6
      if (rect.clipped) {
        clipMarks.push({ ...key, x, y: rect.y - 5, d: chevronPath(x, rect.y - 5) })
        outsideY -= 8
      }
    } else {
      // A tick below the floor, where no bar goes.
      missingMarks.push({ ...key, x, y1: FLOOR + 2, y2: FLOOR + 9 })
    }
    if (game.outside) outsideMarks.push({ ...key, x, y: outsideY, d: markerPath(x, outsideY) })
  })
  return {
    view: VIEW,
    plot: { left: PLOT.left, right: VIEW.width - PLOT.right, top: PLOT.top, floor: FLOOR },
    grid: gridLines(),
    bars,
    missingMarks,
    outsideMarks,
    clipMarks,
    rolling: rollingSegments(rolling, count),
    season: seasonLine(season),
  }
}
