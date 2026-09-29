// Pure builders for the JSON-LD blocks (schema.org). A key whose value is
// missing (null, undefined or an empty string) is left out: a missing value
// beats a wrong one (ADR-0003). `url` comes from `canonicalUrl`, so it is
// null, and left out, until the site origin is set (ADR-0009).
import { BYLINE } from '../config/site.js'

const present = (v) => v !== null && v !== undefined && v !== ''

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => present(v)))
}

const isoDate = (d) => {
  if (!present(d)) return undefined
  const date = d instanceof Date ? d : new Date(d)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

// A Person for a player page. No image, birthDate or height: a headshot may
// 404 and the snapshot is not a source we vouch for here. `jobTitle` is the
// snapshot's `pos` (checked in src/data/org.json: players carry `pos`, such as
// "P" or "SS"; the page passes it only when it is not empty).
export function personLd({ name, url, jobTitle }) {
  return compact({ '@context': 'https://schema.org', '@type': 'Person', name, url, jobTitle })
}

// An Article for a post page. `datePublished` is the post's `date`;
// `dateModified` is its `updated`, which the post schemas do not have yet, so
// it is left out until they do. `author` is the byline string and defaults to
// BYLINE; with no byline there is no `author` field.
export function articleLd({ headline, description, datePublished, dateModified, url, author = BYLINE }) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    datePublished: isoDate(datePublished),
    dateModified: isoDate(dateModified),
    url,
    author: present(author) ? { '@type': 'Person', name: author } : undefined,
  })
}

// The text for a `<script type="application/ld+json">`. `<` and the two line
// separators are escaped, so a title such as `</script>` cannot end the tag.
export function jsonLdScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
