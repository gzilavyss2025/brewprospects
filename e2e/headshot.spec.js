// The headshot fallback chain on a real page: silo, then 67, then milb, then
// initials (src/lib/identity/headshot.js). Every third-party request is
// blocked unless a test serves a stand-in photo.
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STATIC } from './serve.mjs'

const pathMap = JSON.parse(readFileSync(join(STATIC, 'player-paths.json'), 'utf8'))
const org = JSON.parse(readFileSync(new URL('../src/data/org.json', import.meta.url), 'utf8'))

// Picked from the data: an org player who reached MLB, and one who did not.
const bigLeaguer = Object.values(org.players).find((p) => p.mlbDebutDate && pathMap[p.id])
const prospect = Object.values(org.players).find((p) => !p.mlbDebutDate && pathMap[p.id])

// A 1x1 PNG, so a served photo really decodes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

// Records each headshot request, serves a photo for the kinds in `serve`,
// and aborts every other third-party request.
async function routePhotos(page, baseURL, serve = []) {
  const asked = []
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith(baseURL)) return route.continue()
    const kind = url.match(/\/headshot\/(\w+)\/current$/)?.[1]
    if (kind) asked.push(kind)
    return serve.includes(kind) ? route.fulfill({ contentType: 'image/png', body: PNG }) : route.abort()
  })
  return asked
}

test('the data has a player of each kind', () => {
  expect(bigLeaguer).toBeTruthy()
  expect(prospect).toBeTruthy()
})

test('a player who reached MLB shows the silo shot first', async ({ page, baseURL }) => {
  const asked = await routePhotos(page, baseURL, ['silo'])
  await page.goto(pathMap[bigLeaguer.id])
  await expect(page.locator('img.headshot')).toHaveAttribute('src', /\/headshot\/silo\/current$/)
  expect(await page.locator('img.headshot').evaluate((img) => img.complete && img.naturalWidth)).toBe(1)
  expect(asked).toEqual(['silo'])
})

test('a missing silo shot falls back to the 67 shot', async ({ page, baseURL }) => {
  const asked = await routePhotos(page, baseURL, ['67', 'milb'])
  await page.goto(pathMap[bigLeaguer.id])
  await expect(page.locator('img.headshot')).toHaveAttribute('src', /\/headshot\/67\/current$/)
  await expect.poll(() => page.locator('img.headshot').evaluate((img) => img.naturalWidth)).toBe(1)
  expect(asked).toEqual(['silo', '67'])
})

test('missing silo and 67 shots fall back to the milb shot', async ({ page, baseURL }) => {
  const asked = await routePhotos(page, baseURL, ['milb'])
  await page.goto(pathMap[bigLeaguer.id])
  await expect(page.locator('img.headshot')).toHaveAttribute('src', /\/headshot\/milb\/current$/)
  await expect.poll(() => page.locator('img.headshot').evaluate((img) => img.naturalWidth)).toBe(1)
  expect(asked).toEqual(['silo', '67', 'milb'])
})

test('a player who never reached MLB skips the MLB shots', async ({ page, baseURL }) => {
  const asked = await routePhotos(page, baseURL, ['silo', '67', 'milb'])
  await page.goto(pathMap[prospect.id])
  await expect(page.locator('img.headshot')).toHaveAttribute('src', /\/headshot\/milb\/current$/)
  expect(asked).toEqual(['milb'])
})

test('when every photo fails, the initials show and no image is left', async ({ page, baseURL }) => {
  const asked = await routePhotos(page, baseURL)
  await page.goto(pathMap[bigLeaguer.id])
  const initials = bigLeaguer.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
  await expect(page.locator('.player-head .initials')).toHaveText(initials)
  await expect(page.locator('.player-head img')).toHaveCount(0)
  expect(asked).toEqual(['silo', '67', 'milb'])
})
