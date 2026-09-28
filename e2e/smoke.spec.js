// A few routes load with no script error and no axe violation, in both
// themes. Third-party requests are blocked, so the pages must survive
// without MLB images, fonts or the live Stats API (ADR-0003).
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { STATIC } from './serve.mjs'

const pathMap = JSON.parse(readFileSync(join(STATIC, 'player-paths.json'), 'utf8'))
const org = JSON.parse(readFileSync(new URL('../src/data/org.json', import.meta.url), 'utf8'))
const pipeline = JSON.parse(readFileSync(new URL('../src/data/pipeline.json', import.meta.url), 'utf8'))

// Picked from the data, so a roster change never breaks the list.
const topProspect = pipeline.prospects.map((p) => pathMap[p.playerId]).find(Boolean)
const pastPlayer = Object.entries(pathMap).find(([id]) => !org.players[id])?.[1]
const postTypes = readdirSync(join(STATIC, 'posts'), { withFileTypes: true }).filter((d) => d.isDirectory())
const aPost = postTypes
  .flatMap((t) => readdirSync(join(STATIC, 'posts', t.name)).map((slug) => `/posts/${t.name}/${slug}`))
  .at(0)

const ROUTES = [
  '/',
  '/depth-chart',
  '/players',
  topProspect,
  pastPlayer,
  '/seasons',
  '/seasons/2019',
  '/prospects',
  '/posts',
  aPost,
  '/about',
].filter(Boolean)

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) =>
    route.request().url().startsWith(baseURL) ? route.continue() : route.abort(),
  )
})

// Uncaught errors, and console errors other than a blocked third-party load.
function watchErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text())
  })
  return errors
}

test('the route list covers a current player, a past player and a post', () => {
  expect(topProspect).toBeTruthy()
  expect(pastPlayer).toBeTruthy()
  expect(aPost).toBeTruthy()
})

for (const route of ROUTES) {
  for (const colorScheme of ['light', 'dark']) {
    test(`${route} loads with no error or axe violation (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      const errors = watchErrors(page)
      const res = await page.goto(route)
      expect(res.status()).toBe(200)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0].target}`)).toEqual([])
      expect(errors).toEqual([])
    })
  }
}

test('an unknown path gets the 404 page with status 404', async ({ page }) => {
  const res = await page.goto('/no-such-page')
  expect(res.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Page not found')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])
})

test('a stale player path leads to the current one (ADR-0009)', async ({ page }) => {
  const id = topProspect.match(/(\d+)$/)[1]
  await page.goto(`/players/an-old-name-${id}?from=test#stats`)
  await expect(page).toHaveURL(`${topProspect}?from=test#stats`)
  await page.goto(`/players/${id}`)
  await expect(page).toHaveURL(topProspect)
})

test('a player path with an unknown id stays on the 404 page', async ({ page }) => {
  await page.goto('/players/nobody-1')
  await expect(page.locator('h1')).toHaveText('Page not found')
  await expect(page).toHaveURL(/\/players\/nobody-1$/)
})
