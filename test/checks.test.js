import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, posix, win32 } from 'node:path'
import { ROOT, relPath } from '../scripts/checks/paths.mjs'
import { checkContrastLines } from '../scripts/checks/contrast.mjs'
import { rawValueProblems } from '../scripts/checks/raw-values.mjs'
import { classShapeProblems } from '../scripts/checks/class-shape.mjs'

test('raw spacing and radius values fail in sheets and embedded styles', () => {
  const css = '.roster { padding: 6px 12px; gap: var(--space-2, 8px); margin-inline: -4px; border-start-start-radius: 14px; }'
  assert.equal(rawValueProblems('src/styles/example.css', css).length, 4)
  assert.equal(rawValueProblems('src/components/Example.astro', `<style>${css}</style>`).length, 4)
  assert.match(rawValueProblems('src/pages/example.astro', '<div\n style="padding: 16px">')[0], /:2 padding/)
  assert.equal(rawValueProblems('src/layouts/Example.astro', '<div style={`gap: 6px; margin: 8px`}>').length, 2)
  assert.equal(rawValueProblems('src/components/Example.jsx', '<div style={{ padding: "8px", borderRadius: "14px", width: "44px" }} />').length, 2)
})

test('raw-value guard allows small values, tokens, other units and border widths', () => {
  const css = '.roster { padding: 0 1px 2px var(--space-2); margin: .5em; gap: 1rem; border: 8px solid; width: 44px; font-size: 17px; border-radius: 50%; }'
  assert.deepEqual(rawValueProblems('src/styles/example.css', css), [])
  assert.deepEqual(rawValueProblems('src/styles/tokens.css', '.a { padding: 16px }'), [])
  assert.deepEqual(rawValueProblems('docs/example.css', '.a { padding: 16px }'), [])
  assert.deepEqual(rawValueProblems('src/pages/example.astro', '<!-- style="padding: 9px" --><p>padding: 8px</p>'), [])
  assert.deepEqual(rawValueProblems('src/styles/example.css', '/* padding: 8px */ .a { --padding: 8px }'), [])
})

test('raw-value guard handles longhands, fractions, negatives and Windows paths', () => {
  const css = '.a { padding-block-start: calc(100% - 8px); column-gap: .5px; margin-bottom: -1px; border-top-left-radius: 9PX }'
  assert.equal(rawValueProblems('src\\styles\\example.css', css).length, 4)
  assert.equal(rawValueProblems('src/pages/example.astro', "<div style='margin: 4px; padding: 8px'>").length, 2)
  assert.equal(rawValueProblems('src/pages/example.astro', '<div style={"padding: 8px"}>').length, 1)
  assert.equal(rawValueProblems('src/pages/example.astro', '<div style={`padding: ${wide ? "8px" : "4px"}; gap: 6px`}>').length, 2)
  assert.equal(rawValueProblems('src/styles/example.css', '.a { PADDING: 8PX }').length, 1)
})

