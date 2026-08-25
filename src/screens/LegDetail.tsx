import { useState } from 'react'
import { LEGS, TEAM, runnerShort, store, type Snapshot } from '../state/store'
import { useNow } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtDuration, fmtHMS, fmtTimeRel } from '../model/time'
import { difficultyLabel, mapsUrl } from '../model/helpers'
import { backToBack, runnerMiles, project } from '../model/projection'
import type { RaceState } from '../model/types'
import { ExpectSheet } from '../components/ExpectSheet'
import { HandoffSheet } from '../components/HandoffSheet'
import { Sheet } from '../components/Sheet'
import { N_LEGS } from '../model/events'

export function LegDetail({ snap, n }: { snap: Snapshot; n: number }) {
  const now = useNow(30000)
  const { state, proj } = snap
  const leg = LEGS[n - 1]
  const lp = proj.legs[n - 1]
  const [expect, setExpect] = useState(false)
  const [handoff, setHandoff] = useState<number | null>(null)
  const [changeRunner, setChangeRunner] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  if (!leg || !lp) return <div className="page"><button className="back" onClick={() => go('schedule')}>‹ Schedule</button><p>No such leg.</p></div>
  const prevEx = n === 1 ? 'Timberline Lodge (start)' : `Exch ${n - 1}`
  const gearWhy = lp.gear === 'NIGHT' ? 'overlaps 6 PM–7 AM → headlamp, vest, 2 flashers' : lp.gear === 'REFLECTIVE' ? 'overlaps 7–9 AM → reflective vest' : 'daylight'
  const isPre = proj.phase === 'pre'

  return (
    <div className="page">
      <button className="back" onClick={() => go('schedule')}>‹ Schedule</button>
      <h1 className="title">Leg {n} <span className="muted">· {leg.miles} mi · {difficultyLabel(leg.difficulty)}{leg.officialDifficulty ? ` (official: ${leg.officialDifficulty})` : ''}</span></h1>
      {leg.description && <p className="pre" style={{ marginTop: 0 }}>{leg.description}</p>}

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="kv">
          <span className="k">Runner</span><span><b>{runnerShort(lp.runnerId)}</b> {state.runnerStatus[lp.runnerId] === 'dropped' ? '(dropped!)' : ''}</span>
          <span className="k">Start · {prevEx}</span><span>{fmtTimeRel(lp.start, now)} {lp.startKind === 'actual' ? '✓' : lp.startKind === 'est' ? '(est.)' : ''}</span>
          <span className="k">Finish · Exch {n}</span><span>{fmtTimeRel(lp.end, now)} {lp.endKind === 'actual' ? '✓' : lp.endKind === 'est' ? '(est.)' : ''}</span>
          <span className="k">Expected time</span><span>{fmtHMS(lp.durationSec)}{lp.expectEdited ? ' (edited)' : ''}</span>
          <span className="k">Gear</span><span className={'badge gear' + (lp.gear === 'NIGHT' ? ' night' : '')}>{lp.gear}</span>
          <span className="k"></span><span className="small muted">{gearWhy}</span>
          <span className="k">Van LEAVE BY</span><span>{lp.leaveBy === 'now' ? 'leave immediately' : `${fmtClock(lp.leaveBy as number)} (drive ~${lp.driveMin} + walk ${lp.walkMin} min)`}</span>
        </div>
        <div className="btnrow" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => setExpect(true)}>Expected time</button>
          <button className="btn" onClick={() => setChangeRunner(true)}>Change runner</button>
          <button className="btn" disabled={isPre} title={isPre ? 'Race not started' : ''} onClick={() => setHandoff(n)}>Set handoff time{isPre ? ' (race not started)' : ''}</button>
        </div>
      </div>

      <h2 className="sub">Elevation</h2>
      <div className="kv"><span className="k">Gain / loss</span><span>+{leg.gain} / −{leg.loss} ft</span><span className="k">Net</span><span>{leg.net > 0 ? '+' : ''}{leg.net} ft</span></div>
      {leg.notes.length > 0 && <div className="note">{leg.notes.join(' · ')}</div>}

      <h2 className="sub">Van · {leg.vanSupport === 'no' ? 'NO VAN SUPPORT' : leg.vanSupport === 'restricted' ? 'RESTRICTED' : 'van support OK'}</h2>
      {leg.vanNote && <div className={leg.vanSupport === 'no' ? 'warn' : 'note'}>{leg.vanNote}</div>}
      <div className="kv">
        <span className="k">Exchange {n}</span><span><b>{leg.exchangeName}</b></span>
        {leg.address && <><span className="k">Address</span><span style={{ userSelect: 'all' }}>{leg.address}</span></>}
        {leg.lat != null && <><span className="k">GPS</span><span style={{ userSelect: 'all' }}>{leg.lat}, {leg.lng}</span></>}
      </div>
      <div className="btnrow">
        <a className="btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={mapsUrl(leg)} target="_blank" rel="noreferrer">Open in Maps ↗</a>
        {leg.pdfUrl && <a className="btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={leg.pdfUrl} target="_blank" rel="noreferrer">Official map (PDF) ↗</a>}
        {leg.videoId && <a className="btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`https://www.youtube.com/watch?v=${leg.videoId}`} target="_blank" rel="noreferrer">Video tour ↗</a>}
      </div>
      {leg.vanRouteNote && <><div className="muted small">Exchange notes (official)</div><p className="pre">{leg.vanRouteNote}</p></>}
      {leg.vanDirections && leg.vanDirections.length > 0 && <><div className="muted small">{leg.vanDirections.length ? 'Van route (official)' : ''}</div><p className="pre">{leg.vanDirections.join('\n')}</p></>}

      {leg.runnerDirections && leg.runnerDirections.length > 0 && (
        <><h2 className="sub">Runner directions (official)</h2><p className="pre">{leg.runnerDirections.join('\n')}</p></>
      )}
      {leg.namedAfter && <div className="muted small">Leg named after {leg.namedAfter}</div>}

      <h2 className="sub">Note</h2>
      {note == null ? (
        <div className="row"><span className="grow pre">{state.notes[n] || <span className="muted">e.g. "exchange is on the LEFT"</span>}</span><button className="btn" onClick={() => setNote(state.notes[n] || '')}>Edit</button></div>
      ) : (
        <div>
          <textarea className="plain" value={note} onChange={e => setNote(e.target.value)} />
          <div className="btnrow"><button className="btn primary" onClick={() => { store.dispatch('note_set', { leg: n, text: note }); setNote(null) }}>Save</button><button className="btn" onClick={() => setNote(null)}>Cancel</button></div>
        </div>
      )}

      <div className="btnrow" style={{ marginTop: 16 }}>
        {n > 1 && <button className="btn" onClick={() => go(`leg/${n - 1}`)}>‹ Leg {n - 1}</button>}
        {n < N_LEGS && <button className="btn" onClick={() => go(`leg/${n + 1}`)}>Leg {n + 1} ›</button>}
      </div>

      {expect && <ExpectSheet open snap={snap} leg={n} onClose={() => setExpect(false)} />}
      {handoff != null && <HandoffSheet open snap={snap} frozenAt={state.actual[n] ?? Math.min(store.now(), lp.end)} presetLeg={n} onClose={() => setHandoff(null)} onLogged={() => setHandoff(null)} />}
      {changeRunner && <ChangeRunnerSheet snap={snap} n={n} onClose={() => setChangeRunner(false)} />}
    </div>
  )
}

export function ChangeRunnerSheet({ snap, n, onClose }: { snap: Snapshot; n: number; onClose: () => void }) {
  const { state, proj } = snap
  const cur = state.assignments[n - 1]
  const [pick, setPick] = useState<string>(cur)
  const b2b = backToBack(state, n, pick).filter(x => pick !== cur || x !== n)
  const alt: RaceState = { ...state, assignments: state.assignments.map((r, i) => (i === n - 1 ? pick : r)) }
  const altProj = pick !== cur ? project(TEAM, LEGS, alt) : proj
  return (
    <Sheet open onClose={onClose}>
      <h2 style={{ fontSize: 26 }}>Leg {n}: who runs it?</h2>
      <div className="names">currently {runnerShort(cur)}</div>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {TEAM.runners.map(r => <button key={r.id} className={'chip name' + (r.id === pick ? ' sel' : '') + (state.runnerStatus[r.id] === 'dropped' ? ' done' : '')} onClick={() => setPick(r.id)}>{r.short}{state.runnerStatus[r.id] === 'dropped' ? ' (dropped)' : ''}</button>)}
      </div>
      {pick !== cur && b2b.length > 0 && <div className="warn">{runnerShort(pick)} would run {[n, ...b2b].sort((a, b) => a - b).join(' + ')} back-to-back</div>}
      {pick !== cur && (
        <div className="effect">
          Leg {n}: {runnerShort(cur)} → <b>{runnerShort(pick)}</b> · {runnerShort(pick)}: {runnerMiles(LEGS, state.assignments, pick)} → <b>{runnerMiles(LEGS, alt.assignments, pick)} mi</b>
          <br />finish {fmtClock(proj.finish)} → <b>{fmtClock(altProj.finish)}</b> ({fmtDuration(Math.abs(altProj.finish - proj.finish))} {altProj.finish >= proj.finish ? 'later' : 'earlier'})
        </div>
      )}
      <button className="confirm" disabled={pick === cur} onClick={() => { store.dispatch('assignment_set', { leg: n, runnerId: pick }); onClose() }}>CONFIRM Leg {n} → {runnerShort(pick)}</button>
      <button className="cancel" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}
