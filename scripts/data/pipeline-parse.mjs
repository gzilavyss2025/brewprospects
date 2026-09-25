// Pure parsing and shape checks for fetch-pipeline.mjs, adapted from Tally's
// scripts/fetch-top-prospects.mjs. Kept apart so tests can run without network.

export function extractEntries(html) {
  const m = /var data = (\[.*?\]);/s.exec(html)
  if (!m) throw new Error('No "var data = [...]" in the page; its structure may have changed.')
  const parsed = JSON.parse(m[1])
  if (!Array.isArray(parsed) || parsed.length < 50) {
    throw new Error(`Expected a list of 50+ entries, got ${Array.isArray(parsed) ? parsed.length : typeof parsed}.`)
  }
  for (const e of parsed) {
    if (typeof e.rank !== 'number' || typeof e.playerId !== 'number') {
      throw new Error('An entry has no numeric rank/playerId; the page structure may have changed.')
    }
  }
  return parsed
}

// The real Top 100 has near-unique ranks. The per-org list repeats 1-30 once
// per club.
export function assertTop100Shape(entries) {
  const unique = new Set(entries.map((e) => e.rank)).size
  if (unique < entries.length * 0.9) {
    throw new Error(`Only ${unique} unique ranks of ${entries.length}: this is not the Top 100 list.`)
  }
}

// The per-org list covers ~30 clubs with ~20-30 entries each.
export function assertOrgShape(entries) {
  const teams = new Set(entries.map((e) => e.teamId)).size
  if (teams < 20 || entries.length / teams < 10) {
    throw new Error(`${teams} clubs, ${(entries.length / teams).toFixed(1)} entries each: this is not the per-org list.`)
  }
}

// Some players appear twice at the same rank: a real line plus a stray one (a
// pitcher's token batting line). Keep the entry whose stat group matches the
// position.
export function dedupeByPlayer(entries) {
  const byId = new Map()
  for (const e of entries) {
    const prev = byId.get(e.playerId)
    if (!prev) {
      byId.set(e.playerId, e)
      continue
    }
    const pitcher = /P$/.test(e.position || '')
    const fits = (x) => (pitcher ? x.pitchingStats : x.battingStats)
    if (fits(e) && !fits(prev)) byId.set(e.playerId, e)
  }
  return [...byId.values()]
}

// ".271, 14 HR, 91 RBI" or "85 IP, 3.31 ERA, 89 SO". Missing parts drop out.
export function statLineFor(e) {
  if (e.pitchingStats) {
    const p = e.pitchingStats
    const era = e.era ?? p.era
    return [
      p.inningsPitched != null ? `${p.inningsPitched} IP` : null,
      era ? `${era} ERA` : null,
      Number.isFinite(p.strikeOuts) ? `${p.strikeOuts} SO` : null,
    ].filter(Boolean).join(', ')
  }
  if (e.battingStats) {
    const b = e.battingStats
    return [
      e.avg ?? b.avg ?? null,
      Number.isFinite(b.homeRuns) ? `${b.homeRuns} HR` : null,
      Number.isFinite(b.rbi) ? `${b.rbi} RBI` : null,
    ].filter(Boolean).join(', ')
  }
  return ''
}
