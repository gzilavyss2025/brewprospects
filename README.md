# brewprospects

A fan site about the Milwaukee Brewers farm system: every affiliate, every
player, MLB Pipeline ranks, and a blog whose posts can hold live data blocks.
Built with Astro 7 and Keystatic. The site is called Road to the Crew
(`src/config/site.js`); its logo files are in `public/brand/road-to-the-crew/`.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:4321
                   # editor: http://127.0.0.1:4321/keystatic
npm run data       # refresh src/data/*.json (runs nightly in Actions)
node scripts/data/gen-archive.mjs --season 2015   # rebuild one past season
node scripts/data/gen-archive.mjs --refetch       # rebuild every past season
npm run lint && npm test && npm run build
npx playwright install chromium                  # once
npm run e2e        # smoke tests over the build: routes, links, axe
```

## Pages

| Route | What it shows |
| --- | --- |
| `/` | Latest posts, MLB Pipeline top 10, the clubs |
| `/depth-chart` | Every affiliate's active roster by position, plus injured list |
| `/players` | Every org player, grouped by current club |
| `/players/{name-id}` | Bio, level path, MiLB stats by year, your notes, posts about him |
| `/seasons` | Every past season since 2006 |
| `/seasons/{year}` | That year's affiliates, each player's line for his club, and the Brewers on that year's Top 100 |
| `/prospects` | Top 100 history: every Brewer on a preseason list since 2006 |
| `/posts` | All posts by type |
| `/about` | Credits, sources and the disclaimer |

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
   uses `@astrojs/vercel`. Done 2026-09-28: project `brewprospects`,
   https://brewprospects.vercel.app. Preview deployments are off, so only
   `main` deploys; a PR or a `post/*` branch gets no preview link.
2. **Keystatic in production**: Keystatic creates its GitHub App only from a
   dev server, never from the live site.
   1. Run `PUBLIC_KEYSTATIC_STORAGE=github npm run dev` and open
      http://127.0.0.1:4321/keystatic (not `localhost`).
   2. Create the app. Give the live site as the deployed URL, so its sign-in
      callback is on the app. Keystatic writes the credentials to `.env`,
      which git ignores.
   3. Install the app on this repo only
      (`https://github.com/apps/{app-slug}/installations/new`). Without this,
      Keystatic says it cannot access the repo.
   4. In Vercel, set these for Production: `PUBLIC_KEYSTATIC_STORAGE=github`,
      and the four values from `.env`: `KEYSTATIC_GITHUB_CLIENT_ID`,
      `KEYSTATIC_GITHUB_CLIENT_SECRET` and `KEYSTATIC_SECRET` (both
      sensitive), and `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. See `.env.example`.
   5. Redeploy. `PUBLIC_` values are read at build time.
   Done 2026-09-28: the app is `brewprospects-keystatic`.
3. **Protect `main`**: a ruleset on `main` requires a PR and the `ci` check,
   and blocks force pushes and deletion. Its only bypass is a deploy key.
   Keystatic saves as the signed-in user, so an admin bypass would let it
   save straight to `main`. Leave admins off the bypass list. Rulesets need a
   public repo or GitHub Pro.
4. **Nightly data**: `.github/workflows/nightly-data.yml` refreshes the JSON
   and commits to `main` only when it changed. Each such commit deploys. It
   pushes with a write deploy key: the public half is on the repo, the
   private half is the `NIGHTLY_DEPLOY_KEY` Actions secret.

## Docs

- `CLAUDE.md` — rules for agents working here
- `docs/adr/` — why each decision was made

## License

The code is MIT (`LICENSE`). The license covers the code only: not the
posts, and not the data, logos or photos, which belong to their owners
(see `/about`).
