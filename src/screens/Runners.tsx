import { useState } from 'react'
import { LEGS, TEAM, runnerShort, store, type Snapshot } from '../state/store'
import { useNow } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtHMS, fmtPace, fmtTimeRel } from '../model/time'
import { project, runnerMiles, suggestReplacement, backToBack } from '../model/projection'
import { Sheet } from '../components/Sheet'
import type { RaceState, RunnerId } from '../model/types'

/** One runner: their legs and times, pace, actual paces, drop/reactivate. */
export function RunnerDetail({ snap, id }: { snap: Snapshot; id: RunnerId }) {
  const now = useNow(30000)
  const { state, proj, settings } = snap
  const r = TEAM.runners.find(x => x.id === id)
  const [pace, setPace] = useState(false)
  const [drop, setDrop] = useState(false)
  if (!r) return <div className="page"><button className="back" onClick={() => go('home')}>‹ Home</button><p>No such runner.</p></div>
  const legs = proj.legs.filter(l => l.runnerId === r.id)
  const miles = runnerMiles(LEGS, state.assignments, r.id)
  const climb = legs.reduce((a, l) => a + LEGS[l.n - 1].gain, 0)
  const dropped = state.runnerStatus[r.id] === 'dropped'
  const actuals = legs.filter(l => l.startKind === 'actual' && l.endKind === 'actual')
  return (
    <div className="page">
      <button className="back" onClick={() => go('home')}>‹ Home</button>
      <h1 className="title">{r.short} <span className="muted">· {r.name}</span>{r.id === settings.iAmRunnerId ? <span className="tag dim" style={{ marginLeft: 8 }}>YOU</span> : null}{dropped ? <span className="tag warn" style={{ marginLeft: 8 }}>DROPPED</span> : null}</h1>
      <div className="card">
        <div className="kv">
          <span className="k">Pace</span><span><button className="btn" onClick={() => setPace(true)}>{state.paceEntered[r.id] ? `${fmtPace(state.paces[r.id])}/mi · change` : <span className="amber">Set pace</span>}</button></span>
          <span className="k">Legs</span><span>{legs.length} · {miles} mi · +{climb} ft climb</span>
        </div>
      </div>
      <h2 className="sub">Legs</h2>
      <div className="list">
        {legs.map(l => {
          const L = LEGS[l.n - 1]
          return (
            <button key={l.n} className={'item' + (proj.phase === 'racing' && proj.currentLeg === l.n ? ' current' : '')} onClick={() => go(`leg/${l.n}`)}>
              <div className="n">{l.n}</div>
              <div>
                <div className="t">{L.miles} mi · {fmtHMS(l.durationSec)}{l.expectEdited ? ' (edited)' : ''}{l.endKind === 'actual' && l.startKind === 'actual' ? ` · ran ${fmtPace(l.durationSec / L.miles)}/mi` : l.endKind === 'est' ? ' · est.' : ''}</div>
                <div className="s"><span className={'badge gear' + (l.gear === 'NIGHT' ? ' night' : '')}>{l.gear}</span>{L.vanSupport === 'no' && <span className="badge">NO VAN</span>}{L.notes.map(x => <span key={x} className="badge">{x.replace('Little/No Shade', 'NO SHADE').replace(' (Poss Dust)', '').toUpperCase()}</span>)}</div>
              </div>
              <div className="r"><div>{fmtTimeRel(l.start, now)}</div><div>→ {fmtClock(l.end)}</div></div>
            </button>
          )
        })}
      </div>
      {actuals.length > 0 && legs.some(l => l.endKind === 'projected') && (
        <div className="btnrow"><button className="btn" onClick={() => {
          const last = actuals[actuals.length - 1]
          store.dispatch('pace_set', { runnerId: r.id, paceSec: Math.round(last.durationSec / LEGS[last.n - 1].miles) })
        }}>Use latest actual pace ({fmtPace(actuals[actuals.length - 1].durationSec / LEGS[actuals[actuals.length - 1].n - 1].miles)}) for remaining legs</button></div>
      )}
      <h2 className="sub">If {r.short} can't continue</h2>
      {!dropped
        ? <div className="btnrow"><button className="btn" onClick={() => setDrop(true)}>Drop runner…</button></div>
        : <div className="btnrow"><button className="btn" onClick={() => store.dispatch('runner_status_set', { runnerId: r.id, status: 'active' })}>Reactivate</button></div>}
      {pace && <PaceSheet snap={snap} runnerId={r.id} onClose={() => setPace(false)} />}
      {drop && <DropSheet snap={snap} runnerId={r.id} onClose={() => setDrop(false)} />}
    </div>
  )
}

export function PaceSheet({ snap, runnerId, onClose }: { snap: Snapshot; runnerId: RunnerId; onClose: () => void }) {
  const { state, proj } = snap
  const cur = state.paces[runnerId]
  const entered = state.paceEntered[runnerId]
  const [text, setText] = useState(entered ? fmtPace(cur) : '')
  let sec = cur
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (m) sec = +m[1] * 60 + +m[2]
  const alt = project(TEAM, LEGS, { ...state, paces: { ...state.paces, [runnerId]: sec } })
  const remaining = proj.legs.filter(l => l.runnerId === runnerId && l.endKind === 'projected').length
  return (
    <Sheet open onClose={onClose}>
      <h2 style={{ fontSize: 26 }}>{entered ? `${runnerShort(runnerId)}'s pace` : `Set ${runnerShort(runnerId)}'s pace`}</h2>
      <div className="names">average flat pace, min:sec per mile{entered ? '' : ' — nothing entered yet'}</div>
      <div className="timebox"><input type="text" inputMode="numeric" value={text} onChange={e => setText(e.target.value)} placeholder="9:30" autoFocus={!entered} /></div>
      {entered && <div className="chips">{[-30, -15, 15, 30].map(d => <button key={d} className="chip sm" onClick={() => setText(fmtPace(Math.max(240, sec + d)))}>{d > 0 ? '+' : ''}{d}s</button>)}</div>}
      <div className="effect">Changes {remaining} remaining leg{remaining === 1 ? '' : 's'} · finish {fmtClock(proj.finish)} → <b>{fmtClock(alt.finish)}</b></div>
      <button className="confirm" disabled={!m || (entered && sec === cur)} onClick={() => { store.dispatch('pace_set', { runnerId, paceSec: sec }); onClose() }}>SAVE {m ? fmtPace(sec) + '/mi' : ''}</button>
      <button className="cancel" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}

export function DropSheet({ snap, runnerId, onClose }: { snap: Snapshot; runnerId: RunnerId; onClose: () => void }) {
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
