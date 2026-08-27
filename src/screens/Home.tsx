import { useState } from 'react'
import { LEGS, TEAM, type Snapshot } from '../state/store'
import { useNow, isIOS, isStandalone } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtDelta, fmtDuration, fmtPace, fmtRelative, fmtTimeRel } from '../model/time'
import { runnerMiles } from '../model/projection'
import { PaceSheet } from './Runners'
import type { RunnerId } from '../model/types'

export function Home({ snap }: { snap: Snapshot }) {
  const now = useNow(30000)
  const { state, proj, settings, flags } = snap
  const [pace, setPace] = useState<RunnerId | null>(null)
  const totalMiles = Math.round(LEGS.reduce((a, l) => a + l.miles, 0) * 10) / 10
  const start = state.actual[0] ?? state.plannedStart
  const me = settings.iAmRunnerId
  const cur = proj.phase === 'racing' ? proj.legs[proj.currentLeg - 1] : null
  const myPaceSet = me ? state.paceEntered[me] : true

  return (
    <div className="page">
      <h1 className="title">Hood to Coast</h1>
      <div className="muted" style={{ marginTop: -6, marginBottom: 10 }}>{TEAM.teamName}</div>

      {proj.phase === 'pre' && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="bold" style={{ marginBottom: 6 }}>Tonight</div>
          <div className="kv">
            <span className="k">{flags.offlineReady ? '✓' : '○'}</span><span>Wait for "Ready offline" once (done on this phone{flags.offlineReady ? '' : ' — not yet'}).</span>
            {isIOS() && !isStandalone() && <><span className="k">○</span><span>iPhone: Share → Add to Home Screen, then open it from the icon.</span></>}
            <span className="k">{myPaceSet ? '✓' : '○'}</span><span>{me ? (myPaceSet ? 'Your pace is set.' : 'Set your pace (tap it in the roster below).') : 'Pick your name under Info, then set your pace.'}</span>
            <span className="k">○</span><span>Download offline Google Maps for Mt Hood → Portland → Seaside (Info).</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="kv">
          <span className="k">Start</span><span>{fmtTimeRel(start, now)} {state.actual[0] !== null ? '(actual)' : '(planned, Timberline)'}</span>
          <span className="k">Expected finish</span><span><b>{fmtTimeRel(proj.finish, now)}</b> · {fmtDelta(proj.deltaSec)}</span>
          <span className="k">Total time</span><span>{fmtDuration(proj.finish - start)} · {totalMiles} mi · 36 legs{state.hillAdjust ? ' · Hill-adj.' : ''}</span>
          {proj.phase === 'pre' && <><span className="k">Countdown</span><span>{fmtRelative(state.plannedStart, now).replace(/^in /, '')} to go</span></>}
          {cur && <><span className="k">Right now</span><span>Leg {cur.n} · {TEAM.runners.find(r => r.id === cur.runnerId)?.short} · Exch {cur.n} at {fmtClock(cur.end)}</span></>}
          {proj.phase === 'finished' && <><span className="k">Result</span><span>FINISHED {fmtTimeRel(proj.finish, now)}</span></>}
        </div>
        {proj.phase !== 'pre' && <div className="btnrow" style={{ marginBottom: 0 }}><button className="btn primary" onClick={() => go('now')}>Open NOW ›</button></div>}
      </div>

      <h2 className="sub">Roster</h2>
      <div className="muted small" style={{ marginBottom: 8 }}>Tap a name for their legs · tap a pace to set it.</div>
      <div className="list">
        {TEAM.runners.map(r => {
          const legs = LEGS.filter(l => state.assignments[l.n - 1] === r.id).map(l => l.n)
          const dropped = state.runnerStatus[r.id] === 'dropped'
          const isMe = r.id === me
          const entered = state.paceEntered[r.id]
          return (
            <div key={r.id} className="item" style={{ gridTemplateColumns: '1fr auto', opacity: dropped ? 0.6 : 1 }}>
              <button style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minHeight: 44 }} onClick={() => go(`runner/${r.id}`)}>
                <div className="t"><b>{r.short}</b> <span className="muted small">{r.name}</span>{isMe ? <span className="tag dim" style={{ marginLeft: 6 }}>YOU</span> : null}{dropped ? <span className="tag warn" style={{ marginLeft: 6 }}>DROPPED</span> : null}</div>
                <div className="s">Legs {legs.length ? legs.join(', ') : '—'} · {Math.round(runnerMiles(LEGS, state.assignments, r.id) * 10) / 10} mi</div>
              </button>
              <button className={'btn' + (isMe && !entered ? ' primary' : '')} onClick={() => setPace(r.id)}>
                {entered ? <>{fmtPace(state.paces[r.id])}<span className="muted small">/mi</span></> : isMe ? 'Set pace' : <span className="muted">no pace yet</span>}
              </button>
            </div>
          )
        })}
      </div>
      {pace && <PaceSheet snap={snap} runnerId={pace} onClose={() => setPace(null)} />}
    </div>
  )
}