test('the lint runner rejects a raw value in a nested source folder', () => {
  const dir = mkdtempSync(join(ROOT, 'src/styles/raw-value-test-'))
  try {
    writeFileSync(join(dir, 'fixture.css'), '.roster { padding: 7px; }\n')
    const run = spawnSync(process.execPath, ['scripts/checks/run-all.mjs'], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(run.status, 1)
    assert.match(run.stderr, /fixture\.css:1 padding has raw px \(7px\)/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a shape word matches a class as a whole name', () => {
  const problems = classShapeProblems('src/components/Example.astro', '<div class="notice" />')
  assert.equal(problems.length, 1)
  assert.match(problems[0], /class "notice" carries the shape word "notice" \(no class may carry it yet\)/)
})

test('a shape word matches a class as a hyphen segment', () => {
  const problems = classShapeProblems('src/components/Example.astro', '<div class="club-notice" />')
  assert.equal(problems.length, 1)
  assert.match(problems[0], /class "club-notice" carries the shape word "notice"/)
})

test('a shape word matches a class as a suffix, even when another class owns it', () => {
  const problems = classShapeProblems('src/styles/example.css', '.eventcard { color: red; }')
  assert.equal(problems.length, 1)
  assert.match(problems[0], /class "eventcard" carries the shape word "card" \(only \.card may carry it\)/)
})

test('a shape word inside an unrelated word does not match', () => {
  assert.deepEqual(classShapeProblems('src/styles/example.css', '.pillar { color: red; }'), [])
  assert.deepEqual(classShapeProblems('src/components/Example.astro', '<p class="postage">x</p>'), [])
})

test('the owners of card and pennant pass, as a selector or an attribute', () => {
  assert.deepEqual(classShapeProblems('src/styles/example.css', '.card { } .pennant { }'), [])
  assert.deepEqual(classShapeProblems('src/components/Example.astro', '<a class="card pennant" />'), [])
})

test('a comment and Astro frontmatter are ignored', () => {
  assert.deepEqual(classShapeProblems('src/styles/example.css', '/* .notice { color: red; } */'), [])
  const astro = '---\nconst label = p.data.notice;\n---\n<p>{label}</p>'
  assert.deepEqual(classShapeProblems('src/components/Example.astro', astro), [])
})

test('a className: string is read', () => {
  const onerror = "onerror={`this.replaceWith(Object.assign(document.createElement('div'),{className:'club-notice'}))`}"
  const problems = classShapeProblems('src/components/Example.astro', `<img ${onerror} />`)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /class "club-notice" carries the shape word "notice"/)
})

test('a className: string in src/lib/ is read (the headshot onerror handler)', () => {
  const handler = "export const h = `{className:'photo-chip'}`"
  const problems = classShapeProblems('src/lib/identity/example.js', handler)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /class "photo-chip" carries the shape word "chip"/)
})

test('the lint runner rejects a shape-word class in a nested source folder', () => {
  const dir = mkdtempSync(join(ROOT, 'src/styles/class-shape-test-'))
  try {
    writeFileSync(join(dir, 'fixture.css'), '.stat-card { color: red; }\n')
    const run = spawnSync(process.execPath, ['scripts/checks/run-all.mjs'], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(run.status, 1)
    assert.match(run.stderr, /fixture\.css:1 class "stat-card" carries the shape word "card"/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ROOT is the repo folder on this platform', () => {
  // `new URL(...).pathname` gave '/C:/...' on Windows, and every check
  // read a path that did not exist.
  assert.ok(existsSync(join(ROOT, 'package.json')))
})

test('relPath gives forward slashes for a Windows path', () => {
  assert.equal(relPath('C:\\repo\\', 'C:\\repo\\src\\lib\\org.js', win32), 'src/lib/org.js')
})

test('relPath leaves a POSIX path as it is', () => {
  assert.equal(relPath('/repo/', '/repo/src/lib/org.js', posix), 'src/lib/org.js')
})

test('every PAIRS and FOCUS line in tokens.css passes in both themes', () => {
  // The ring was gold: 1.47:1 on paper, and invisible on the gold header.
  const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8')
  assert.deepEqual(checkContrastLines(css), [])
})

// A two-theme tokens.css in miniature. Both themes pass as written.
const LINES = '/* PAIRS: text-ink/surface-paper */ /* FOCUS: focus-ring|focus-halo/surface-paper */ /* GRAPHIC: chart-band-low/surface-paper */'
const LIGHT = { 'surface-paper': '#fbf6e9', 'text-ink': '#12284b', 'focus-ring': '#12284b', 'focus-halo': 'var(--surface-paper)', 'chart-band-low': '#7e8ba3' }
const DARK = { 'surface-paper': '#080f1b', 'text-ink': '#fbf6e9', 'focus-ring': '#fbf6e9', 'focus-halo': 'var(--surface-paper)', 'chart-band-low': '#667590' }
const block = (vars) => Object.entries(vars).map(([k, v]) => `--${k}: ${v};`).join(' ')
const themed = ({ light = LIGHT, dark = DARK, lines = LINES } = {}) =>
  `${lines}\n:root { ${block(light)} }\n[data-theme="dark"] { ${block(dark)} }\n`

test('two passing themes, with var() links, pass', () => {
  assert.deepEqual(checkContrastLines(themed()), [])
})

test('a gold focus ring on paper fails the FOCUS line', () => {
  const lines = '/* PAIRS: text-ink/surface-paper */ /* FOCUS: brand-gold/surface-paper */'
  const css = themed({ light: { ...LIGHT, 'brand-gold': '#ffc52f' }, dark: { ...DARK, 'brand-gold': '#ffc52f' }, lines })
  assert.match(checkContrastLines(css).join('\n'), /FOCUS pair brand-gold\/surface-paper is 1\.\d\d:1 in light/)
})

test('a failing dark text pair fails even when light passes', () => {
  const problems = checkContrastLines(themed({ dark: { ...DARK, 'text-ink': '#1b2436' } }))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /PAIRS pair text-ink\/surface-paper is 1\.\d\d:1 in dark/)
})

test('passing dark values cannot hide a failing light pair', () => {
  // The old check read every `--x: #hex` in the file into one map, so the
  // dark block's later --text-ink won and this light failure passed.
  const problems = checkContrastLines(themed({ light: { ...LIGHT, 'text-ink': '#f0ead8' } }))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /PAIRS pair text-ink\/surface-paper is 1\.\d\d:1 in light/)
})

test('the dark focus ring is checked', () => {
  const problems = checkContrastLines(themed({ dark: { ...DARK, 'focus-ring': '#12284b' } }))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /FOCUS pair focus-ring\|focus-halo\/surface-paper is 1\.\d\d:1 in dark/)
})

test('a missing theme block fails', () => {
  const css = `${LINES}\n:root { ${block(LIGHT)} }\n`
  assert.deepEqual(checkContrastLines(css), ['tokens.css has no [data-theme="dark"] block (dark theme).'])
})

test('a role missing from one theme fails; it is not read from the other', () => {
  const dark = { ...DARK }
  delete dark['text-ink']
  const problems = checkContrastLines(themed({ dark })).join('\n')
  assert.match(problems, /--text-ink does not resolve to a hex color in \[data-theme="dark"\]/)
  assert.match(problems, /PAIRS pair text-ink\/surface-paper in dark: --text-ink does not resolve/)
})

test('a token that does not resolve to a hex fails', () => {
  for (const bad of ['var(--nope)', 'navy', '#fff', 'var(--focus-halo)']) {
    const problems = checkContrastLines(themed({ light: { ...LIGHT, 'focus-halo': bad } })).join('\n')
    assert.match(problems, /--focus-halo does not resolve to a hex color/, bad)
  }
})

test('a missing check line fails', () => {
  const problems = checkContrastLines(themed({ lines: '/* PAIRS: text-ink/surface-paper */' }))
  assert.deepEqual(problems, ['tokens.css has no FOCUS line to check.', 'tokens.css has no GRAPHIC line to check.'])
})

test('a missing GRAPHIC line fails', () => {
  const lines = '/* PAIRS: text-ink/surface-paper */ /* FOCUS: focus-ring|focus-halo/surface-paper */'
  assert.deepEqual(checkContrastLines(themed({ lines })), ['tokens.css has no GRAPHIC line to check.'])
})

test('a chart color too close to its surface fails the GRAPHIC line', () => {
  // Non-text contrast is 3:1 (WCAG 1.4.11). Pale slate on paper is under it.
  const problems = checkContrastLines(themed({ light: { ...LIGHT, 'chart-band-low': '#c9d1e0' } }))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /GRAPHIC pair chart-band-low\/surface-paper is 1\.\d\d:1 in light \(needs 3:1\)/)
})

