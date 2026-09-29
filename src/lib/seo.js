// Pure builders for the head tags and robots.txt. `site` is Astro's `site`
// (a URL or a string) and is unset until the domain is chosen. With no site,
// nothing here emits an absolute URL: a wrong one is worse than none
// (ADR-0003, ADR-0009).
import { canonicalUrl, paths } from './slug.js'

const absolute = (site, path) => new URL(path, site).href

// The description, Open Graph and canonical tags for one page. Returns
// `{ meta, links }`; the title tag stays in the layout.
export function headMeta({ site, path, title, description, type = 'website' }) {
  const meta = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: type },
  ]
  const links = []
  const canonical = canonicalUrl(site, path)
  if (canonical) {
    links.push({ rel: 'canonical', href: canonical })
    meta.push({ property: 'og:url', content: canonical })
    meta.push({ property: 'og:image', content: absolute(site, paths.ogImage()) })
    meta.push({ name: 'twitter:card', content: 'summary_large_image' })
  }
  return { meta, links }
}

// Everyone may crawl everything. The Sitemap line needs an absolute URL, so
// it appears only when the site origin is set.
export function robotsTxt(site) {
  const lines = ['User-agent: *', 'Allow: /']
  if (site) lines.push('', `Sitemap: ${absolute(site, paths.sitemapIndex())}`)
  return `${lines.join('\n')}\n`
}
