import type { Snapshot } from '../state/store'
import { fmtClock } from '../model/time'

export function statusText(snap: Snapshot): { text: string; dot: 'on' | 'off' | 'none' } {
  const s = snap.sync
  if (s.mode === 'off') return { text: 'Sync off · saved on phone', dot: 'none' }
  if (!s.online) return { text: `Offline · saved on phone · ${s.pending} waiting`, dot: 'off' }
  if (s.syncing || s.pending > 0) return { text: `Syncing… · ${s.pending} waiting`, dot: 'off' }
  return { text: s.lastSynced ? `Synced ${fmtClock(s.lastSynced)}` : 'Connecting…', dot: 'on' }
}

export function StatusLine({ snap }: { snap: Snapshot }) {
  const { text, dot } = statusText(snap)
  const caps = snap.state.captainDevices.length
  return (
    <div className="status">
      {dot !== 'none' && <span className={'dot ' + dot} />}
      <span className="grow ellip">{text}</span>
      {!snap.storageOk && <span className="tag warn">STORAGE OFF</span>}
      {snap.settings.timeOffsetMs !== 0 && <span className="tag warn">TEST CLOCK</span>}
      {caps > 1 && <span className="tag warn">{caps} captain phones</span>}
      {snap.settings.isCaptain && caps <= 1 && <span className="tag dim">CAPTAIN</span>}
    </div>
  )
}
