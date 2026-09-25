// The browser editor at /keystatic (docs/adr/0002). Posts are Markdoc files in
// src/content/, so every post is a file in git with full history.
//
// Storage: 'local' in dev writes files to this checkout. In production it is
// GitHub mode: saving commits to a branch, and nothing publishes until that
// branch merges to main. The owner/repo come from public env vars, so a fork
// or a rename needs no code change.
import { config, collection, fields } from '@keystatic/core'
import { block } from '@keystatic/core/content-components'
import { SITE_NAME } from './src/config/site.js'

const storage =
  import.meta.env.PUBLIC_KEYSTATIC_STORAGE === 'github'
    ? {
        kind: 'github',
        repo: {
          owner: import.meta.env.PUBLIC_GITHUB_OWNER ?? 'gzilavyss2025',
          name: import.meta.env.PUBLIC_GITHUB_REPO ?? 'brewprospects',
        },
        branchPrefix: 'post/',
      }
    : { kind: 'local' }

// Blocks an author can drop into any post. Each maps to a Markdoc tag of the
// same name in markdoc.config.mjs.
const components = {
  'prospect-card': block({
    label: 'Prospect card',
    description: 'A live card for one player: level, club and this season’s line.',
    schema: {
      playerId: fields.integer({
        label: 'MLB player id',
        description: 'The number at the end of his page address, e.g. 815908 for /players/jesus-made-815908.',
        validation: { isRequired: true },
      }),
    },
  }),
}

// Fields every post type shares.
const common = {
  title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
  date: fields.date({ label: 'Date', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
  summary: fields.text({ label: 'Summary', description: 'One or two sentences for lists and link previews.', multiline: true }),
  players: fields.array(fields.integer({ label: 'MLB player id' }), {
    label: 'Players in this post',
    description: 'Each player page lists the posts that name him. Prospect cards in the body count too.',
    itemLabel: (p) => String(p.value ?? 'Player id'),
  }),
  draft: fields.checkbox({ label: 'Draft (hidden from the site)', defaultValue: false }),
}

const body = fields.markdoc({ label: 'Body', components })

function postCollection(key, label, extra = {}) {
  return collection({
    label,
    slugField: 'title',
    path: `src/content/${key}/*`,
    format: { contentField: 'body' },
    entryLayout: 'content',
    columns: ['title', 'date'],
    schema: { ...common, ...extra, body },
  })
}

export default config({
  storage,
  ui: { brand: { name: SITE_NAME } },
  collections: {
    recaps: postCollection('recaps', 'Recaps', {
      period: fields.select({
        label: 'Covers',
        options: [
          { label: 'One night', value: 'night' },
          { label: 'One week', value: 'week' },
        ],
        defaultValue: 'night',
      }),
    }),
    features: postCollection('features', 'Player features'),
    lists: postCollection('lists', 'Lists & rankings', {
      entries: fields.array(
        fields.object({
          playerId: fields.integer({ label: 'MLB player id', validation: { isRequired: true } }),
          note: fields.text({ label: 'Why he is here', multiline: true }),
        }),
        { label: 'Ranked entries (top first)', itemLabel: (p) => String(p.fields.playerId.value ?? 'Player') },
      ),
    }),
    guides: postCollection('guides', 'Ballpark & travel guides', {
      affiliateId: fields.select({
        label: 'Club',
        options: [
          { label: 'Nashville Sounds (AAA)', value: '556' },
          { label: 'Biloxi Shuckers (AA)', value: '5015' },
          { label: 'Wisconsin Timber Rattlers (A+)', value: '572' },
          { label: 'Wilson Warbirds (A)', value: '249' },
          { label: 'ACL Brewers', value: '406' },
          { label: 'DSL Brewers (Dominican complex)', value: '2101' },
        ],
        defaultValue: '556',
      }),
    }),
    playerNotes: collection({
      label: 'Player notes',
      slugField: 'player',
      path: 'src/content/player-notes/*',
      format: { contentField: 'note' },
      schema: {
        player: fields.slug({
          name: { label: 'Player name' },
          slug: {
            label: 'Player page address',
            description: 'Must end in his MLB id, e.g. jesus-made-815908. Copy it from his page URL.',
          },
        }),
        updated: fields.date({ label: 'Last updated', defaultValue: { kind: 'today' } }),
        note: fields.markdoc({ label: 'Note', components }),
      },
    }),
  },
})
