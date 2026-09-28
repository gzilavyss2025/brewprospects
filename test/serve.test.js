import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveStatic } from '../e2e/serve.mjs'

// The smoke tests trust this to answer as Vercel does, so a link it calls
// good is good on the live site.
test('the smoke-test server answers the way the Vercel routes do', () => {
  const root = mkdtempSync(join(tmpdir(), 'serve-'))
  try {
    mkdirSync(join(root, 'players/jesus-made-815908'), { recursive: true })
    writeFileSync(join(root, 'index.html'), 'home')
    writeFileSync(join(root, '404.html'), 'missing')
    writeFileSync(join(root, 'player-paths.json'), '{}')
    writeFileSync(join(root, 'players/jesus-made-815908/index.html'), 'page')
    assert.deepEqual(resolveStatic(root, '/'), { status: 200, file: join(root, 'index.html') })
    assert.deepEqual(resolveStatic(root, '/players/jesus-made-815908'), { status: 200, file: join(root, 'players/jesus-made-815908/index.html') })
    assert.equal(resolveStatic(root, '/player-paths.json').status, 200)
    assert.deepEqual(resolveStatic(root, '/players/jesus-made-815908/'), { status: 308, location: '/players/jesus-made-815908' })
    assert.deepEqual(resolveStatic(root, '/players/old-name-815908'), { status: 404, file: join(root, '404.html') })
    assert.equal(resolveStatic(root, '/players').status, 404, 'a folder with no index.html is not a page')
    assert.equal(resolveStatic(root, '/../outside.html').status, 404)
    assert.equal(resolveStatic(root, '/%E0').status, 404)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