test('a dark chart color too close to its surface fails even when light passes', () => {
  const problems = checkContrastLines(themed({ dark: { ...DARK, 'chart-band-low': '#1b2a44' } }))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /GRAPHIC pair chart-band-low\/surface-paper is 1\.\d\d:1 in dark/)
})

test('a chart token missing from the dark block fails; chart colors may differ by theme', () => {
  assert.deepEqual(checkContrastLines(themed()), [])
  const dark = { ...DARK }
  delete dark['chart-band-low']
  const problems = checkContrastLines(themed({ dark })).join('\n')
  assert.match(problems, /--chart-band-low does not resolve to a hex color in \[data-theme="dark"\]/)
  assert.match(problems, /GRAPHIC pair chart-band-low\/surface-paper in dark: --chart-band-low does not resolve/)
})

test('a GRAPHIC mention in prose does not stand in for the line', () => {
  // The check reads the first `GRAPHIC:` in the file, so prose must not say it.
  const css = themed().replace('/* GRAPHIC: chart-band-low/surface-paper */', '/* the graphic line is below */')
  assert.deepEqual(checkContrastLines(css), ['tokens.css has no GRAPHIC line to check.'])
})

test('every chart token in tokens.css is on the GRAPHIC line against paper and card', () => {
  const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8')
  const line = /GRAPHIC:([^*]*)\*\//.exec(css)[1].trim().split(/\s+/)
  const names = [...css.matchAll(/--(chart-[\w-]+):/g)].map((m) => m[1])
  const expected = [...new Set(names)].flatMap((n) => [`${n}/surface-paper`, `${n}/surface-card`])
  assert.equal(expected.length, 12)
  assert.deepEqual([...line].sort(), expected.sort())
})

