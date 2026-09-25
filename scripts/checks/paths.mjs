// Path helpers for the structural checks. The checks compare paths as
// POSIX strings ('src/lib/x.js'), so Windows paths must be converted first.
// `new URL(...).pathname` is not a file path on Windows ('/C:/...'), so the
// root comes from fileURLToPath.
import { posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

// The path of `file` under `root`, with forward slashes on every platform.
// `path` defaults to the platform's own module; tests pass `node:path`'s
// win32 to check the Windows case on any machine.
export function relPath(root, file, path = { relative, sep }) {
  const rel = path.relative(root, file)
  return path.sep === posix.sep ? rel : rel.split(path.sep).join(posix.sep)
}
