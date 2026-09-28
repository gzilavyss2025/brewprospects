import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isDraft,
  publishedPostPaths,
  lostPostPaths,
  parseCatFileBatch,
  postPathProblems,
} from '../scripts/checks/post-paths.mjs'

const post = (draft) => `---\ntitle: A post\ndate: 2026-09-28\ndraft: ${draft}\n---\nBody.\n`

test('a draft is read from the front matter only', () => {
  assert.equal(isDraft(post(true)), true)
  assert.equal(isDraft(post(false)), false)
  assert.equal(isDraft('---\r\ntitle: A\r\ndraft: true\r\n---\r\n'), true)
  assert.equal(isDraft('---\ntitle: A\n---\ndraft: true\n'), false)
  assert.equal(isDraft('no front matter'), false)
})

test('published paths skip drafts, player notes and other files', () => {
  const got = publishedPostPaths([
    { file: 'src/content/features/welcome.mdoc', text: post(false) },
    { file: 'src/content/guides/wip.mdoc', text: post(true) },
    { file: 'src/content/player-notes/jesus-made.mdoc', text: post(false) },
    { file: 'src/content/lists/notes.md', text: post(false) },
  ])
  assert.deepEqual([...got], ['/posts/features/welcome'])
})

test('a lost path fails unless it is retired', () => {
  const base = new Set(['/posts/features/a', '/posts/guides/b', '/posts/lists/c'])
  const head = new Set(['/posts/features/a', '/posts/features/b'])
  const problems = lostPostPaths(base, head, new Map([['/posts/lists/c', 'Test reason.']]))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /\/posts\/guides\/b is gone/)
  assert.deepEqual(lostPostPaths(base, new Set(), new Map()).length, 3)
})

test('cat-file batch output splits on byte sizes, not characters', () => {
  const a = 'Jesús Made\n'
  const b = 'plain'
  const buf = Buffer.concat([
    Buffer.from(`abc blob ${Buffer.byteLength(a)}\n${a}\n`),
    Buffer.from(`def blob ${Buffer.byteLength(b)}\n${b}\n`),
  ])
  assert.deepEqual(parseCatFileBatch(buf), [a, b])
  assert.throws(() => parseCatFileBatch(Buffer.from('src/x.mdoc missing\n')), /unexpected header/)
})

// End to end in a throwaway repo: publish a post on main, then rename it,
// set it to a draft, and delete it, as a branch might.
test('the check fails when a post published on main loses its path', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-paths-'))
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
  }
  try {
    git('init', '-q', '-b', 'main')
    mkdirSync(join(root, 'src/content/features'), { recursive: true })
    const file = join(root, 'src/content/features/welcome.mdoc')
    writeFileSync(file, post(false))
    writeFileSync(join(root, 'src/content/features/wip.mdoc'), post(true))
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'posts')

    assert.deepEqual(postPathProblems({ ref: 'main', root }), [])
    rmSync(join(root, 'src/content/features/wip.mdoc'))
    assert.deepEqual(postPathProblems({ ref: 'main', root }), [], 'a draft may go')

    renameSync(file, join(root, 'src/content/features/welcome-home.mdoc'))
    assert.match(postPathProblems({ ref: 'main', root })[0], /\/posts\/features\/welcome is gone/)
    renameSync(join(root, 'src/content/features/welcome-home.mdoc'), file)

    writeFileSync(file, post(true))
    assert.equal(postPathProblems({ ref: 'main', root }).length, 1)

    rmSync(file)
    assert.equal(postPathProblems({ ref: 'main', root }).length, 1)

    assert.match(postPathProblems({ ref: 'origin/main', root })[0], /cannot read origin\/main/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