test('brand and club colors may not change between themes', () => {
  const css = themed({ light: { ...LIGHT, 'brand-navy': '#12284b' }, dark: { ...DARK, 'brand-navy': '#2a4a7b' } })
  assert.match(checkContrastLines(css).join('\n'), /--brand-navy changes between themes/)
})

test('schemaProblems names a field only one side declares', async () => {
  const { schemaProblems } = await import('../scripts/checks/content-config.mjs')
  const ks = { recaps: { title: 1, period: 1, body: 1 }, notes: { player: 1 } }
  const astro = { recaps: { title: 1 } }
  assert.deepEqual(schemaProblems(ks, astro), [
    'recaps.period is in Keystatic but not in src/content.config.js.',
    'Collection "notes" is only in keystatic.config.jsx.',
  ])
})

test('the real Keystatic and Astro content configs match', async () => {
  const { loadContentConfigs, schemaProblems } = await import('../scripts/checks/content-config.mjs')
  const { keystatic, astro } = await loadContentConfigs()
  const schemas = Object.fromEntries(Object.entries(keystatic).map(([k, v]) => [k, v.schema]))
  const shapes = Object.fromEntries(Object.entries(astro).map(([k, v]) => [k, v.schema.shape]))
  assert.deepEqual(schemaProblems(schemas, shapes), [])
})

test('clubListProblems catches the old six-club guide list', async () => {
  const { clubListProblems } = await import('../scripts/checks/content-config.mjs')
  const affiliates = [{ id: 2101, name: 'DSL Brewers Gold' }, { id: 607, name: 'DSL Brewers Blue' }]
  const options = [{ label: 'DSL Brewers (Dominican complex)', value: '2101' }]
  assert.deepEqual(clubListProblems(options, affiliates), [
    'Guide club 2101 is labeled "DSL Brewers (Dominican complex)"; it is DSL Brewers Gold.',
    'Guide club list is missing DSL Brewers Blue (607).',
  ])
})

test('two ADRs with one number are caught; gaps are fine', async () => {
  const { adrNumberProblems } = await import('../scripts/checks/docs.mjs')
  assert.deepEqual(adrNumberProblems(['0001-a.md', '0003-b.md']), [])
  assert.equal(adrNumberProblems(['0008-a.md', '0008-b.md', 'README.md']).length, 1)
})

test('the word list catches the other word, and an exempt line passes', async () => {
  const { wordProblems } = await import('../scripts/checks/docs.mjs')
  const other = ['play', 'offs'].join('')
  assert.deepEqual(wordProblems('a.md', `The ${other} start.`), [`a.md:1 says "${other}". Say "postseason".`])
  assert.deepEqual(wordProblems('a.md', `Best ${other} award <!-- word-choice-exempt: a real award -->`), [])
  assert.deepEqual(wordProblems('a.md', 'The postseason starts.'), [])
})
