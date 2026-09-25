// Build-time access to posts across all four post collections. Drafts never
// leave this module.
import { getCollection } from 'astro:content'
import { byNewest } from '../posts.js'

export const POST_TYPES = [
  { key: 'recaps', label: 'Recap', plural: 'Recaps' },
  { key: 'features', label: 'Feature', plural: 'Player features' },
  { key: 'lists', label: 'List', plural: 'Lists & rankings' },
  { key: 'guides', label: 'Guide', plural: 'Ballpark guides' },
]

// Cached per build: every player page asks for these, and each uncached call
// re-reads the collections (and re-warns for an empty one).
let postsPromise = null
let notesPromise = null

export function allPosts() {
  postsPromise ??= loadPosts()
  return postsPromise
}

export function playerNotes() {
  notesPromise ??= getCollection('playerNotes')
  return notesPromise
}

async function loadPosts() {
  const lists = await Promise.all(
    POST_TYPES.map(async (t) =>
      (await getCollection(t.key, (e) => !e.data.draft)).map((e) => ({ ...e, type: t })),
    ),
  )
  return lists.flat().sort(byNewest)
}

export function postUrl(post) {
  return `/posts/${post.type.key}/${post.id}`
}
