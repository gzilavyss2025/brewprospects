// The headshot fallback chain: `silo` for a player who reached MLB, then
// `milb`, then his initials. The URLs come from affiliates.js, so a switch to
// self-hosted photos stays one file.
import { headshotUrl } from './affiliates.js'

// "Reached MLB" is a debut date on file. The Stats API sends `mlbDebutDate`
// only for players who debuted: test/fixtures/people-yearbyyear.json has it for
// Jordyn Adams (debuted 2023) and not for Jesus Made. slimPerson keeps it, so
// org.json and archive/people.json carry it (39 of 253 org players, 2026-09-28).
export function reachedMlb(person) {
  return Boolean(person?.mlbDebutDate)
}

// The photo URLs to try, in order. Empty when there is no id: the page shows
// initials straight away.
export function headshotChain(person, width = 240) {
  if (!person?.id) return []
  const kinds = reachedMlb(person) ? ['silo', 'milb'] : ['milb']
  return kinds.map((kind) => headshotUrl(person.id, width, kind))
}

export function initialsOf(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
}

// The image's inline onerror handler, so the chain needs no island. The URLs
// still to try sit in `data-fallbacks`, space-separated (no URL has a space).
// Each error loads the next one; when none is left, the image becomes the
// initials. No step ever shows a broken-image icon.
export function headshotOnError(initials) {
  return [
    "const rest=(this.dataset.fallbacks||'').split(' ').filter(Boolean);",
    'if(rest.length){this.dataset.fallbacks=rest.slice(1).join(\' \');this.src=rest[0]}',
    `else{this.replaceWith(Object.assign(document.createElement('div'),{className:'initials',textContent:${JSON.stringify(initials)}}))}`,
  ].join('')
}
