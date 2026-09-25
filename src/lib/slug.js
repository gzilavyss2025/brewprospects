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

export function idFromSlug(slug) {
  const m = /(\d+)$/.exec(String(slug ?? ''))
  return m ? Number(m[1]) : null
}
