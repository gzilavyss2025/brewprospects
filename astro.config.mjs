// Static-first (docs/adr/0001): every page prerenders at build time. The only
// on-demand routes are Keystatic's editor at /keystatic and its API, which the
// integration injects with prerender: false; the Vercel adapter serves them.
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import markdoc from '@astrojs/markdoc'
import keystatic from '@keystatic/astro'
import vercel from '@astrojs/vercel'

// URL contract (docs/adr/0009): paths never end in a slash. SITE_URL is the
// public origin (for example https://example.com). It is unset until the
// domain is chosen, and then pages emit no canonical link rather than a
// wrong one.
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || undefined,
  trailingSlash: 'never',
  adapter: vercel(),
  integrations: [react(), markdoc(), keystatic()],
  server: { port: 4321 },
})
