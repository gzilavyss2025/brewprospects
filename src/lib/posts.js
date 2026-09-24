// Post-to-player links. A post names a player two ways: the `players` field an
// author fills in, and any prospect-card block in the body. A player page lists
// every post that names him either way.

// Matches a Markdoc prospect-card tag's playerId attribute in a raw body,
// e.g. {% prospect-card playerId=815908 /%}.
const CARD_TAG = /\{%\s*prospect-card\b[^%]*?\bplayerId=(\d+)/g

export function cardPlayerIds(body) {
  return [...String(body ?? '').matchAll(CARD_TAG)].map((m) => Number(m[1]))
}

export function linkedPlayerIds(post) {
  const ids = new Set([...(post?.data?.players ?? []), ...cardPlayerIds(post?.body)])
  return [...ids].filter((id) => Number.isInteger(id) && id > 0)
}

// Newest first. A post with no date sorts last rather than crashing the sort.
export function byNewest(a, b) {
  const ta = a?.data?.date ? Date.parse(a.data.date) : -Infinity
  const tb = b?.data?.date ? Date.parse(b.data.date) : -Infinity
  return tb - ta
}

export function postsForPlayer(posts, playerId) {
  return posts.filter((p) => linkedPlayerIds(p).includes(playerId)).sort(byNewest)
}
