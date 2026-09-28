// Live prospect card, hydrated in the browser (an Astro island). The server
// renders the nightly snapshot first; this refreshes the club and season line
// from statsapi.mlb.com, which allows cross-origin reads. On any fetch error
// the snapshot stays, so the card never goes blank.
import { useEffect, useState } from 'react'
import { cardUrl, pickSeasonLine, lineText } from '../lib/model/card.js'

export default function ProspectCard({ playerId, href, name, pos, club, group, snapshotLine, photo, rank }) {
  const [live, setLive] = useState(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(cardUrl(playerId), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.people?.[0]
        if (!p) return
        const line = pickSeasonLine(p.stats, group)
        setLive({
          club: p.currentTeam?.name || club,
          line: line ? `${line.season} ${line.levels.join('/')}: ${lineText(line, group)}` : null,
        })
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [playerId, group, club])

  return (
    <a className="card spotlight" href={href}>
      <img src={photo} alt="" width="72" height="96" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      <div>
        <strong>{name}</strong> <span className="muted">{pos}</span>
        {rank ? <> <span className="rank">#{rank}</span></> : null}
        <div className="muted">{live?.club ?? club}</div>
        <div className="line">{live?.line ?? snapshotLine}</div>
      </div>
    </a>
  )
}
