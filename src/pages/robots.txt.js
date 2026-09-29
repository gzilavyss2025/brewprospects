// A route, not public/robots.txt: a static file cannot depend on SITE_URL.
// Prerendered like every other page (ADR-0001).
import { robotsTxt } from '../lib/seo.js'

export function GET({ site }) {
  return new Response(robotsTxt(site), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
