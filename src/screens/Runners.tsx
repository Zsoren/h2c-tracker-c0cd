import { useState } from 'react'
import { LEGS, TEAM, runnerShort, store, type Snapshot } from '../state/store'
import { useNow } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtHMS, fmtPace, fmtTimeRel } from '../model/time'
import { project, runnerMiles, suggestReplacement, backToBack } from '../model/projection'
import { Sheet } from '../components/Sheet'
import type { RaceState, RunnerId } from '../model/types'

export function Runners({ snap }: { snap: Snapshot }) {
  const now = useNow(30000)
  const { state, proj, settings } = snap
  const [pace, setPace] = useState<RunnerId | null>(null)
  const [drop, setDrop] = useState<RunnerId | null>(null)
  const me = settings.iAmRunnerId
  const order = [...TEAM.runners].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0))
  return (
    <div className="page">
      <h1 className="title">Runners</h1>
      <div className="list">
        {order.map(r => {
          const legs = proj.legs.filter(l => l.runnerId === r.id)
          const miles = runnerMiles(LEGS, state.assignments, r.id)
          const climb = legs.reduce((a, l) => a + LEGS[l.n - 1].gain, 0)
          const dropped = state.runnerStatus[r.id] === 'dropped'
          const actuals = legs.filter(l => l.startKind === 'actual' && l.endKind === 'actual')
          return (
            <div key={r.id} className="card" style={{ opacity: dropped ? 0.6 : 1 }}>
              <div className="row">
                <div className="grow"><b style={{ fontSize: 19 }}>{r.short}</b>{r.id === me ? <span className="tag dim" style={{ marginLeft: 8 }}>YOU</span> : null}{dropped ? <span className="tag warn" style={{ marginLeft: 8 }}>DROPPED</span> : null}</div>
                <button className="btn" onClick={() => setPace(r.id)}>{fmtPace(state.paces[r.id])}/mi</button>
              </div>
              <div className="muted small">{legs.length} legs · {miles} mi · +{climb} ft</div>
              <div className="list" style={{ marginTop: 8, gap: 4 }}>
                {legs.map(l => (
                  <button key={l.n} className="row" style={{ background: 'none', border: 0, padding: '4px 0', textAlign: 'left', minHeight: 36 }} onClick={() => go(`leg/${l.n}`)}>
                    <span className="nowrap"><b>Leg {l.n}</b> · {LEGS[l.n - 1].miles} mi</span>
                    <span className="grow ellip muted small">{fmtTimeRel(l.start, now)} → {fmtClock(l.end)} · {fmtHMS(l.durationSec)}{l.endKind === 'actual' && l.startKind === 'actual' ? ' ✓' : l.endKind === 'est' ? ' est.' : ''}</span>
                    <span className={'badge gear' + (l.gear === 'NIGHT' ? ' night' : '')}>{l.gear}</span>
                  </button>
                ))}
              </div>
              {actuals.length > 0 && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Actual pace: {actuals.map(l => `Leg ${l.n} ${fmtPace(l.durationSec / LEGS[l.n - 1].miles)}`).join(' · ')}
                  {legs.some(l => l.endKind === 'projected') && (
                    <button className="link" style={{ background: 'none', border: 0, color: 'var(--amber)', fontWeight: 800, padding: '0 6px', minHeight: 32 }} onClick={() => {
                      const last = actuals[actuals.length - 1]
                      const p = Math.round(last.durationSec / LEGS[last.n - 1].miles)
                      store.dispatch('pace_set', { runnerId: r.id, paceSec: p })
                    }}>use latest for remaining legs</button>
                  )}
                </div>
              )}
              {!dropped && <div className="btnrow" style={{ marginBottom: 0 }}><button className="btn" onClick={() => setDrop(r.id)}>Drop runner…</button></div>}
              {dropped && <div className="btnrow" style={{ marginBottom: 0 }}><button className="btn" onClick={() => store.dispatch('runner_status_set', { runnerId: r.id, status: 'active' })}>Reactivate</button></div>}
            </div>
          )
        })}
      </div>
      {pace && <PaceSheet snap={snap} runnerId={pace} onClose={() => setPace(null)} />}
      {drop && <DropSheet snap={snap} runnerId={drop} onClose={() => setDrop(null)} />}
    </div>
  )
}

