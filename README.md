# brewprospects

A fan site about the Milwaukee Brewers farm system: every affiliate, every
player, MLB Pipeline ranks, and a blog whose posts can hold live data blocks.
Built with Astro 7 and Keystatic. The site name is a placeholder
(`src/config/site.js`).

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:4321
                   # editor: http://127.0.0.1:4321/keystatic
npm run data       # refresh src/data/*.json (runs nightly in Actions)
npm run lint && npm test && npm run build
```

## Pages

| Route | What it shows |
| --- | --- |
| `/` | Latest posts, MLB Pipeline top 10, the clubs |
| `/depth-chart` | Every affiliate's active roster by position, plus injured list |
| `/players` | Every org player, grouped by current club |
| `/players/{name-id}` | Bio, level path, MiLB stats by year, your notes, posts about him |
| `/posts` | All posts by type |

## Writing a post

Open `/keystatic`, pick a post type (Recaps, Player features, Lists &
rankings, Ballpark & travel guides), and write. To add a live player card,
use the **+** menu → **Prospect card** and enter his MLB id (the number at the
end of his page address). Put player ids in **Players in this post** to list
the post on those player pages.

Player notes: **Player notes** → new entry. The page address must match the
player page (e.g. `jesus-made-815908`).

## Going live (one-time setup)

1. **Vercel**: import this repo as a new project. Framework: Astro. The build
   uses `@astrojs/vercel`.
2. **Keystatic in production**: set `PUBLIC_KEYSTATIC_STORAGE=github` in
   Vercel, deploy, then open `/keystatic` on the live site. It walks you
   through creating a GitHub App and gives you `KEYSTATIC_GITHUB_CLIENT_ID`,
   `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` and
   `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` to add as Vercel env vars. See
   `.env.example`.
3. **Nightly data**: `.github/workflows/nightly-data.yml` refreshes the JSON
   and commits to `main` only when it changed. Each such commit deploys.

## Docs

- `CLAUDE.md` — rules for agents working here
- `docs/adr/` — why each decision was made
