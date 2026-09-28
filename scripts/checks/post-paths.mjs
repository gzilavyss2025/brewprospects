// A published post keeps its path (ADR-0009). "Published" means a post that
// is on origin/main and not a draft, because every merge to main deploys.
// A branch that deletes such a post, renames its file (a Keystatic slug
// edit does this), moves it to another type or sets it back to a draft
// breaks a live link, and lint fails.
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from '../../src/lib/slug.js'
import { ROOT } from './paths.mjs'

// The post collections that have their own page. The folder name is the
// type in the path. Player notes have no page of their own.
export const POST_DIRS = ['recaps', 'features', 'lists', 'guides']

// A path listed here may leave the site. Each entry needs a reason, and the
// PR that adds it should say where the old link now goes, if anywhere.
export const RETIRED = new Map([
  // ['/posts/features/example', 'Why it went, and when.'],
])

// Keystatic writes the draft flag as a plain YAML boolean in the front matter.
export function isDraft(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text ?? ''))
  return Boolean(m && /^draft:\s*true\s*$/m.test(m[1]))
}

// `files` is a list of { file, text }, with `file` relative to the repo root
// ('src/content/features/x.mdoc'). Returns the public path of each post that
// is not a draft. The file name is the slug: Keystatic names files by slug,
// and the Astro glob loader takes the id from the file name.
export function publishedPostPaths(files) {
  const out = new Set()
  for (const { file, text } of files) {
    const m = /^src\/content\/([^/]+)\/(.+)\.mdoc$/.exec(file)
    if (!m || !POST_DIRS.includes(m[1]) || isDraft(text)) continue
    out.add(paths.post(m[1], m[2]))
  }
  return out
}

// One line per path that was published on the base and is gone now.
export function lostPostPaths(base, head, retired = RETIRED) {
  return [...base]
    .filter((p) => !head.has(p) && !retired.has(p))
    .sort()
    .map(
      (p) =>
        `Published post ${p} is gone or back to a draft. Public URLs are permanent (ADR-0009): ` +
        'restore its file and slug, or list it in RETIRED in scripts/checks/post-paths.mjs with a reason.',
    )
}

// Splits `git cat-file --batch` output into blob texts. Each entry is a
// header line "<sha> blob <size>", then <size> BYTES of content, then a
// newline. The size counts bytes, not characters, so this works on a Buffer.
export function parseCatFileBatch(buf) {
  const texts = []
  let at = 0
  while (at < buf.length) {
    const eol = buf.indexOf(0x0a, at)
    const header = buf.subarray(at, eol).toString('utf8')
    const m = /^\S+ blob (\d+)$/.exec(header)
    if (!m) throw new Error(`git cat-file: unexpected header "${header}"`)
    const size = Number(m[1])
    texts.push(buf.subarray(eol + 1, eol + 1 + size).toString('utf8'))
    at = eol + 1 + size + 1
  }
  return texts
}

function git(cwd, args, input) {
  return spawnSync('git', args, { cwd, input, maxBuffer: 256 * 1024 * 1024 })
}

// The post files at a git ref, as { file, text }. Null when the ref is not
// there (a shallow checkout that did not fetch main).
export function postFilesAt(ref, root = ROOT) {
  if (git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status !== 0) return null
  const ls = git(root, ['ls-tree', '-r', '--name-only', ref, '--', ...POST_DIRS.map((d) => `src/content/${d}`)])
  if (ls.status !== 0) throw new Error(`git ls-tree ${ref}: ${ls.stderr}`)
  const names = ls.stdout.toString('utf8').split('\n').filter((f) => f.endsWith('.mdoc'))
  if (!names.length) return []
  const cat = git(root, ['cat-file', '--batch'], names.map((f) => `${ref}:${f}`).join('\n') + '\n')
  if (cat.status !== 0) throw new Error(`git cat-file ${ref}: ${cat.stderr}`)
  const texts = parseCatFileBatch(cat.stdout)
  return names.map((file, i) => ({ file, text: texts[i] }))
}

// The post files in the working tree, as { file, text }.
export function postFilesOnDisk(root = ROOT) {
  return POST_DIRS.flatMap((dir) => {
    const abs = join(root, 'src/content', dir)
    if (!existsSync(abs)) return []
    return readdirSync(abs, { recursive: true })
      .map((f) => String(f).split('\\').join('/'))
      .filter((f) => f.endsWith('.mdoc'))
      .map((f) => ({ file: `src/content/${dir}/${f}`, text: readFileSync(join(abs, f), 'utf8') }))
  })
}

// The lint entry point. The base is origin/main unless POST_PATHS_BASE names
// another ref. A missing base is a problem, not a pass: CI must fetch main.
export function postPathProblems({ ref = process.env.POST_PATHS_BASE || 'origin/main', root = ROOT } = {}) {
  const base = postFilesAt(ref, root)
  if (!base) return [`Post path check cannot read ${ref}. Run "git fetch origin main".`]
  return lostPostPaths(publishedPostPaths(base), publishedPostPaths(postFilesOnDisk(root)))
}
