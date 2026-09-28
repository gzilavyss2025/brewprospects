#!/usr/bin/env node
// The nightly job's last step: fail when the snapshots are stuck. A job can
// succeed every night and still write nothing, for example gen-org keeping
// last season because the new season's rosters never reach 100 players
// (snapshotAction in src/lib/model/org.js). The job alone would stay green.
//
// The rule: from STUCK_AFTER on, org.json must hold this year's season.
// Full-season MiLB rosters are set by mid-April. A generator that throws
// already fails its own step, so this checks only the silent case.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const STUCK_AFTER = { month: 5, day: 1 }

export function stalenessProblems({ orgSeason, today }) {
  const problems = []
  const year = today.getUTCFullYear()
  const cutoff = Date.UTC(year, STUCK_AFTER.month - 1, STUCK_AFTER.day)
  if (today.getTime() >= cutoff && Number(orgSeason) < year) {
    problems.push(`org.json still holds the ${orgSeason} season after ${STUCK_AFTER.month}/${STUCK_AFTER.day}/${year}.`)
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const org = JSON.parse(readFileSync(new URL('../../src/data/org.json', import.meta.url), 'utf8'))
  const problems = stalenessProblems({ orgSeason: org.season, today: new Date() })
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'))
    process.exit(1)
  }
  console.log('freshness: snapshots are current.')
}
