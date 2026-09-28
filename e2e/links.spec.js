// Every internal link and asset in the build resolves. No browser: this reads
// the HTML files, so it covers all ~2,000 pages in a few seconds.
import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { STATIC, resolveStatic } from './serve.mjs'

const ATTR = /\s(?:href|src)="([^"]*)"/g

// Root-relative targets only: "/x", not "//cdn" or "https://...".
export function internalTargets(html) {
  return [...html.matchAll(ATTR)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((u) => u.startsWith('/') && !u.startsWith('//'))
    .map((u) => u.split(/[?#]/)[0] || '/')
}

test('no internal link or asset in the build is broken', () => {
  const pages = readdirSync(STATIC, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.html'))
  expect(pages.length).toBeGreaterThan(1000)
  const broken = new Map()
  const seen = new Map()
  for (const page of pages) {
    for (const target of internalTargets(readFileSync(join(STATIC, page), 'utf8'))) {
      if (!seen.has(target)) seen.set(target, resolveStatic(STATIC, target).status)
      if (seen.get(target) !== 200) broken.set(target, [...(broken.get(target) ?? []), page])
    }
  }
  const report = [...broken].map(([t, from]) => `${t} (${seen.get(t)}), from ${from.length} pages, e.g. ${from[0]}`)
  expect(report).toEqual([])
  expect(seen.size).toBeGreaterThan(1000)
})
