# Preserve spacing while adding a scale

**Status:** Accepted
**Date:** 2026-09-25

ADR-0010 is reserved for the naming decision in the third token PR. This
decision ships with the first PR, so the spacing audit stays with its code.

## Context and count

Measured before editing, on main at `9b3ffb7`. Scope: `src/styles`,
`src/components`, `src/layouts` and `src/pages`, including inline styles.
Count each px literal in a declaration, including repeated shorthand
values. Ignore comments and count token definitions separately. There are
no component style blocks. The three stylesheets total 186 lines.

| Spacing px | Occurrences |
| --- | ---: |
| 2 | 4 |
| 3 | 1 |
| 4 | 2 |
| 6 | 6 |
| 8 | 5 |
| 10 | 4 |
| 12 | 5 |
| 14 | 3 |
| 16 | 6 |
| 20 | 3 |
| 24 | 2 |
| 32 | 1 |
| 36 | 1 |
| 40 | 1 |
| 64 | 1 |

That is 45 px literals across 36 padding, margin and gap declarations.
The two raw radius declarations are both 999px, bringing the total to
47 literals across 38 declarations. One other radius is 50%, not px.
Existing definitions are `--gap: 16px`, `--radius: 14px`, and
`--radius-sm: 8px`; these are not repeated in the raw-use count.

Width and font-size counts are separate and stay outside this migration:

| Property | Raw px values (value × count) | Literals / declarations |
| --- | --- | ---: |
| width, min-width, max-width | 44 × 1, 48 × 2, 72 × 1, 132 × 2 | 6 / 6 |
| font-size | 13 × 1, 14 × 4, 16 × 3, 17 × 1, 18 × 2, 20 × 1, 22 × 1, 24 × 2, 30 × 2, 44 × 1, 48 × 1 | 19 / 17 |

The width token `--max: 1080px` is a separate definition. The 220px and
260px grid minima are track sizes, not width declarations. Both stay as-is.
The home page's inline 10px value is a border width, also outside this pass.
One transition declaration contains two 160ms values.

## Decision

- Add the 4px scale: 0, 1, 2, 3, 4, 5, 6, 8, 10 and 12. Step 0 is zero;
  every other whole step is its number times 4px.
- Preserve 6, 10 and 14px with half-steps `1-5`, `2-5` and `3-5`. These
  account for 13 of 45 spacing literals. Tally ADR-0085 found a much larger
  version of this issue (488 of 1,125 off-scale padding/gap values).
- Preserve 2px with step `0-5`. Preserve the single 3px roster-row padding
  with step `0-75`: snapping it changes every row's height. This quarter
  step exists to retain that compact row spacing.
- Add whole steps 9 (36px) and 16 (64px) for the existing section and footer
  margins. Do not compress those gaps to fit a shorter token list.
- Replace `--gap` with `--space-4` and `--radius` with `--radius-md`.
  Radii are none (0), sm (8px), md (14px), pill (999px) and round (50%).
- Add durations none (0ms) and fast (160ms). The existing card transition
  uses fast; reduced-motion behavior stays in place.

Every replaced value keeps its exact computed value. No value moves by
more than 2px; no value moves at all. Font sizes, widths and border widths
are not tokenized in this work.

## Check

`scripts/checks/raw-values.mjs` adapts Tally's comment masking, declaration
scan and numeric-length matching. It rejects raw px in spacing and radius
properties and their longhands throughout the four source folders. It
reads sheets, style blocks, inline CSS strings and JSX style objects.
Only 0, 1px, 2px and the token file are exempt. Negative values, fractions,
calc() values and var() fallbacks are checked. Other units are outside this
px check. There is no budget table, ratchet or per-line escape comment.

Tests cover these boundaries and place a raw value in a temporary nested
source folder to prove the actual lint runner rejects it. The scanner
checks source literals; it does not evaluate JavaScript-generated CSS.
