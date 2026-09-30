// Stat glossary (#57): every stat column on the player page has a definition.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STAT_TERMS, termFor } from '../src/lib/model/player/glossary.js'
import { STAT_COLS } from '../src/lib/model/player/columns.js'
import { GAMELOG_COLS } from '../src/lib/model/player/gamelog/gamelog-view.js'
import { wordProblems } from '../scripts/checks/docs.mjs'

const labels = (cols) => cols.map(([, label]) => label)

test('every year-by-year and game-log stat column has a definition', () => {
  for (const group of ['hitting', 'pitching']) {
    for (const label of [...labels(STAT_COLS[group]), ...labels(GAMELOG_COLS[group])]) {
      assert.ok(termFor(group, label), `${group} ${label} has no definition`)
    }
  }
})

test('no definition is blank, and each is one sentence', () => {
  for (const [group, terms] of Object.entries(STAT_TERMS)) {
    for (const [label, text] of Object.entries(terms)) {
      assert.match(text, /^\S.*\.$/, `${group} ${label} is blank or has no full stop`)
    }
  }
})

test('a label with no entry gives null, not a guess', () => {
  assert.equal(termFor('hitting', 'XYZ'), null)
  assert.equal(termFor('fielding', 'G'), null)
})

test('a label differs by group where the stat does', () => {
  assert.match(termFor('hitting', 'R'), /scored/)
  assert.match(termFor('pitching', 'R'), /allowed/)
})

test('the definitions follow the word list', () => {
  const text = JSON.stringify(STAT_TERMS, null, 1)
  assert.deepEqual(wordProblems('glossary.js', text), [])
})
