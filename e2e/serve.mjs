#!/usr/bin/env node
// Serves the built site the way Vercel does, for the smoke tests. It follows
// the routes in .vercel/output/config.json: a trailing slash gets a 308 to
// the path without it, a file or a folder's index.html is served, and any
// other path gets 404.html with status 404. The Keystatic function is not
// served; the smoke tests do not visit it.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, isAbsolute, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const STATIC = fileURLToPath(new URL('../.vercel/output/static/', import.meta.url))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
}

// What Vercel answers for `pathname`: { status, file } or { status, location }.
export function resolveStatic(root, pathname) {
  let path
  try {
    path = decodeURIComponent(pathname)
  } catch {
    return { status: 404, file: join(root, '404.html') }
  }
  if (path.length > 1 && path.endsWith('/')) return { status: 308, location: path.replace(/\/+$/, '') || '/' }
  const abs = join(root, path)
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) return { status: 404, file: join(root, '404.html') }
  if (existsSync(abs) && statSync(abs).isFile()) return { status: 200, file: abs }
  const index = join(abs, 'index.html')
  if (existsSync(index)) return { status: 200, file: index }
  return { status: 404, file: join(root, '404.html') }
}

export function serve(port, root = STATIC) {
  if (!existsSync(join(root, '404.html'))) throw new Error(`No build at ${root}. Run "npm run build" first.`)
  return createServer((req, res) => {
    const { pathname, search } = new URL(req.url, 'http://localhost')
    const hit = resolveStatic(root, pathname)
    if (hit.location) {
      res.writeHead(hit.status, { Location: hit.location + search }).end()
      return
    }
    res.writeHead(hit.status, { 'Content-Type': TYPES[extname(hit.file)] ?? 'application/octet-stream' })
    res.end(readFileSync(hit.file))
  }).listen(port, '127.0.0.1')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = Number(process.env.PORT ?? 4323)
  serve(port)
  console.log(`serving the build on http://127.0.0.1:${port}`)
}