function PaceSheet({ snap, runnerId, onClose }: { snap: Snapshot; runnerId: RunnerId; onClose: () => void }) {
  const { state, proj } = snap
  const cur = state.paces[runnerId]
  const [text, setText] = useState(fmtPace(cur))
  let sec = cur
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (m) sec = +m[1] * 60 + +m[2]
  const alt = project(TEAM, LEGS, { ...state, paces: { ...state.paces, [runnerId]: sec } })
  const remaining = proj.legs.filter(l => l.runnerId === runnerId && l.endKind === 'projected').length
  return (
    <Sheet open onClose={onClose}>
      <h2 style={{ fontSize: 26 }}>{runnerShort(runnerId)}'s pace</h2>
      <div className="names">flat pace, min:sec per mile</div>
      <div className="timebox"><input type="text" inputMode="numeric" value={text} onChange={e => setText(e.target.value)} placeholder="10:00" /></div>
      <div className="chips">{[-30, -15, 15, 30].map(d => <button key={d} className="chip sm" onClick={() => setText(fmtPace(Math.max(240, sec + d)))}>{d > 0 ? '+' : ''}{d}s</button>)}</div>
      <div className="effect">Changes {remaining} remaining leg{remaining === 1 ? '' : 's'} · finish {fmtClock(proj.finish)} → <b>{fmtClock(alt.finish)}</b></div>
      <button className="confirm" disabled={!m || sec === cur} onClick={() => { store.dispatch('pace_set', { runnerId, paceSec: sec }); onClose() }}>SAVE {fmtPace(sec)}/mi</button>
      <button className="cancel" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}

function DropSheet({ snap, runnerId, onClose }: { snap: Snapshot; runnerId: RunnerId; onClose: () => void }) {
  const { state, proj } = snap
  const remaining = proj.legs.filter(l => l.runnerId === runnerId && l.n >= Math.max(1, proj.currentLeg)).map(l => l.n)
  const [picks, setPicks] = useState<Record<number, RunnerId>>(() => {
    const out: Record<number, RunnerId> = {}
    let s: RaceState = { ...state, runnerStatus: { ...state.runnerStatus, [runnerId]: 'dropped' } }
    for (const n of remaining) {
      const p = project(TEAM, LEGS, s)
      const pick = suggestReplacement(TEAM, LEGS, s, p, n, [runnerId]) ?? TEAM.runners.find(r => r.id !== runnerId)!.id
      out[n] = pick
      s = { ...s, assignments: s.assignments.map((r, i) => (i === n - 1 ? pick : r)) }
    }
    return out
  })
  const altState: RaceState = { ...state, runnerStatus: { ...state.runnerStatus, [runnerId]: 'dropped' }, assignments: state.assignments.map((r, i) => picks[i + 1] ?? r) }
  const alt = project(TEAM, LEGS, altState)
  const affected = [...new Set(Object.values(picks))]
  return (
    <Sheet open onClose={onClose}>
      <h2 style={{ fontSize: 26 }}>Drop {runnerShort(runnerId)}</h2>
      <div className="names">{remaining.length ? `Reassign remaining leg${remaining.length === 1 ? '' : 's'} ${remaining.join(', ')}` : 'No remaining legs'}</div>
      {remaining.map(n => (
        <div key={n}>
          <div className="sec">Leg {n} → {runnerShort(picks[n])}</div>
          <div className="chips">
            {TEAM.runners.filter(r => r.id !== runnerId && state.runnerStatus[r.id] === 'active').map(r => <button key={r.id} className={'chip name' + (picks[n] === r.id ? ' sel' : '')} onClick={() => setPicks({ ...picks, [n]: r.id })}>{r.short}</button>)}
          </div>
          {backToBack(altState, n, picks[n]).length > 0 && <div className="warn">{runnerShort(picks[n])} would run {[n, ...backToBack(altState, n, picks[n])].sort((a, b) => a - b).join(' + ')} back-to-back</div>}
        </div>
      ))}
      <div className="effect">
        {affected.map(r => <span key={r}>{runnerShort(r)}: {runnerMiles(LEGS, state.assignments, r)} → <b>{runnerMiles(LEGS, altState.assignments, r)} mi</b> · </span>)}
        <br />finish {fmtClock(proj.finish)} → <b>{fmtClock(alt.finish)}</b>
      </div>
      <button className="confirm" onClick={() => {
        for (const n of remaining) store.dispatch('assignment_set', { leg: n, runnerId: picks[n] })
        store.dispatch('runner_status_set', { runnerId, status: 'dropped' })
        onClose()
      }}>CONFIRM DROP</button>
      <button className="cancel" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}
