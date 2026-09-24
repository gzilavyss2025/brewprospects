// Static-first (docs/adr/0001): every page prerenders at build time. The only
// on-demand routes are Keystatic's editor at /keystatic and its API, which the
// integration injects with prerender: false; the Vercel adapter serves them.
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import markdoc from '@astrojs/markdoc'
import keystatic from '@keystatic/astro'
import vercel from '@astrojs/vercel'

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  integrations: [react(), markdoc(), keystatic()],
  server: { port: 4321 },
})
