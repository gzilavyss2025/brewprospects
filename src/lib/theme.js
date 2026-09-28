// Which color theme a page shows (ADR-0013). The reader's stored choice wins;
// with none, the OS setting decides. Without JavaScript the page stays light.
// The theme is a `data-theme` attribute on <html>; tokens.css does the rest.

export const THEME_KEY = 'theme'

// Self-contained on purpose: THEME_BOOT inlines its source into the page head,
// so it may not use any name from this module.
export function resolveTheme(stored, prefersDark) {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}

export function nextTheme(current) {
  return current === 'dark' ? 'light' : 'dark'
}

// Runs in <head> before first paint, so a dark page never flashes light.
// Storage can throw (private windows, blocked site data); the OS setting
// still applies then.
function boot(key, resolve) {
  let stored = null
  try { stored = localStorage.getItem(key) } catch { /* no storage: use the OS setting */ }
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = resolve(stored, dark)
}

export const THEME_BOOT = `(${boot})(${JSON.stringify(THEME_KEY)}, ${resolveTheme})`
