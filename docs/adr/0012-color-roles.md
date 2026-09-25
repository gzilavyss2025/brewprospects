# Color tokens are named for their job, in two themes

**Status:** Accepted
**Date:** 2026-09-25

ADR-0010 stays reserved for the class-naming decision in the third token PR.

## Context

Dark mode is planned (roadmap, decisions). The color tokens were named for a
hue or a thing (`--navy`, `--paper`, `--club`). Brewers navy did three jobs:
brand fill, text on gold, and the edge of every card, table and photo. On the
navy-black paper chosen for dark mode, navy is about 1.31:1. A token named
for its hue cannot say which of those jobs must change in the dark.

The contrast check read every `--x: #hex` in `tokens.css` into one map. With
a second theme block, the dark value would overwrite the light one, and a
failing light pair could pass on dark values.

Affiliate colors are web research (Tally), and nothing checked them in lint.
One unit test checked seven ids.

## Decision

Color tokens are `--{role}-{name}`. Each one is set in `:root` (light, live)
and in `[data-theme="dark"]` (navy-black, dormant: no page sets it, and the
site does not follow the OS setting).

| Token | Job | Light | Dark |
| --- | --- | --- | --- |
| `--surface-paper` | page, even table rows | `#fbf6e9` | `#080f1b` |
| `--surface-card` | cards, tables, notes | `#ffffff` | `#121e30` |
| `--surface-logo` | the plate behind a club logo | `#ffffff` | `#ffffff`\* |
| `--text-ink` | body text | `#12284b` | `#fbf6e9` |
| `--text-ink-soft` | muted text, jersey numbers | `#4a5670` | `#a9b4c8`\* |
| `--text-link` | links | `#0b4f8a` | `#a8ceff` |
| `--text-on-navy` | text on a navy fill | `#fbf6e9` | `#fbf6e9`\* |
| `--line-rule` | dotted row rules | `#e6dcc3` | `#2c3b54`\* |
| `--line-stitch` | the header's red stitching | `#c8102e` | `#c8102e`\* |
| `--line-edge` | card, table and photo borders; the hard shadow | navy | `#5a78a8`\* |
| `--focus-ring` | focus outline | `#12284b` | `#fbf6e9`\* |
| `--focus-halo` | focus band | paper | paper |
| `--brand-navy` | Brewers navy | `#12284b` | same |
| `--brand-gold` | Brewers gold | `#ffc52f` | same |
| `--club-bar` | a club's own color band (default) | navy | same |
| `--club-on-bar` | text on the club band (default) | `#ffffff` | same |

Dark paper, card, ink and link come from the approved palette study. The
study set no other dark values; \* marks the values this PR chose. They pass
every check and are provisional until the dark theme ships.

Three roles are new, each for a foreground or edge job the old names hid:

- `--text-on-navy`: the footer, the active nav pill, pennants and table heads
  put paper-colored text on navy. In the dark theme paper turns near-black,
  which would be 1.31:1 on navy. This role keeps cream on navy in both.
- `--line-edge`: navy as a border or shadow is structure, not identity. In
  the dark theme it becomes a lighter blue, visible at 4.28:1 on paper.
- `--surface-logo`: club logos are drawn for a light ground. The plate stays
  white in both themes.

Brand navy stays where it is identity or where it sits on gold: the header
band and its inset edge, nav text and borders on gold, the rank chip, the
initials tile (it inherited ink before; it now says navy, the same hex in
light). Gold stays only as Brewers identity: the header, rank chips, photo
grounds and the stripe on site notes. The note stripe is the one gold use
that is not a Brewers mark in itself; it is the site's own chrome, and it
stays gold until the class-naming PR looks at notes.

`--shadow` and `--shadow-lift` keep their names and now draw with
`--line-edge`. The dark block restates them, so a `data-theme` set on any
element picks up its own edge color.

### Club colors

`--club-bar` and `--club-on-bar` replace `--club` and `--club-ink`. There is
no `--club-accent`. `:root` sets Brewers navy with white as the default. A
section's inline style sets both from `accentFor()`, and wins. The inline
values are the same in both themes: a club's color is identity.

There are three sites: `SeasonClub.astro`, `depth-chart.astro`, and the home
page club cards, whose 10px top border now reads `var(--club-bar)` from an
inline `--club-bar`. The rendered light pages are unchanged.

### Checks

- `scripts/checks/contrast.mjs` reads each theme block into its own map. A
  `var(--x)` resolves in its own theme; a token that does not reach a
  six-digit hex fails. `PAIRS` (4.5:1) and `FOCUS` (3:1) run in both themes.
  Every role must resolve in both themes, and `brand-*` and `club-*` must be
  equal in both. A missing theme block or check line fails.
- `PAIRS` now matches the real uses: `text-link/surface-card` (links in
  tables and cards) and `club-on-bar/club-bar` were added. `gold/navy` was
  dropped: no rule sets gold text on navy.
- `accentProblems()` in `src/lib/affiliates.js` checks every `ACCENTS`
  primary with its `pickInk()` ink at 4.5:1, and reports a missing or
  malformed color. Lint prints each failure. `accentFor()` uses the same
  test and paints Brewers navy with white for a failed entry. The entry stays
  in `ACCENTS` with its provenance, so lint keeps reporting it, and
  `researched` still says it exists. No replacement color is invented
  (ADR-0003). `clubIdentity()` (ADR-0008) is unchanged.

Measured 2026-09-25, each with white ink: 556 `#071d49` 16.39:1, 249
`#091f2c` 16.88:1, 572 `#862633` 8.98:1, 5015 `#0f69b1` 5.71:1. None fail.

## Consequences

Turning dark mode on later is a toggle and a `data-theme` attribute, not a
token sweep. A new color use picks a role by its job, and a new pair goes on
a check line. A new affiliate color that fails lint still renders, in navy.
