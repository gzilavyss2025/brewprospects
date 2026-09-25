// A player page address carries the name AND the id: /players/jesus-made-815908.
// The id makes it unique and stable; the name makes it readable. Only the
// trailing id is trusted when a page resolves an address.
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function playerSlug(name, id) {
  const base = slugify(name)
  return base ? `${base}-${id}` : String(id)
}

// Every public path is built here, so the URL contract (ADR-0009) lives in
// one file. A path never ends in a slash, except the home page.
export const paths = {
  player: (name, id) => `/players/${playerSlug(name, id)}`,
  club: (name, id) => `/clubs/${playerSlug(name, id)}`,
  season: (year) => `/seasons/${year}`,
  post: (type, id) => `/posts/${type}/${id}`,
}

// The one address a page names as its own: the site origin plus the path,
// with no trailing slash, query or hash. Returns null when the site origin is
// not set, because a wrong canonical is worse than none (ADR-0003).
export function canonicalUrl(site, pathname) {
  if (!site) return null
  const path = String(pathname ?? '/').replace(/\/+$/, '') || '/'
  return new URL(path, site).href
}

export function idFromSlug(slug) {
  const m = /(\d+)$/.exec(String(slug ?? ''))
  return m ? Number(m[1]) : null
}
