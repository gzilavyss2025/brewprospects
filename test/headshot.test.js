import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headshotUrl, HEADSHOT_KINDS } from '../src/lib/identity/affiliates.js'
import { reachedMlb, headshotChain, initialsOf, headshotOnError } from '../src/lib/identity/headshot.js'
import { slimPerson } from '../scripts/data/slim.mjs'
import yby from './fixtures/people-yearbyyear.json' with { type: 'json' }

const [made, adams] = yby.people.map(slimPerson)

test('headshotUrl builds each kind and refuses an unknown kind or no id', () => {
  assert.deepEqual(HEADSHOT_KINDS, ['silo', '67', 'milb'])
  assert.match(headshotUrl(1, 240, '67'), /\/people\/1\/headshot\/67\/current$/)
  assert.match(headshotUrl(1, 240, 'silo'), /\/w_240,q_auto:best\/v1\/people\/1\/headshot\/silo\/current$/)
  assert.match(headshotUrl(1), /\/people\/1\/headshot\/milb\/current$/)
  assert.equal(headshotUrl(1, 240, 'generic'), null)
  assert.equal(headshotUrl(null, 240, 'silo'), null)
})

test('reachedMlb reads the debut date the API sends (fixture)', () => {
  assert.equal(reachedMlb(adams), true)
  assert.equal(reachedMlb(made), false)
  assert.equal(reachedMlb({ id: 1, mlbDebutDate: null }), false)
  assert.equal(reachedMlb(undefined), false)
})

test('headshotChain tries silo, then 67, only for a player who reached MLB', () => {
  const url = (kind) => headshotUrl(adams.id, 144, kind)
  assert.deepEqual(headshotChain(adams, 144), [url('silo'), url('67'), url('milb')])
  assert.deepEqual(headshotChain(made), [headshotUrl(made.id, 240, 'milb')])
  assert.deepEqual(headshotChain({ name: 'No Id' }), [])
  assert.deepEqual(headshotChain(null), [])
})

test('initialsOf takes the first two words and survives a blank name', () => {
  assert.equal(initialsOf('Jesús Made'), 'JM')
  assert.equal(initialsOf('  Luis  Peña  Jr. '), 'LP')
  assert.equal(initialsOf(''), '')
  assert.equal(initialsOf(undefined), '')
})

// Runs the handler string against a stand-in image, as the browser would.
function fakeImage(fallbacks) {
  const img = { dataset: { fallbacks }, src: 'first', replacedWith: null }
  img.replaceWith = (node) => { img.replacedWith = node }
  const document = { createElement: (tag) => ({ tag }) }
  const fire = new Function('document', headshotOnError('J"M'))
  return { img, error: () => fire.call(img, document) }
}

test('the onerror handler walks the chain, then swaps in initials', () => {
  const { img, error } = fakeImage('b c')
  error()
  assert.equal(img.src, 'b')
  assert.equal(img.dataset.fallbacks, 'c')
  error()
  assert.equal(img.src, 'c')
  assert.equal(img.dataset.fallbacks, '')
  assert.equal(img.replacedWith, null)
  error()
  assert.deepEqual(img.replacedWith, { tag: 'div', className: 'initials', textContent: 'J"M' })
})

test('the onerror handler with no fallbacks goes straight to initials', () => {
  for (const fallbacks of ['', undefined]) {
    const { img, error } = fakeImage(fallbacks)
    error()
    assert.equal(img.src, 'first')
    assert.equal(img.replacedWith.className, 'initials')
  }
})
