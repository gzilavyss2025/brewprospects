// The four OPS bands (#37, #53): one home for the edges, in
// src/lib/model/player/gamelog/ops-band.js. The chart and #53 import it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  OPS_BAND_EDGES,
  OPS_BANDS,
  opsBand,
} from '../src/lib/model/player/gamelog/ops-band.js'

const [low, fair, good, great] = OPS_BANDS

test('the list has four bands, lowest first, with unique keys and plain labels', () => {
  assert.equal(OPS_BANDS.length, 4)
  assert.deepEqual(OPS_BANDS.map((b) => b.key), ['low', 'fair', 'good', 'great'])
  assert.equal(new Set(OPS_BANDS.map((b) => b.key)).size, 4)
  assert.equal(new Set(OPS_BANDS.map((b) => b.label)).size, 4)
  for (const b of OPS_BANDS) {
    assert.equal(typeof b.label, 'string')
    assert.ok(b.label.trim().length > 0, `${b.key} needs a label`)
  }
})

test('the labels say the range in words and numbers, with no color', () => {
  assert.deepEqual(OPS_BANDS.map((b) => b.label), [
    'Below .500',
    '.500 to .799',
    '.800 to 1.099',
    '1.100 and up',
  ])
})

test('the edges are .500, .800 and 1.100, in thousandths', () => {
  assert.deepEqual([...OPS_BAND_EDGES], [500, 800, 1100])
})

test('the list, its entries and the edges are frozen', () => {
  assert.ok(Object.isFrozen(OPS_BANDS))
  assert.ok(Object.isFrozen(OPS_BAND_EDGES))
  for (const b of OPS_BANDS) assert.ok(Object.isFrozen(b), `${b.key} is frozen`)
})

test('each edge lands in the upper band and the value just under it in the lower', () => {
  assert.equal(opsBand('.499'), low)
  assert.equal(opsBand('.500'), fair)
  assert.equal(opsBand('.799'), fair)
  assert.equal(opsBand('.800'), good)
  assert.equal(opsBand('1.099'), good)
  assert.equal(opsBand('1.100'), great)
})

test('the ends of the scale land in the outer bands', () => {
  assert.equal(opsBand('.000'), low)
  assert.equal(opsBand('2.000'), great)
  assert.equal(opsBand('.826'), good)
})

test('null gives null', () => {
  assert.equal(opsBand(null), null)
})

test('anything that is not an OPS string gives null, never a guess', () => {
  for (const bad of [undefined, '', '—', 'abc', '.82', '.8266', '826', '-.500', '1,100', ' .826', '.826 ', 'NaN', '-.--', '.---', '0.826', '1.1', 826, 0.826, {}, []]) {
    assert.equal(opsBand(bad), null, `should be null: ${JSON.stringify(bad)}`)
  }
})

test('every value returned is one of the list entries, the same object', () => {
  for (const text of ['.000', '.499', '.500', '.799', '.800', '1.099', '1.100', '2.000', '10.000']) {
    assert.ok(OPS_BANDS.includes(opsBand(text)), `${text} gives a listed band`)
  }
})
