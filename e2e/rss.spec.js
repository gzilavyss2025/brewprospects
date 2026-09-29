// The RSS feed (roadmap Phase 1, item 3, ADR-0009): valid XML, at least one
// item, and every item link resolves through the build.
import { test, expect } from '@playwright/test'
import { STATIC, resolveStatic } from './serve.mjs'

test('/rss.xml is valid XML with items whose links resolve', async ({ page, request, baseURL }) => {
  const res = await request.get(`${baseURL}/rss.xml`)
  expect(res.status()).toBe(200)
  const xml = await res.text()

  const { hasParserError, itemLinks } = await page.evaluate((body) => {
    const doc = new DOMParser().parseFromString(body, 'application/xml')
    return {
      hasParserError: doc.getElementsByTagName('parsererror').length > 0,
      itemLinks: [...doc.querySelectorAll('item > link')].map((el) => el.textContent),
    }
  }, xml)

  expect(hasParserError).toBe(false)
  expect(itemLinks.length).toBeGreaterThan(0)

  for (const link of itemLinks) {
    const pathname = new URL(link).pathname
    expect(resolveStatic(STATIC, pathname).status, `${link} resolves`).toBe(200)
  }
})
