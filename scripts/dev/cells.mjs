#!/usr/bin/env node
// Rendered-cell dump and compare: proves a data or format change moved no
// number on any page (#62 step 5, and any change to how rows are stored).
// Build, dump, make the change, build again, dump again, diff:
//
//   node scripts/dev/cells.mjs dump dist/client before.json
//   node scripts/dev/cells.mjs diff before.json after.json
//
// A dump holds every table cell and every island prop string, per page. Two
// clean builds of the same commit give identical dumps (checked 2026-09-29:
// 2,069 pages, 588,175 cells).
//
// A page's cells are keyed "table#/row#": the cell texts joined by " | ". The
// diff reports pages added or removed, then each changed row, before and after.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const text = (html) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

function pages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) pages(p, out)
    else if (name.endsWith('.html')) out.push(p)
  }
  return out
}

function dumpPage(html) {
  const rows = {}
  ;[...html.matchAll(/<table[\s\S]*?<\/table>/g)].forEach(([table], t) => {
    ;[...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].forEach(([tr], r) => {
      rows[`t${t}/r${r}`] = [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => text(m[1])).join(' | ')
    })
  })
  // Island props hold build-time strings, such as the prospect card's snapshot line.
  ;[...html.matchAll(/<astro-island[^>]*\sprops="([^"]*)"/g)].forEach(([, props], i) => {
    rows[`island${i}`] = decode(props)
  })
  return rows
}

const [cmd, a, b] = process.argv.slice(2)
if (cmd === 'dump') {
  const out = {}
  for (const p of pages(a)) {
    const rows = dumpPage(readFileSync(p, 'utf8'))
    if (Object.keys(rows).length) out[relative(a, p).split(sep).join('/')] = rows
  }
  writeFileSync(b, JSON.stringify(out, null, 0))
  const cells = Object.values(out).reduce((n, rows) => n + Object.values(rows).reduce((m, r) => m + r.split(' | ').length, 0), 0)
  console.log(`${Object.keys(out).length} pages with tables, ${cells} cells -> ${b}`)
} else if (cmd === 'diff') {
  const before = JSON.parse(readFileSync(a, 'utf8'))
  const after = JSON.parse(readFileSync(b, 'utf8'))
  let changed = 0
  for (const page of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!before[page]) { console.log(`+ page ${page}`); continue }
    if (!after[page]) { console.log(`- page ${page}`); continue }
    for (const key of new Set([...Object.keys(before[page]), ...Object.keys(after[page])])) {
      if (before[page][key] === after[page][key]) continue
      changed++
      console.log(`${page} ${key}\n  before: ${before[page][key] ?? '(none)'}\n  after:  ${after[page][key] ?? '(none)'}`)
    }
  }
  console.log(changed ? `${changed} rows differ.` : 'No row differs.')
  process.exit(changed ? 1 : 0)
} else {
  console.error('Usage: cells.mjs dump <distDir> <out.json> | diff <before.json> <after.json>')
  process.exit(2)
}
