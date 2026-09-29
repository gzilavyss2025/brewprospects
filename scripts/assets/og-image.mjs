#!/usr/bin/env node
// Renders public/og-image.png (1200 by 630), the one share image for every
// page. Run it by hand ("npm run og-image") and commit the PNG. It never runs
// in the build and never in a function (roadmap Phase 1, item 1). It uses the
// Brewers navy and gold and the site name and tagline, and no MLB logo or
// other MLB asset (open decision 2).
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { SITE_NAME, SITE_TAGLINE } from '../../src/config/site.js'
import { BREWERS } from '../../src/lib/identity/affiliates.js'

const OUT = fileURLToPath(new URL('../../public/og-image.png', import.meta.url))
const SIZE = { width: 1200, height: 630 }

const escape = (text) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

// System fonts only: the render must not need the network.
function ogHtml({ name, tagline, navy, gold }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${SIZE.width}px; height: ${SIZE.height}px; background: ${navy}; color: #fff;
    font-family: Georgia, 'Times New Roman', serif; display: flex; flex-direction: column;
    justify-content: center; padding: 0 96px; border-bottom: 24px solid ${gold}; }
  h1 { color: ${gold}; font-size: 128px; line-height: 1.05; font-weight: 700; }
  p { font-size: 48px; line-height: 1.3; margin-top: 32px; max-width: 900px; }
</style></head><body><h1>${escape(name)}</h1><p>${escape(tagline)}</p></body></html>`
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: SIZE })
  await page.setContent(
    ogHtml({ name: SITE_NAME, tagline: SITE_TAGLINE, navy: BREWERS.navy, gold: BREWERS.gold }),
  )
  await page.screenshot({ path: OUT, type: 'png' })
} finally {
  await browser.close()
}
console.log(`wrote ${OUT}`)
