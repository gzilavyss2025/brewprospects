// The static SEO pack (roadmap Phase 1, item 1). Reads the built files, so it
// needs no browser page. What a page must carry depends on SITE_URL: with it
// unset there is no absolute URL anywhere (ADR-0003, ADR-0009). CI builds and
// checks both cases.
import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { STATIC } from './serve.mjs'

const SITE = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : null

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  )
}

// The attributes of every <tag ...> in the page, as objects.
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name} ([^>]*)>`, 'g'))].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])),
  )
}

const files = htmlFiles(STATIC)
const sitemaps = readdirSync(STATIC).filter((f) => /^sitemap.*\.xml$/.test(f))
const urlsIn = (file) => [...readFileSync(join(STATIC, file), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

test('the build has pages to check', () => {
  expect(files.length).toBeGreaterThan(10)
})

for (const file of files) {
  const name = relative(STATIC, file).split(sep).join('/')
  test(`${name} has its head tags`, () => {
    const html = readFileSync(file, 'utf8')
    const meta = tags(html, 'meta')
    const content = (key) => meta.find((m) => (m.property ?? m.name) === key)?.content
    const canonical = tags(html, 'link').find((l) => l.rel === 'canonical')?.href

    expect(html.match(/<title>([^<]*)<\/title>/)?.[1].trim(), 'title').toBeTruthy()
    for (const key of ['description', 'og:title', 'og:description', 'og:type']) {
      expect(content(key)?.trim(), key).toBeTruthy()
    }

    if (SITE) {
      const image = content('og:image')
      expect(image.startsWith(`${SITE}/`), 'og:image starts with the origin').toBe(true)
      expect(image.endsWith('/og-image.png'), 'og:image ends with /og-image.png').toBe(true)
      expect(content('twitter:card')).toBe('summary_large_image')
      expect(canonical, 'canonical').toBeTruthy()
    } else {
      for (const key of ['og:image', 'twitter:card', 'og:url']) expect(content(key), key).toBeUndefined()
      expect(canonical, 'canonical').toBeUndefined()
    }
  })
}

test('robots.txt allows all, and names the sitemap only when the site is set', () => {
  const robots = readFileSync(join(STATIC, 'robots.txt'), 'utf8')
  expect(robots).toContain('User-agent: *\nAllow: /')
  if (SITE) expect(robots).toContain(`Sitemap: ${SITE}/sitemap-index.xml`)
  else expect(robots).not.toMatch(/sitemap/i)
})

test('the OG image is in the build', () => {
  expect(existsSync(join(STATIC, 'og-image.png'))).toBe(true)
})

test('the sitemap exists only when the site is set, and follows ADR-0009', () => {
  if (!SITE) {
    expect(sitemaps).toEqual([])
    return
  }
  expect(sitemaps).toContain('sitemap-index.xml')
  const urls = sitemaps.flatMap(urlsIn)
  expect(urls.length).toBeGreaterThan(10)
  for (const url of urls) {
    expect(url.startsWith(`${SITE}/`), url).toBe(true)
    expect(url, url).not.toMatch(/undefined|\/keystatic|\/404$/)
    expect(url === `${SITE}/` || !url.endsWith('/'), `${url} has no trailing slash`).toBe(true)
  }
  expect(urls).toContain(`${SITE}/`)
  expect(urls).toContain(`${SITE}/depth-chart`)
})

// JSON-LD: every block parses; a player page has a Person and a post page an
// Article. The Article has an author only when BYLINE is set.
const ldBlocks = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  )
const byType = (blocks, type) => blocks.find((b) => b['@type'] === type)

for (const file of files) {
  const name = relative(STATIC, file).split(sep).join('/')
  test(`${name} has JSON-LD that parses`, () => {
    for (const block of ldBlocks(file)) expect(block['@context']).toBe('https://schema.org')
  })
}

const pageMatching = (re) => files.find((f) => re.test(relative(STATIC, f).split(sep).join('/')))

test('a player page has a Person with a name', () => {
  const file = pageMatching(/^players\/[^/]+\/index\.html$/)
  const person = byType(ldBlocks(file), 'Person')
  expect(person?.name).toBeTruthy()
  for (const key of ['image', 'birthDate', 'height']) expect(person, key).not.toHaveProperty(key)
  if (SITE) expect(person.url.startsWith(`${SITE}/players/`)).toBe(true)
  else expect(person).not.toHaveProperty('url')
})

test('a post page has an Article with a headline, and an author only when BYLINE is set', () => {
  const file = pageMatching(/^posts\/[^/]+\/[^/]+\/index\.html$/)
  const article = byType(ldBlocks(file), 'Article')
  expect(article?.headline).toBeTruthy()
  const byline = /export const BYLINE = '([^']*)'/.exec(readFileSync('src/config/site.js', 'utf8'))[1]
  if (byline) expect(article.author).toEqual({ '@type': 'Person', name: byline })
  else expect(article).not.toHaveProperty('author')
  if (!SITE) expect(article).not.toHaveProperty('url')
})
