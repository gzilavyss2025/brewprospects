import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personLd, articleLd, jsonLdScript } from '../src/lib/jsonld.js'
import { canonicalUrl, paths } from '../src/lib/slug.js'
import { BYLINE } from '../src/config/site.js'

const SITE = new URL('https://example.test')
const path = paths.post('features', 'a-post')

test('personLd builds a Person and drops every missing key', () => {
  assert.deepEqual(personLd({ name: 'Jesús Made', url: 'https://example.test/p', jobTitle: 'SS' }), {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Jesús Made',
    url: 'https://example.test/p',
    jobTitle: 'SS',
  })
  for (const empty of [null, undefined, '']) {
    const out = personLd({ name: 'Jesús Made', url: empty, jobTitle: empty })
    assert.deepEqual(Object.keys(out), ['@context', '@type', 'name'])
  }
})

test('personLd never carries an image, birth date or height (ADR-0003)', () => {
  const out = personLd({ name: 'A', url: 'https://x.test/', jobTitle: 'P', image: 'i', birthDate: 'd', height: 'h' })
  for (const key of ['image', 'birthDate', 'height']) assert.equal(key in out, false, key)
})

test('articleLd builds an Article and drops every missing key', () => {
  const out = articleLd({
    headline: 'A post',
    description: 'About it.',
    datePublished: new Date('2026-05-01T00:00:00Z'),
    dateModified: new Date('2026-05-02T00:00:00Z'),
    url: 'https://example.test/posts/features/a-post',
    author: 'Pat Writer',
  })
  assert.deepEqual(out, {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'A post',
    description: 'About it.',
    datePublished: '2026-05-01T00:00:00.000Z',
    dateModified: '2026-05-02T00:00:00.000Z',
    url: 'https://example.test/posts/features/a-post',
    author: { '@type': 'Person', name: 'Pat Writer' },
  })
  const bare = articleLd({ headline: 'A post', description: '', datePublished: undefined, dateModified: null, url: null, author: '' })
  assert.deepEqual(Object.keys(bare), ['@context', '@type', 'headline'])
})

test('articleLd takes its author from BYLINE, and omits it while BYLINE is empty', () => {
  const out = articleLd({ headline: 'A post' })
  if (BYLINE === '') assert.equal('author' in out, false)
  else assert.deepEqual(out.author, { '@type': 'Person', name: BYLINE })
})

test('the url is set only when the site origin is set', () => {
  const withSite = personLd({ name: 'A', url: canonicalUrl(SITE, path) })
  assert.equal(withSite.url, 'https://example.test/posts/features/a-post')
  const without = articleLd({ headline: 'A', url: canonicalUrl(undefined, path) })
  assert.equal('url' in without, false)
  assert.doesNotMatch(JSON.stringify(without), /https?:\/\/(?!schema\.org)/)
})

test('jsonLdScript keeps a hostile title from ending the script tag', () => {
  const title = '</script><script>alert(1)</script> \u2028 \u2029'
  const text = jsonLdScript(articleLd({ headline: title }))
  assert.doesNotMatch(text, /<|\u2028|\u2029/)
  assert.equal(JSON.parse(text).headline, title)
})
