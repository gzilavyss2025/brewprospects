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
and in `[data-theme="dark"]` (navy-black; dormant when accepted, live since
ADR-0013, which lets the reader pick it; before that no page set it, and the
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
| `--chart-band-low` | OPS band: below .500 | `#7e8ba3`† | `#667590`† |
| `--chart-band-fair` | OPS band: .500 to .799 | `#9c6800`† | `#5a9be8`† |
| `--chart-band-good` | OPS band: .800 to 1.099 | `#2a5aa0`† | gold† |
| `--chart-band-great` | OPS band: 1.100 and up | navy† | `#fbf6e9`† |
| `--chart-line-season` | the season OPS line | `#c8102e`† | `#ff6b81`† |
| `--chart-line-rolling` | the 10-game rolling OPS line | `#0b7a75`† | `#3fd0c4`† |

Dark paper, card, ink and link come from the approved palette study. The
study set no other dark values; \* marks the values this PR chose. They pass
every check. They were provisional until the dark theme shipped (ADR-0013).
The chart rows are new (issue #37); † marks the values that PR chose.

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

### Chart colors

`chart` is a role for the per-game OPS chart on the player page. It has six
tokens: four OPS bands and two lines. Unlike `brand` and `club`, chart colors
may differ between themes, so `chart` is not in `FIXED`. The dark values are
lighter, because a dark bar needs a light color to show.

The bands rise in lightness with OPS. On paper, each band is darker than the
one before it. On the dark ground, each band is lighter. Hue changes too:
slate, bronze, blue and navy in light; slate, blue, gold and cream in dark.
The bands sit side by side, so they must differ from each other and not only
from the page. The chart will also print a text label on each band and use a
pattern, so no reader depends on color alone. Those come with the chart.

A new `GRAPHIC` line in `tokens.css` lists each chart token on
`surface-paper` and on `surface-card`. Each pair needs 3:1 (WCAG 1.4.11,
non-text contrast) in both themes. `chart` is a role, so every chart token
must also resolve to a hex in both theme blocks.

Measured 2026-09-30, on paper and on card:

| Token | Light | Dark |
| --- | --- | --- |
| `chart-band-low` | 3.19 and 3.44 | 4.12 and 3.60 |
| `chart-band-fair` | 4.43 and 4.78 | 6.66 and 5.81 |
| `chart-band-good` | 6.34 and 6.84 | 12.13 and 10.59 |
| `chart-band-great` | 13.60 and 14.68 | 17.78 and 15.52 |
| `chart-line-season` | 5.45 and 5.88 | 7.01 and 6.12 |
| `chart-line-rolling` | 4.80 and 5.18 | 10.08 and 8.80 |

All 24 pass 3:1. The lowest is `chart-band-low` on paper in light (3.19:1).

Adjacent bands, low to fair, fair to good, good to great: 1.39, 1.43 and
2.14 in light; 1.62, 1.82 and 1.47 in dark. This is a rough check. Lightness
alone is a small step, so the bands also differ in hue, and the chart labels
each one. The two lines are 1.14:1
(light) and 1.44:1 (dark) apart, so they differ by hue (red and teal; pink
and teal) and the chart must also give them different strokes. Against the
bands, the lines reach 1.05:1 at the closest (dark season line on the fair
band), so the chart must not rely on line color alone where a line crosses
a bar.

### Checks

- `scripts/checks/contrast.mjs` reads each theme block into its own map. A
  `var(--x)` resolves in its own theme; a token that does not reach a
  six-digit hex fails. `PAIRS` (4.5:1), `FOCUS` (3:1) and `GRAPHIC` (3:1) run in both themes.
  Every role must resolve in both themes, and `brand-*` and `club-*` must be
  equal in both. A missing theme block or check line fails. `GRAPHIC` (3:1)
  is the third line; see Chart colors.
- `PAIRS` now matches the real uses: `text-link/surface-card` (links in
  tables and cards) and `club-on-bar/club-bar` were added. `gold/navy` was
  dropped: no rule sets gold text on navy.
- `accentProblems()` in `src/lib/identity/affiliates.js` checks every `ACCENTS`
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

## Amendment, 2026-09-30: the hover tint

One new role token, `--surface-hover`, is the tint of a hovered table row and
of its pinned first cell. Text sits on it, so two pairs joined the `PAIRS`
line in `tokens.css`: `text-ink/surface-hover` and `text-link/surface-hover`.

| Token | Light | Dark |
| --- | --- | --- |
| `--surface-hover` | `#f3ead0` | `#1c2c46` |

Measured 2026-09-30: `text-ink/surface-hover` is 12.22:1 in light and
12.99:1 in dark. `text-link/surface-hover` is 7.00:1 in light and 8.64:1 in
dark. All four pass 4.5:1.

The tint applies only where the pointer can hover, inside
`@media (hover: hover)`. On a touch screen a tap would leave the tint stuck on
the tapped row. A pinned cell keeps an opaque background outside that query,
so it hides the cells that scroll under it on every device. The media query
was not tried on a real phone.