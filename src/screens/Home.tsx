import { useState } from 'react'
import { LEGS, TEAM, type Snapshot } from '../state/store'
import { useNow } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtDelta, fmtDuration, fmtPace, fmtRelative, fmtTimeRel } from '../model/time'
import { runnerMiles } from '../model/projection'
import { PaceSheet } from './Runners'
import type { RunnerId } from '../model/types'

export function Home({ snap }: { snap: Snapshot }) {
  const now = useNow(30000)
  const { state, proj, settings } = snap
  const [pace, setPace] = useState<RunnerId | null>(null)
  const totalMiles = Math.round(LEGS.reduce((a, l) => a + l.miles, 0) * 10) / 10
  const start = state.actual[0] ?? state.plannedStart
  const me = settings.iAmRunnerId
  const cur = proj.phase === 'racing' ? proj.legs[proj.currentLeg - 1] : null

  return (
    <div className="page">
      <h1 className="title">{TEAM.teamName}</h1>
      <div className="muted small" style={{ marginTop: -6, marginBottom: 10 }}>Hood to Coast · Fri–Sat Aug 28–29, 2026 · {totalMiles} mi · 36 legs · {TEAM.runners.length} runners · one van</div>

      <div className="card">
        <div className="kv">
          <span className="k">Start</span><span>{fmtTimeRel(start, now)} {state.actual[0] !== null ? '(actual)' : '(planned, Timberline)'}</span>
          <span className="k">Expected finish</span><span><b>{fmtTimeRel(proj.finish, now)}</b> · {fmtDelta(proj.deltaSec)}</span>
          <span className="k">Total time</span><span>{fmtDuration(proj.finish - start)}{state.hillAdjust ? ' · Hill-adj.' : ''}</span>
          {proj.phase === 'pre' && <><span className="k">Countdown</span><span>{fmtRelative(state.plannedStart, now).replace(/^in /, '')} to go</span></>}
          {cur && <><span className="k">Right now</span><span>Leg {cur.n} · {TEAM.runners.find(r => r.id === cur.runnerId)?.short} · Exch {cur.n} at {fmtClock(cur.end)}</span></>}
          {proj.phase === 'finished' && <><span className="k">Result</span><span>FINISHED {fmtTimeRel(proj.finish, now)}</span></>}
        </div>
        {proj.phase !== 'pre' && <div className="btnrow" style={{ marginBottom: 0 }}><button className="btn primary" onClick={() => go('now')}>Open NOW ›</button></div>}
      </div>

      <h2 className="sub">Roster · tap a name for their legs · tap a pace to change it</h2>
      <div className="list">
        {TEAM.runners.map(r => {
          const legs = LEGS.filter(l => state.assignments[l.n - 1] === r.id).map(l => l.n)
          const dropped = state.runnerStatus[r.id] === 'dropped'
          return (
            <div key={r.id} className="item" style={{ gridTemplateColumns: '1fr auto', opacity: dropped ? 0.6 : 1 }}>
              <button style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minHeight: 44 }} onClick={() => go(`runner/${r.id}`)}>
                <div className="t"><b>{r.short}</b> <span className="muted small">{r.name}</span>{r.id === me ? <span className="tag dim" style={{ marginLeft: 6 }}>YOU</span> : null}{dropped ? <span className="tag warn" style={{ marginLeft: 6 }}>DROPPED</span> : null}</div>
                <div className="s">Legs {legs.length ? legs.join(' · ') : '—'} · {runnerMiles(LEGS, state.assignments, r.id)} mi</div>
              </button>
              <button className="btn" onClick={() => setPace(r.id)}>{fmtPace(state.paces[r.id])}<span className="muted small">/mi</span></button>
            </div>
          )
        })}
      </div>
      {pace && <PaceSheet snap={snap} runnerId={pace} onClose={() => setPace(null)} />}
    </div>
  )
}
