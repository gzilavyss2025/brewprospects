// The four OPS bands (owner decision on #37): below .500, .500 to .799,
// .800 to 1.099, and 1.100 and up. This is the one home of the edges. The
// per-game chart (#37) and #53 import it; do not copy the numbers.
//
// The edges are in thousandths, whole numbers, so ".500" is 500. A band keeps
// its lower edge: .500 is "fair", .800 is "good", 1.100 is "great".
export const OPS_BAND_EDGES = Object.freeze([500, 800, 1100])

// Lowest to highest. A `key` names the meaning, never a color or a shape, and
// it must never be renamed: pages and styles select on it. A `label` is plain
// text, so a reader sees the band without color.
export const OPS_BANDS = Object.freeze([
  Object.freeze({ key: 'low', label: 'Below .500' }),
  Object.freeze({ key: 'fair', label: '.500 to .799' }),
  Object.freeze({ key: 'good', label: '.800 to 1.099' }),
  Object.freeze({ key: 'great', label: '1.100 and up' }),
])

// The string ops() in rates.js returns: three places, no leading zero below 1
// (".826", "1.100").
const OPS_TEXT = /^([1-9]\d*)?\.(\d{3})$/

// Thousandths from the text, read as digits so no float error can move a value
// across an edge. null when the text is not an OPS string.
function thousandths(text) {
  if (typeof text !== 'string') return null
  const m = OPS_TEXT.exec(text)
  return m ? Number(m[1] ?? 0) * 1000 + Number(m[2]) : null
}

// The band for one OPS string, as the same object the list holds (so `===`
// works), or null when the text is null or not an OPS string (ADR-0003). ".000"
// is not special here: the caller decides what a game with no plate
// appearances is.
export function opsBand(text) {
  const t = thousandths(text)
  if (t === null) return null
  return OPS_BANDS[OPS_BAND_EDGES.filter((edge) => t >= edge).length]
}
