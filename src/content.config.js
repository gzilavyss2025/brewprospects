// Astro content collections over the Markdoc files Keystatic writes. The schema
// here must match keystatic.config.jsx field for field.
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  summary: z.string().optional().default(''),
  players: z.array(z.number().int()).optional().default([]),
  draft: z.boolean().optional().default(false),
})

const posts = (dir, extra = {}) =>
  defineCollection({
    loader: glob({ pattern: '**/*.mdoc', base: `./src/content/${dir}` }),
    schema: postSchema.extend(extra),
  })

export const collections = {
  recaps: posts('recaps', { period: z.enum(['night', 'week']).optional().default('night') }),
  features: posts('features'),
  lists: posts('lists', {
    entries: z
      .array(z.object({ playerId: z.number().int(), note: z.string().optional().default('') }))
      .optional()
      .default([]),
  }),
  guides: posts('guides', { affiliateId: z.string() }),
  playerNotes: defineCollection({
    loader: glob({ pattern: '**/*.mdoc', base: './src/content/player-notes' }),
    schema: z.object({
      player: z.string(),
      updated: z.coerce.date().optional(),
    }),
  }),
}
