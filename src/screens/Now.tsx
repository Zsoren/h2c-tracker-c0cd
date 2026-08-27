import { useEffect, useState } from 'react'
import { LEGS, TEAM, runnerShort, store, type Snapshot } from '../state/store'
import { useNow } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtDelta, fmtDuration, fmtRelative, fmtTimeRel } from '../model/time'
import { mapsUrl, reminders } from '../model/helpers'
import { gearLabel } from '../model/projection'
import { showIJustFinished } from '../model/sheet'
import { HandoffSheet } from '../components/HandoffSheet'
import { ExpectSheet } from '../components/ExpectSheet'
import { StatusLine } from '../components/StatusLine'
import { Sheet } from '../components/Sheet'
import { N_LEGS } from '../model/events'

interface Toast { eventId: string; text: string; until: number }
const MIN = 60000
const NAMES: Record<string, string> = Object.fromEntries(TEAM.runners.map(r => [r.id, r.short]))

export function Now({ snap }: { snap: Snapshot }) {
  const now = useNow(10000)
  const { state, proj, settings } = snap
  const [sheet, setSheet] = useState<{ at: number; preset: number | null } | null>(null)
  const [expect, setExpect] = useState<number | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), Math.max(0, toast.until - Date.now()))
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => { if (toast && !snap.events.some(e => e.id === toast.eventId)) setToast(null) }, [snap.events, toast])

  const phase = proj.phase
  const n = proj.currentLeg
  const lp = phase === 'racing' ? proj.legs[n - 1] : null
  const leg = lp ? LEGS[n - 1] : null
  const nextLp = phase === 'racing' && n + 1 <= N_LEGS ? proj.legs[n] : null
  const me = settings.iAmRunnerId
  const myNext = me ? proj.legs.find(l => l.runnerId === me && l.n >= Math.max(1, n)) ?? null : null
  const iJust = showIJustFinished(proj, state, me)
  const overdue = lp ? now - lp.end : 0                     // >0 once the runner was expected
  const stale = phase === 'racing' && overdue > 30 * MIN
  const openSheet = (preset: number | null = null) => setSheet({ at: store.now(), preset })

  // LEAVE row, one statement: "LEAVE · by 10:07 AM · in 13 min" → "LEAVE NOW · latest 10:07 AM" (last 10 min)
  // → "LATE · should have left 10:07 AM · 9 min ago". Amber only around the deadline.
  let leaveKey = 'LEAVE', leaveText = '', leaveAmber = false
  if (lp) {
    if (lp.leaveBy === 'now') {
      leaveKey = 'LEAVE NOW'
      leaveText = `from ${n === 1 ? 'Timberline' : `Exch ${n - 1}`} right after the handoff`
      leaveAmber = now - lp.start < 10 * MIN
    } else {
      const deadline = lp.leaveBy as number
      const d = deadline - now
      if (d > 10 * MIN) { leaveKey = 'LEAVE'; leaveText = `by ${fmtClock(deadline)} · ${fmtRelative(deadline, now)}` }
      else if (d > 0) { leaveKey = 'LEAVE NOW'; leaveText = `latest ${fmtClock(deadline)}`; leaveAmber = true }
      else { leaveKey = 'LATE'; leaveText = `should have left ${fmtClock(deadline)} · ${fmtDuration(-d)} ago`; leaveAmber = -d < 10 * MIN }
    }
  }

  // conflict notes: a handoff another phone logged differently while offline (persistent until dismissed)
  const conflict = Object.entries(state.alternates)
    .filter(([k]) => k.startsWith('handoff:'))
    .flatMap(([k, alts]) => alts.map(a => ({ leg: +k.split(':')[1], loser: a.event, winner: a.winner })))
    .find(c => !settings.dismissedAlts.includes(c.loser.id)) ?? null
  const rems = reminders(LEGS, proj, now, NAMES).slice(0, conflict ? 1 : 2)

  function onLogged(eventId: string, legN: number, at: number) {
    setSheet(null)
    const text = legN === 0 ? `Race started ${fmtClock(at)}` : legN === N_LEGS ? `FINISHED ${fmtClock(at)}` : `Logged Leg ${legN} at ${fmtClock(at)}`
    setToast({ eventId, text, until: Date.now() + 10000 })
  }
  function undo() { if (toast) { store.undo(toast.eventId); setToast(null) } }

  return (
    <div className="now">
      <StatusLine snap={snap} />

      {/* Running card */}
      {phase === 'pre' && (
        <div className="card running">
          <div className="lhead" onClick={() => go('leg/1')}><span className="legtag">LEG 1</span><span className="grow ellip">Timberline → Exch 1 · {LEGS[0].exchangeName}</span><span className="chev">›</span></div>
          <div className="who">{runnerShort(state.assignments[0])} · {LEGS[0].miles} mi · {gearLabel(proj.legs[0].gear)}</div>
          <div className="eta">{fmtRelative(state.plannedStart, now).replace(/^in /, '')}<span className="adj">to start</span></div>
          <div className="sub">Race starts {fmtTimeRel(state.plannedStart, now)}</div>
        </div>
      )}
      {phase === 'racing' && lp && leg && (
        <div className="card running">
          <div className="lhead" onClick={() => go(`leg/${n}`)}><span className="legtag">LEG {n}</span><span className="grow ellip">→ Exch {n} · {leg.exchangeName}</span><span className="chev">›</span></div>
          <div className="who" onClick={() => go(`leg/${n}`)}>{runnerShort(lp.runnerId)} · {leg.miles} mi · started {fmtClock(lp.start)}{lp.startKind === 'est' ? ' (est.)' : ''}</div>
          <div className="eta" onClick={() => setExpect(n)} role="button" aria-label="Adjust expected time">
            {fmtClock(lp.end)}<span className="adj">adjust</span>
          </div>
          <div className="sub" onClick={() => stale ? openSheet() : setExpect(n)}>
            {stale ? `was due ${fmtClock(lp.end)} · nothing logged since Exch ${n - 1} — tap LOG HANDOFF`
              : overdue > 0 ? `was due at Exch ${n} ${fmtRelative(lp.end, now)} — log the handoff when they're in`
              : `arrives at Exch ${n} ${fmtRelative(lp.end, now)}`}{!stale && lp.expectEdited ? ' · (edited)' : ''}
          </div>
        </div>
      )}
      {phase === 'finished' && (
        <div className="card running">
          <div className="lhead"><span className="legtag">DONE</span><span className="grow ellip">Hood to Coast 2026 · Seaside</span></div>
          <div className="eta">FINISHED</div>
          <div className="who">{fmtTimeRel(proj.finish, now)}</div>
          <div className="sub">{fmtDelta(proj.deltaSec)} · total {fmtDuration(proj.finish - (state.actual[0] ?? state.plannedStart))}</div>
        </div>
      )}

      {/* Up next: LEAVE + NEXT in one card */}
      {phase === 'racing' && lp && leg && (
        <div className={'card group' + (leaveAmber ? ' urgent' : '')}>
          <div className="line" onClick={() => go(`leg/${n}`)}>
            <span className={'k nowrap' + (leaveAmber ? ' amber' : '')}>{leaveKey}</span>
            <span className="grow ellip">{leaveText}</span>
            <a className="maps" href={mapsUrl(leg)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} aria-label={`Directions to ${n === 36 ? 'Seaside' : 'Exch ' + n}`}>Maps ↗</a>
          </div>
          {nextLp && (
            <div className="line" onClick={() => go(`leg/${n + 1}`)}>
              <span className="k">NEXT</span>
              <span className="grow ellip"><b>Leg {n + 1}</b> · {runnerShort(nextLp.runnerId)} · {LEGS[n].miles} mi</span>
              <span className={'badge gear' + (nextLp.gear === 'NIGHT' ? ' night' : '')}>{gearLabel(nextLp.gear)}</span>
            </div>
          )}
        </div>
      )}

      {/* spare height lands here on tall phones */}
      <div className="spacer" />

      {/* Quiet facts: you, team finish */}
      {me && phase !== 'finished' && (
        <div className="line small you">
          <span className="k">You</span>
          <span className="grow ellip" onClick={() => myNext && go(`leg/${myNext.n}`)}>
            {!myNext ? 'all legs done' : myNext.n === n ? `Leg ${n} · running now` : `Leg ${myNext.n} ${fmtRelative(myNext.start, now)}`}
          </span>
          {iJust != null && <button className="link" onClick={() => openSheet(iJust)}>I just finished</button>}
        </div>
      )}
      {phase !== 'finished' && (
        <div className="line small finishline" onClick={() => go('home')}><span className="k">Team finish</span><span className="grow ellip"><b>{fmtTimeRel(proj.finish, now)}</b> · {fmtDelta(proj.deltaSec)}</span></div>
      )}

      {/* Reminders */}
      <div className="rem">
        {conflict && (
          <div className="remline warn rem1" onClick={() => setConflictOpen(true)}>
            {conflict.loser.deviceId === settings.deviceId
              ? `Leg ${conflict.leg} set to ${fmtClock(conflict.winner.payload.at as number)} by ${conflict.winner.role === 'captain' ? "captain's" : 'another'} phone (yours: ${fmtClock(conflict.loser.payload.at as number)}) · tap`
              : `Leg ${conflict.leg} also logged ${fmtClock(conflict.loser.payload.at as number)} on another phone · tap`}
          </div>
        )}
        {snap.flags.notice && snap.flags.notice.until > Date.now() && <div className="remline warn rem1">↓ {snap.flags.notice.text}</div>}
        {rems.map((r, i) => <div key={r.key} className={'remline rem' + (i + (conflict ? 2 : 1)) + (r.key === 'stale' ? ' warn' : '')}>{r.text}</div>)}
      </div>
      {conflict && conflictOpen && (
        <Sheet open onClose={() => setConflictOpen(false)}>
          <h2 style={{ fontSize: 24 }}>Leg {conflict.leg} handoff — two times</h2>
          <div className="names">Kept <b>{fmtClock(conflict.winner.payload.at as number)}</b> ({conflict.winner.role === 'captain' ? "captain's phone" : conflict.winner.deviceId === settings.deviceId ? 'this phone' : 'another phone'}) · other: <b>{fmtClock(conflict.loser.payload.at as number)}</b> ({conflict.loser.deviceId === settings.deviceId ? 'this phone' : 'another phone'})</div>
          <button className="confirm" onClick={() => { store.dispatch('handoff_logged', { leg: conflict.leg, at: conflict.loser.payload.at }); store.setSettings({ dismissedAlts: [...settings.dismissedAlts, conflict.loser.id] }); setConflictOpen(false) }}>Use {fmtClock(conflict.loser.payload.at as number)} instead</button>
          <button className="cancel" onClick={() => { store.setSettings({ dismissedAlts: [...settings.dismissedAlts, conflict.loser.id] }); setConflictOpen(false) }}>Keep {fmtClock(conflict.winner.payload.at as number)}</button>
        </Sheet>
      )}

      {/* Button / toast */}
      {toast ? (
        <div className="toast"><span>{toast.text}</span><button onClick={undo}>UNDO</button></div>
      ) : phase === 'pre' ? (
        <button className="bigbtn" onClick={() => openSheet(0)}>START RACE<span className="sub">Leg 1 — {runnerShort(state.assignments[0])}</span></button>
      ) : phase === 'racing' ? (
        <button className="bigbtn" onClick={() => openSheet()}>{n === N_LEGS ? 'LOG FINISH' : 'LOG HANDOFF'}<span className="sub">{stale ? 'Which exchange are you at?' : n === N_LEGS ? `Leg 36 — ${runnerShort(lp!.runnerId)}` : `Leg ${n} → ${n + 1} at Exch ${n}`}</span></button>
      ) : (
        <div className="bigbtn done">FINISHED {fmtTimeRel(proj.finish, now)} · {fmtDelta(proj.deltaSec)}</div>
      )}

      {sheet && <HandoffSheet open snap={snap} frozenAt={sheet.at} presetLeg={sheet.preset} onClose={() => setSheet(null)} onLogged={onLogged} />}
      {expect != null && <ExpectSheet open snap={snap} leg={expect} onClose={() => setExpect(null)} />}
    </div>
  )
}
