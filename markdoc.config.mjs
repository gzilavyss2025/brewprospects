// Markdoc tags for the blocks an author can put in a post. Each tag name must
// match a component key in keystatic.config.jsx.
import { defineMarkdocConfig, component } from '@astrojs/markdoc/config'

export default defineMarkdocConfig({
  tags: {
    'prospect-card': {
      render: component('./src/components/ProspectCardTag.astro'),
      selfClosing: true,
      attributes: {
        playerId: { type: Number, required: true },
      },
    },
  },
})
