import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { headMeta, robotsTxt } from '../src/lib/seo.js'
import { paths } from '../src/lib/slug.js'

const SITE = new URL('https://example.test')
const args = { path: '/players/jesus-made-815908', title: 'Jesús Made · Site', description: 'A page.' }

// The value of a meta tag, or a link's href, by its key.
const meta = (out, key) => out.meta.find((m) => (m.property ?? m.name) === key)?.content
const link = (out, rel) => out.links.find((l) => l.rel === rel)?.href

test('headMeta without a site emits no absolute URL', () => {
  const out = headMeta({ site: undefined, ...args })
  assert.equal(meta(out, 'description'), 'A page.')
  assert.equal(meta(out, 'og:title'), 'Jesús Made · Site')
  assert.equal(meta(out, 'og:description'), 'A page.')
  assert.equal(meta(out, 'og:type'), 'website')
  for (const key of ['og:url', 'og:image', 'twitter:card']) assert.equal(meta(out, key), undefined, key)
  assert.equal(link(out, 'canonical'), undefined)
  assert.doesNotMatch(JSON.stringify(out), /https?:|undefined|null/)
})

test('headMeta with a site adds the canonical link, og:url, og:image and the card', () => {
  const out = headMeta({ site: SITE, ...args })
  const url = 'https://example.test/players/jesus-made-815908'
  assert.equal(link(out, 'canonical'), url)
  assert.equal(meta(out, 'og:url'), url)
  assert.equal(meta(out, 'og:image'), 'https://example.test/og-image.png')
  assert.equal(meta(out, 'twitter:card'), 'summary_large_image')
})

test('headMeta takes the type, and a site given as a string', () => {
  assert.equal(meta(headMeta({ site: 'https://example.test', ...args, type: 'article' }), 'og:type'), 'article')
  assert.equal(meta(headMeta({ site: 'https://example.test', ...args }), 'og:image'), 'https://example.test/og-image.png')
})

test('headMeta keeps the home page path and drops a trailing slash', () => {
  assert.equal(link(headMeta({ site: SITE, ...args, path: '/' }), 'canonical'), 'https://example.test/')
  assert.equal(link(headMeta({ site: SITE, ...args, path: '/posts/' }), 'canonical'), 'https://example.test/posts')
})

test('robotsTxt allows all and names the sitemap only when a site is set', () => {
  assert.equal(robotsTxt(undefined), 'User-agent: *\nAllow: /\n')
  assert.equal(
    robotsTxt(SITE),
    'User-agent: *\nAllow: /\n\nSitemap: https://example.test/sitemap-index.xml\n',
  )
  assert.doesNotMatch(robotsTxt(undefined), /Sitemap/)
})

test('the new paths are data and asset files', () => {
  assert.equal(paths.ogImage(), '/og-image.png')
  assert.equal(paths.sitemapIndex(), '/sitemap-index.xml')
  assert.equal(paths.robots(), '/robots.txt')
})

test('the OG image is a 1200 by 630 PNG', () => {
  const png = readFileSync(new URL('../public/og-image.png', import.meta.url))
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG')
  assert.equal(png.readUInt32BE(16), 1200)
  assert.equal(png.readUInt32BE(20), 630)
})
