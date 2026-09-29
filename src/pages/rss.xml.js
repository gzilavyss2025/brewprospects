import rss from '@astrojs/rss'
import { allPosts } from '../lib/build/content.js'
import { feedItems } from '../lib/model/feed.js'
import { SITE_NAME, SITE_DESCRIPTION, feedOrigin } from '../config/site.js'

export async function GET() {
  const site = feedOrigin(process.env.SITE_URL)
  const posts = await allPosts()
  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site,
    items: feedItems(posts, site),
  })
}
