// Turns the posts /posts shows into RSS items. No post body: a prospect-card
// block is a live island and does not render in a feed reader (ADR-0009).
import { byNewest } from './posts.js'
import { paths } from '../slug.js'

export function feedItems(posts, origin) {
  return [...posts].sort(byNewest).map((post) => {
    const link = new URL(paths.post(post.type.key, post.id), origin).href
    const summary = post?.data?.summary?.trim()
    return {
      title: post.data.title,
      pubDate: post.data.date instanceof Date ? post.data.date : new Date(post.data.date),
      link,
      // No customData needed: @astrojs/rss sets <guid isPermaLink="true"> to
      // this same absolute link. A domain change makes every post look new
      // to subscribers again; that tradeoff is accepted (ADR-0009).
      ...(summary ? { description: summary } : {}),
    }
  })
}
