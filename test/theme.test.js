import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveTheme, nextTheme, THEME_BOOT, THEME_KEY } from '../src/lib/theme.js'

// Runs the inline head script against a fake browser and returns the theme it set.
function runBoot({ stored = null, prefersDark = false, storageThrows = false, noMatchMedia = false } = {}) {
  const document = { documentElement: { dataset: {} } }
  const localStorage = {
    getItem(key) {
      if (storageThrows) throw new Error('SecurityError')
      assert.equal(key, THEME_KEY)
      return stored
    },
  }
  const matchMedia = noMatchMedia ? undefined : (q) => ({ matches: q === '(prefers-color-scheme: dark)' && prefersDark })
  new Function('document', 'localStorage', 'matchMedia', THEME_BOOT)(document, localStorage, matchMedia)
  return document.documentElement.dataset.theme
}

test('a stored choice wins over the OS setting', () => {
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('dark', false), 'dark')
})

test('with no stored choice, the OS setting decides', () => {
  assert.equal(resolveTheme(null, true), 'dark')
  assert.equal(resolveTheme(null, false), 'light')
})

test('a stored value that is not a theme is ignored', () => {
  assert.equal(resolveTheme('sepia', false), 'light')
  assert.equal(resolveTheme('', true), 'dark')
})

test('the toggle flips between the two themes', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'light')
  assert.equal(nextTheme(undefined), 'dark')
})

test('the head script sets the resolved theme on <html>', () => {
  assert.equal(runBoot(), 'light')
  assert.equal(runBoot({ prefersDark: true }), 'dark')
  assert.equal(runBoot({ stored: 'light', prefersDark: true }), 'light')
  assert.equal(runBoot({ stored: 'dark' }), 'dark')
})

test('the head script survives blocked storage and a missing matchMedia', () => {
  assert.equal(runBoot({ storageThrows: true, prefersDark: true }), 'dark')
  assert.equal(runBoot({ noMatchMedia: true }), 'light')
})

// The page shell must run the boot script, or every dark reader sees a
// light flash, and must carry the toggle (ADR-0013).
test('the page shell inlines the head script and renders the toggle', () => {
  const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8')
  assert.match(base, /<script is:inline set:html=\{THEME_BOOT\}/)
  assert.match(base, /class="theme-toggle"/)
})
