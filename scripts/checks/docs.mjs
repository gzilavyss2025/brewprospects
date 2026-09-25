// Checks that keep the docs and the house words true. Both adapted from bbsbh
// (scripts/check-adr-numbers.mjs and scripts/check-word-choice.mjs).

// Two ADRs with one number make every "ADR-NNNN" reference ambiguous. It
// happened in bbsbh when two branches each took "the next number". Gaps are
// fine: a withdrawn ADR may leave a hole.
export function adrNumberProblems(names) {
  const byNumber = new Map()
  for (const name of names) {
    const m = /^(\d{4})-.+\.md$/.exec(name)
    if (m) byNumber.set(m[1], [...(byNumber.get(m[1]) ?? []), name])
  }
  return [...byNumber]
    .filter(([, list]) => list.length > 1)
    .map(([n, list]) => `ADR number ${n} names ${list.length} files: ${list.join(', ')}. Renumber the later one.`)
}

// The house word list. Baseball's October is the postseason. A line may opt
// out with the marker `word-choice-exempt` only for a name we do not own
// (an award or a product title).
export const WORD_RULES = [{ banned: /\bplayoffs?\b/i, use: 'postseason' }]
const EXEMPT = /word-choice-exempt/

export function wordProblems(relPath, text) {
  const problems = []
  text.split('\n').forEach((line, i) => {
    if (EXEMPT.test(line)) return
    for (const { banned, use } of WORD_RULES) {
      const found = banned.exec(line)
      if (found) problems.push(`${relPath}:${i + 1} says "${found[0]}". Say "${use}".`)
    }
  })
  return problems
}
