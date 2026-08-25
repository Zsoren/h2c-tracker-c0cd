import { useEffect, useState } from 'react'
import { LEGS, TEAM, runnerShort, store, type Snapshot } from '../state/store'
import { useNow } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtDelta, fmtDuration, fmtRelative, fmtTimeRel } from '../model/time'
import { defaultDriver, reminders } from '../model/helpers'
import { showIJustFinished } from '../model/sheet'
import { HandoffSheet } from '../components/HandoffSheet'
import { ExpectSheet } from '../components/ExpectSheet'
import { StatusLine } from '../components/StatusLine'
import { Sheet } from '../components/Sheet'
import { N_LEGS } from '../model/events'

interface Toast { eventId: string; text: string; until: number }

export function Now({ snap }: { snap: Snapshot }) {
  const now = useNow(10000)
  const { state, proj, settings } = snap
  const [sheet, setSheet] = useState<{ at: number; preset: number | null } | null>(null)
  const [expect, setExpect] = useState<number | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [driverPick, setDriverPick] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), Math.max(0, toast.until - Date.now()))
    return () => clearTimeout(t)
  }, [toast])

  const phase = proj.phase
  const n = proj.currentLeg
  const lp = phase === 'racing' ? proj.legs[n - 1] : null
  const leg = lp ? LEGS[n - 1] : null
  const nextLp = phase === 'racing' && n + 1 <= N_LEGS ? proj.legs[n] : null
  const deckLp = phase === 'racing' && n + 2 <= N_LEGS ? proj.legs[n + 1] : null
  const me = settings.iAmRunnerId
  const myNext = me ? proj.legs.find(l => l.runnerId === me && l.n >= Math.max(1, n)) ?? null : null
  const iJust = showIJustFinished(proj, state, me)
  // conflict notes: a handoff another phone logged differently while offline (persistent until dismissed)
  const conflict = Object.entries(state.alternates)
    .filter(([k]) => k.startsWith('handoff:'))
    .flatMap(([k, alts]) => alts.map(a => ({ leg: +k.split(':')[1], loser: a.event, winner: a.winner })))
    .find(c => !settings.dismissedAlts.includes(c.loser.id)) ?? null
  const [conflictOpen, setConflictOpen] = useState(false)
  const rems = reminders(LEGS, proj, now).slice(0, conflict ? 1 : 2)
  const driver = lp ? (state.drivers[n] ?? defaultDriver(TEAM, state, n)) : null
  const late = lp && typeof lp.leaveBy === 'number' && now > lp.leaveBy
  const openSheet = (preset: number | null = null) => setSheet({ at: store.now(), preset })

  function onLogged(eventId: string, legN: number, at: number) {
    setSheet(null)
    const text = legN === 0 ? `Race started ${fmtClock(at)}` : legN === N_LEGS ? `FINISHED ${fmtClock(at)}` : `Logged Leg ${legN} at ${fmtClock(at)}`
    setToast({ eventId, text, until: Date.now() + 10000 })
  }
  function undo() { if (toast) { store.undo(toast.eventId); setToast(null) } }
  useEffect(() => { if (toast && !snap.events.some(e => e.id === toast.eventId)) setToast(null) }, [snap.events, toast])

  return (
    <div className="now">
      <StatusLine snap={snap} />

      {/* 2. Running */}
      {phase === 'pre' && (
        <div className="card running tap" onClick={() => go('leg/1')}>
          <div className="label">Race starts {fmtTimeRel(state.plannedStart, now)}</div>
          <div className="eta">{fmtRelative(state.plannedStart, now).replace(/^in /, '')}<span className="adj">to go</span></div>
          <div className="who">Leg 1 — {runnerShort(state.assignments[0])}</div>
          <div className="sub">{proj.legs[0].gear} GEAR · {LEGS[0].vanSupport === 'no' ? 'no van support' : ''}</div>
        </div>
      )}
      {phase === 'racing' && lp && leg && (
        <div className="card running">
          <div className="label" onClick={() => go(`leg/${n}`)}>Running · Leg {n} · {leg.miles} mi · started {fmtClock(lp.start)}{lp.startKind === 'est' ? ' (est.)' : ''}</div>
          <div className="who" onClick={() => go(`leg/${n}`)}>{runnerShort(lp.runnerId)}</div>
          <div className="eta" onClick={() => setExpect(n)} role="button" aria-label="Adjust expected time">
            {fmtClock(lp.end)}<span className="adj">adjust</span>
          </div>
          <div className="sub" onClick={() => go(`leg/${n}`)}>Exch {n} · {fmtRelative(lp.end, now)}{lp.expectEdited ? ' · (edited)' : ''}</div>
          <div className="sub finmini" style={{ display: 'none' }}>Finish {fmtTimeRel(proj.finish, now)} · {fmtDelta(proj.deltaSec)}</div>
        </div>
      )}
      {phase === 'finished' && (
        <div className="card running">
          <div className="label">Hood to Coast 2026</div>
          <div className="eta">FINISHED</div>
          <div className="who">{fmtTimeRel(proj.finish, now)}</div>
          <div className="sub">{fmtDelta(proj.deltaSec)} · total {fmtDuration(proj.finish - (state.actual[0] ?? state.plannedStart))}</div>
        </div>
      )}

      {/* 3. LEAVE BY + driver */}
      {phase === 'racing' && lp && (
        <div className={'line' + (late ? ' late' : '')} onClick={() => setDriverPick(true)}>
          <span className="k">LEAVE</span>
          <span className="grow ellip">{n === 1 ? 'Timberline' : `Exch ${n - 1}`} {lp.leaveBy === 'now' ? 'NOW' : `by ${fmtClock(lp.leaveBy as number)}`}{late ? ' · LATE' : ''}</span>
          <span className="nowrap">Driver: {runnerShort(driver)}</span>
        </div>
      )}

      {/* 4. Next */}
      {phase === 'racing' && nextLp && (
        <div className="line" onClick={() => go(`leg/${n + 1}`)}>
          <span className="k">Next</span>
          <span className="grow ellip">{runnerShort(nextLp.runnerId)} · Leg {n + 1}</span>
          <span className={'badge gear' + (nextLp.gear === 'NIGHT' ? ' night' : '')}>{nextLp.gear} GEAR</span>
        </div>
      )}

      {/* 5. On deck */}
      {phase === 'racing' && deckLp && (
        <div className="line small ondeck"><span className="k">On deck</span><span className="grow ellip">{runnerShort(deckLp.runnerId)} · Leg {n + 2} · {fmtRelative(deckLp.start, now)}</span></div>
      )}

      {/* 6. Finish */}
      {phase !== 'finished' && (
        <div className="line finishline"><span className="k">Finish</span><span className="grow ellip">{fmtTimeRel(proj.finish, now)}</span><span className="nowrap">{fmtDelta(proj.deltaSec)}</span></div>
      )}

      {/* 7. You */}
      {me && phase !== 'finished' && (
        <div className="line small you">
          <span className="k">You</span>
          <span className="grow ellip">{myNext ? `Leg ${myNext.n} ${fmtRelative(myNext.start, now)}` : 'all legs done'}</span>
          {iJust != null && <button className="link" onClick={() => openSheet(iJust)}>I just finished</button>}
        </div>
      )}

      {/* 8. Reminders */}
      <div className="rem">
        {conflict && (
          <div className="remline warn rem1" onClick={() => setConflictOpen(true)}>
            {conflict.loser.deviceId === settings.deviceId
              ? `Leg ${conflict.leg} set to ${fmtClock(conflict.winner.payload.at as number)} by ${conflict.winner.role === 'captain' ? "captain's" : 'another'} phone (yours: ${fmtClock(conflict.loser.payload.at as number)}) · tap`
              : `Leg ${conflict.leg} also logged ${fmtClock(conflict.loser.payload.at as number)} on another phone · tap`}
          </div>
        )}
        {rems.map((r, i) => <div key={r.key} className={'remline rem' + (i + (conflict ? 2 : 1)) + (r.key === 'novan' ? ' warn' : '')}>{r.text}</div>)}
      </div>
      {conflict && conflictOpen && (
        <Sheet open onClose={() => setConflictOpen(false)}>
          <h2 style={{ fontSize: 24 }}>Leg {conflict.leg} handoff — two times</h2>
          <div className="names">Kept <b>{fmtClock(conflict.winner.payload.at as number)}</b> ({conflict.winner.role === 'captain' ? "captain's phone" : conflict.winner.deviceId === settings.deviceId ? 'this phone' : 'another phone'}) · other: <b>{fmtClock(conflict.loser.payload.at as number)}</b> ({conflict.loser.deviceId === settings.deviceId ? 'this phone' : 'another phone'})</div>
          <button className="confirm" onClick={() => { store.dispatch('handoff_logged', { leg: conflict.leg, at: conflict.loser.payload.at }); store.setSettings({ dismissedAlts: [...settings.dismissedAlts, conflict.loser.id] }); setConflictOpen(false) }}>Use {fmtClock(conflict.loser.payload.at as number)} instead</button>
          <button className="cancel" onClick={() => { store.setSettings({ dismissedAlts: [...settings.dismissedAlts, conflict.loser.id] }); setConflictOpen(false) }}>Keep {fmtClock(conflict.winner.payload.at as number)}</button>
        </Sheet>
      )}

      {/* 9. Button / toast */}
      {toast ? (
        <div className="toast"><span>{toast.text}</span><button onClick={undo}>UNDO</button></div>
      ) : phase === 'pre' ? (
        <button className="bigbtn" onClick={() => openSheet(0)}>START RACE<span className="sub">Leg 1 — {runnerShort(state.assignments[0])}</span></button>
      ) : phase === 'racing' ? (
        <button className="bigbtn" onClick={() => openSheet()}>{n === N_LEGS ? 'LOG FINISH' : 'LOG HANDOFF'}<span className="sub">{n === N_LEGS ? `Leg 36 — ${runnerShort(lp!.runnerId)}` : `Leg ${n} → ${n + 1}`}</span></button>
      ) : (
        <div className="bigbtn done">FINISHED {fmtTimeRel(proj.finish, now)} · {fmtDelta(proj.deltaSec)}</div>
      )}

      {sheet && <HandoffSheet open snap={snap} frozenAt={sheet.at} presetLeg={sheet.preset} onClose={() => setSheet(null)} onLogged={onLogged} />}
      {expect != null && <ExpectSheet open snap={snap} leg={expect} onClose={() => setExpect(null)} />}
      {driverPick && lp && (
        <DriverPicker n={n} current={driver} onClose={() => setDriverPick(false)} />
      )}
    </div>
  )
}

function DriverPicker({ n, current, onClose }: { n: number; current: string | null; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose}>
      <h2 style={{ fontSize: 24 }}>Driver for Leg {n}</h2>
      <div className="names">Default: whoever ran 4 legs ago. Never the finisher, the runner out now, or the next runner.</div>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {TEAM.runners.map(r => <button key={r.id} className={'chip name' + (r.id === current ? ' sel' : '')} onClick={() => { store.dispatch('driver_set', { leg: n, runnerId: r.id }); onClose() }}>{r.short}</button>)}
      </div>
      <button className="cancel" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}
