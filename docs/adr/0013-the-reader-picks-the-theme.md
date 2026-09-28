# The reader picks the theme; the OS setting is the default

**Status:** Accepted
**Date:** 2026-09-28

## Context

ADR-0012 defined a navy-black theme in `[data-theme="dark"]` and checked it
in lint, but no page set it. The roadmap (Phase 2, item 7) left the toggle as
separate work. The site is static-first (ADR-0001): no server knows the
reader's choice, so the page must find it in the browser.

A theme set after first paint makes a dark reader see a light flash on every
page. An island or a bundled module script runs too late to stop it.

## Decision

- The theme is `data-theme` on `<html>`, `light` or `dark`. `tokens.css`
  does the rest; no rule reads the theme any other way.
- The reader's stored choice wins. With no choice, the OS setting
  (`prefers-color-scheme`) decides. `resolveTheme()` in `src/lib/theme.js`
  holds this rule, with tests.
- A small inline script in the `<head>` of `Base.astro` sets the attribute
  before first paint. Its source is `THEME_BOOT`, built from the tested
  functions, so the page and the tests run the same code. It survives
  storage that throws and a browser with no `matchMedia`.
- The header carries one button, `.theme-toggle`, with `aria-pressed`. A
  click flips the theme and stores it in `localStorage` under `theme`. The
  button is `hidden` until its script runs, so a page without JavaScript
  shows no dead control.
- Without JavaScript the page is light. That is the checked default.
- `color-scheme` follows the theme, so form controls and scroll bars match.

There is no "follow the OS again" choice. A reader who wants it back clears
the site's data. Add a third state only if readers ask.

## Consequences

The dark values ADR-0012 marked as provisional are now live. They still pass
every check in both themes. Change one with its reason in ADR-0012's table.

A new page gets the theme through `Base.astro`. A page that does not use
`Base.astro` (today only `/keystatic`) stays light.

`test/theme.test.js` fails when `Base.astro` stops inlining `THEME_BOOT` or
drops the toggle.
