import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { LEGS, TEAM, runnerShort, store } from '../state/store'
import type { Snapshot } from '../state/store'
import { defaultLeg, suggestedLeg, currentLegOf, mismatchWarning, skipInfo } from '../model/sheet'
import { validateHandoff } from '../model/projection'
import { fmtClock, fmtDuration, fmtTimeRel } from '../model/time'
import { fromHHMM, toHHMM } from '../model/helpers'
import { N_LEGS } from '../model/events'

export interface HandoffSheetProps {
  open: boolean
  snap: Snapshot
  /** frozen "now" when the sheet was opened */
  frozenAt: number
  /** pre-selected leg (e.g. from "I just finished"); overrides the default */
  presetLeg?: number | null
  onClose: () => void
  onLogged: (eventId: string, leg: number, at: number) => void
}

export function HandoffSheet({ open, snap, frozenAt, presetLeg, onClose, onLogged }: HandoffSheetProps) {
  const { state, proj, settings, sync } = snap
  const initial = useMemo(() => presetLeg ?? defaultLeg(proj, frozenAt), [presetLeg, proj, frozenAt])
  const [leg, setLeg] = useState<number | null>(initial)
  const [at, setAt] = useState<number>(frozenAt)
  const [hhmm, setHhmm] = useState<string>(toHHMM(frozenAt))
  const [sameRunner, setSameRunner] = useState(false)
  const chipsRef = useRef<HTMLDivElement>(null)

  const stale = initial === null
  const suggested = stale ? suggestedLeg(proj, state, frozenAt) : null

  useEffect(() => { if (open) { setLeg(initial); setAt(frozenAt); setHhmm(toHHMM(frozenAt)); setSameRunner(false) } }, [open, initial, frozenAt])
  useEffect(() => {
    if (!open) return
    const target = leg ?? suggested
    if (target == null) return
    const el = chipsRef.current?.querySelector<HTMLElement>(`[data-leg="${target}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [open, leg, suggested])

  if (!open) return null

  const pre = proj.phase === 'pre'
  const isStart = leg === 0
  const isFinish = leg === N_LEGS
  const runnerOf = (n: number) => state.assignments[n - 1]
  const finisher = leg != null && leg >= 1 ? runnerOf(leg) : null
  const nextRunner = leg != null && leg + 1 <= N_LEGS ? runnerOf(leg + 1) : null
  const err = leg != null ? validateHandoff(state, leg, at, store.now()) : null
  const sinceLast = state.lastHandoffTs != null ? store.now() - state.lastHandoffTs : Infinity
  const recent = sinceLast >= 0 && sinceLast < 3 * 60000
  const recentSec = recent ? Math.round(sinceLast / 1000) : 0
  const skip = leg != null && leg >= 1 ? skipInfo(proj, state, leg, at) : null
  const mismatch = leg != null && leg >= 1 && !skip ? mismatchWarning(proj, leg, at) : false
  const nextSame = sameRunner && finisher && leg != null && leg + 1 <= N_LEGS
  const startGapMs = isStart ? Math.abs(at - state.plannedStart) : 0
  const startFarOff = isStart && startGapMs > 2 * 3600000
  const offlineMember = sync.mode === 'on' && !sync.online && !settings.isCaptain

  function setTime(hh: string) {
    setHhmm(hh)
    const t = fromHHMM(hh, frozenAt)
    if (t != null) setAt(t)
  }
  function nudge(min: number) {
    const t = at + min * 60000
    setAt(t); setHhmm(toHHMM(t))
  }
  function confirm() {
    if (leg == null || err) return
    if (nextSame && finisher) store.dispatch('assignment_set', { leg: leg + 1, runnerId: finisher })
    const e = store.dispatch('handoff_logged', { leg, at })
    onLogged(e.id, leg, at)
  }

  const title = leg == null ? 'Which exchange are you at?'
    : isStart ? 'START RACE'
    : isFinish ? 'LOG FINISH · Leg 36'
    : `Leg ${leg} → ${leg + 1} · Exch ${leg}`
  const names = leg == null ? '' : isStart ? `Leg 1 — ${runnerShort(runnerOf(1))} goes out` : isFinish ? `${runnerShort(finisher)} crosses the line` : `${runnerShort(finisher)} → ${runnerShort(nextSame ? finisher : nextRunner)}`

  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{title}</h2>
      <div className="names">{names || ' '}</div>

      {stale && (
        <>
          {suggested != null && (
            <button className={'chip name' + (leg === suggested ? ' sel' : '')} style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }} onClick={() => setLeg(suggested)}>
              Probably Exch {suggested} — {runnerShort(runnerOf(suggested))} just finished Leg {suggested}?
            </button>
          )}
          <div className="sec">Who just finished?</div>
          <div className="chips">
            {TEAM.runners.filter(r => state.runnerStatus[r.id] === 'active')
              .map(r => ({ r, L: currentLegOf(state, proj.maxLogged, r.id) }))
              .sort((a, b) => (a.L ?? 99) - (b.L ?? 99))
              .map(({ r, L }) => <button key={r.id} className={'chip name' + (L != null && L === leg ? ' sel' : '')} disabled={L == null} onClick={() => L != null && setLeg(L)}>{r.short}{L != null ? ` · ${L}` : ''}</button>)}
          </div>
        </>
      )}

      {pre ? (
        <div className="chips" ref={chipsRef}>
          <button data-leg={0} className={'chip' + (leg === 0 ? ' sel' : '')} onClick={() => setLeg(0)}>Start</button>
        </div>
      ) : (
        <>
          <div className="sec">{stale ? 'Or pick the leg that just ended' : 'Leg'}</div>
          <div className="chips" ref={chipsRef}>
            {LEGS.map(l => {
              const done = state.actual[l.n] !== null
              return <button key={l.n} data-leg={l.n} className={'chip' + (leg === l.n ? ' sel' : '') + (done ? ' done' : '')} disabled={done} onClick={() => setLeg(l.n)}>{done ? '✓' : ''}{l.n}</button>
            })}
          </div>
        </>
      )}

      {skip && skip.skipped.length > 0 && (
        <div className="warn">
          Legs {skip.skipped[0]}–{skip.skipped[skip.skipped.length - 1]} will get estimated times · {skip.skipped.length + 1} legs in {fmtDuration(skip.elapsedSec * 1000)} — {skip.amber ? (skip.scale < 0.7 ? 'much faster than expected — double-check the leg' : 'much slower than expected — double-check the leg') : 'about on pace'}
        </div>
      )}
      {mismatch && leg != null && <div className="warn">Leg {leg} was expected ~{fmtTimeRel(proj.legs[leg - 1].end, frozenAt)} — did you mean Leg {suggestedLeg(proj, state, at) ?? leg}?</div>}
      {startFarOff && <div className="warn">Planned start is {fmtTimeRel(state.plannedStart, frozenAt)} ({fmtDuration(startGapMs)} {at < state.plannedStart ? 'away' : 'ago'}). Confirming tells every phone the race has begun.</div>}

      <div className="sec">Time {isStart && <span className="muted">· planned {fmtClock(state.plannedStart)}</span>}</div>
      <div className="timebox">
        <input type="time" value={hhmm} step={60} onChange={e => setTime(e.target.value)} />
        <button className="chip sm" onClick={() => { const t = store.now(); setAt(t); setHhmm(toHHMM(t)) }}>now</button>
      </div>
      <div className="chips">
        {[-1, -5, -10, -15].map(m => <button key={m} className="chip sm" onClick={() => nudge(m)}>{m} min</button>)}
        <button className="chip sm" onClick={() => nudge(1)}>+1 min</button>
      </div>
      <div className="muted small">{fmtTimeRel(at, frozenAt)}{at !== frozenAt ? ` (now is ${fmtClock(frozenAt)})` : ''}</div>

      {!isStart && !isFinish && leg != null && (
        <label className="switch">
          <span>Same runner continues on Leg {leg + 1}{nextSame && finisher ? <span className="muted small"> · {runnerShort(finisher)}'s Leg {leg + 1} → replaces {runnerShort(nextRunner)}</span> : null}</span>
          <input type="checkbox" checked={sameRunner} onChange={e => setSameRunner(e.target.checked)} />
        </label>
      )}

      {offlineMember && <div className="muted small" style={{ margin: '6px 0' }}>No bars — if the captain's phone is in the van, log it there.</div>}
      {recent && <div className="warn">Last handoff logged {recentSec} s ago</div>}
      {err && <div className="warn">{err.message}</div>}

      <button className="confirm" disabled={leg == null || !!err} onClick={confirm}>
        {leg == null ? 'Pick a leg first' : isStart ? `CONFIRM START · ${fmtClock(at)}` : isFinish ? `CONFIRM FINISH · ${fmtClock(at)}` : `CONFIRM Leg ${leg} → ${leg + 1} · ${fmtClock(at)}`}
      </button>
      <button className="cancel" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}
