import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { LEGS, runnerShort, store, type Snapshot } from '../state/store'
import { fmtClock, fmtHMS, fmtPace, parseHMS } from '../model/time'
import { fromHHMM, toHHMM } from '../model/helpers'
import { legDurationSec } from '../model/projection'

export function ExpectSheet({ open, snap, leg, onClose }: { open: boolean; snap: Snapshot; leg: number; onClose: () => void }) {
  const { state, proj } = snap
  const lp = proj.legs[leg - 1]
  const L = LEGS[leg - 1]
  const isCurrent = proj.phase === 'racing' && proj.currentLeg === leg
  const [dur, setDur] = useState<number>(lp.durationSec)
  const [durText, setDurText] = useState<string>(fmtHMS(lp.durationSec))
  useEffect(() => { if (open) { setDur(lp.durationSec); setDurText(fmtHMS(lp.durationSec)) } }, [open, lp.durationSec])
  if (!open) return null

  const eta = lp.start + dur * 1000
  const paceSec = dur / L.miles
  const defaultDur = legDurationSec(L, state.paces[lp.runnerId] ?? 600, state.hillAdjust)
  const deltaSec = dur - lp.durationSec
  const newFinish = proj.finish + deltaSec * 1000
  const leaveBy = typeof lp.leaveBy === 'number' ? lp.leaveBy + deltaSec * 1000 : null
  const etaTooEarly = isCurrent && eta < store.now() - 60000

  function setDuration(sec: number) { const s = Math.max(60, Math.round(sec)); setDur(s); setDurText(fmtHMS(s)) }
  function onEta(hh: string) { const t = fromHHMM(hh, lp.start + dur * 1000); if (t != null) setDuration((t - lp.start) / 1000) }
  function onDurText(t: string) { setDurText(t); try { setDuration(parseHMS(t)) } catch { /* keep typing */ } }
  function save() { store.dispatch('leg_expect_set', { leg, durationSec: dur === defaultDur ? null : dur }); onClose() }
  function reset() { store.dispatch('leg_expect_set', { leg, durationSec: null }); onClose() }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 style={{ fontSize: 26 }}>Expected time · Leg {leg}</h2>
      <div className="names">{runnerShort(lp.runnerId)} · {L.miles} mi{lp.expectEdited ? ' · currently hand-set' : ''}</div>

      <div className="sec">{isCurrent ? 'ETA at Exch ' + leg : `ETA at Exch ${leg} (if start stays ${fmtClock(lp.start)})`}</div>
      <div className="timebox"><input type="time" value={toHHMM(eta)} step={60} onChange={e => onEta(e.target.value)} /></div>
      <div className="chips">
        {[5, 10, 15, -5].map(m => <button key={m} className="chip sm" onClick={() => setDuration(dur + m * 60)}>{m > 0 ? '+' : ''}{m} min</button>)}
      </div>

      <div className="sec">Duration (h:mm:ss) · pace {fmtPace(paceSec)}/mi</div>
      <div className="timebox"><input type="text" inputMode="numeric" value={durText} onChange={e => onDurText(e.target.value)} /></div>

      {etaTooEarly && <div className="warn">That ETA is already in the past.</div>}
      <div className="effect">
        Exch {leg} {fmtClock(lp.end)} → <b>{fmtClock(eta)}</b>
        {leaveBy != null && <> · LEAVE BY {fmtClock(lp.leaveBy as number)} → <b>{fmtClock(leaveBy)}</b></>}
        <br />finish {fmtClock(proj.finish)} → <b>{fmtClock(newFinish)}</b>
      </div>

      <button className="confirm" disabled={etaTooEarly} onClick={save}>SAVE</button>
      {lp.expectEdited && <button className="cancel" onClick={reset}>Reset to runner's pace ({fmtHMS(defaultDur)})</button>}
      <button className="cancel" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}
