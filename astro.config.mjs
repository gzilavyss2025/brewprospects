// Static-first (docs/adr/0001): every page prerenders at build time. The only
// on-demand routes are Keystatic's editor at /keystatic and its API, which the
// integration injects with prerender: false; the Vercel adapter serves them.
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import markdoc from '@astrojs/markdoc'
import keystatic from '@keystatic/astro'
import vercel from '@astrojs/vercel'
import sitemap from '@astrojs/sitemap'

// URL contract (docs/adr/0009): paths never end in a slash. SITE_URL is the
// public origin (for example https://example.com). It is unset until the
// domain is chosen, and then pages emit no canonical link rather than a
// wrong one.
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || undefined,
  trailingSlash: 'never',
  adapter: vercel(),
  // The sitemap needs `site`, so with SITE_URL unset it writes nothing
  // (roadmap Phase 1, item 1). The editor and the 404 page are not listed.
  integrations: [
    react(),
    markdoc(),
    keystatic(),
    sitemap({ filter: (page) => !/\/(keystatic|404)(\/|$)/.test(new URL(page).pathname) }),
  ],
  server: { port: 4321 },
})
