// Post-to-player links. A post names a player two ways: the `players` field an
// author fills in, and any prospect-card block in the body. A player page lists
// every post that names him either way.

export const POST_TYPES = [
  { key: 'recaps', label: 'Recap', plural: 'Recaps' },
  { key: 'features', label: 'Feature', plural: 'Player features' },
  { key: 'lists', label: 'List', plural: 'Lists & rankings' },
  { key: 'guides', label: 'Guide', plural: 'Ballpark guides' },
]

// The one place that decides whether a post belongs on /posts and in the RSS
// feed: one of the four post types, and not a draft. Leaves out playerNotes.
export function isListedPost(post) {
  return POST_TYPES.some((t) => t.key === post?.collection) && !post?.data?.draft
}

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
