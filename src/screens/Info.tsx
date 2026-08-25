import { useState } from 'react'
import { TEAM, store, type Snapshot } from '../state/store'
import { encodeShare, decodeShare } from '../state/share'
import { fmtClock, fmtPace } from '../model/time'
import { fromHHMM, toHHMM } from '../model/helpers'
import { isIOS, isStandalone } from '../state/hooks'

export function Info({ snap, section }: { snap: Snapshot; section?: string }) {
  const { settings, state, events, sync } = snap
  const [msg, setMsg] = useState<string | null>(null)
  const [paste, setPaste] = useState('')
  const [resetText, setResetText] = useState('')
  const [showDebug, setShowDebug] = useState(section === 'debug' || location.search.includes('debug'))

  async function copyLink() {
    const url = await encodeShare(events, location.origin + location.pathname)
    try { await navigator.clipboard.writeText(url); setMsg('Link copied — paste it into the group chat.') }
    catch { setMsg(url) }
  }
  async function pasteLink() {
    try { const evs = await decodeShare(paste); const k = store.merge(evs); setMsg(`Loaded ${k} new change${k === 1 ? '' : 's'}.`); setPaste('') }
    catch { setMsg('That does not look like a plan link.') }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify({ team: TEAM, events }, null, 1)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'h2c-log.json'; a.click()
  }

  return (
    <div className="page">
      <h1 className="title">Info & settings</h1>
      {msg && <div className="banner"><span className="grow" style={{ wordBreak: 'break-all' }}>{msg}</span><button className="plain" onClick={() => setMsg(null)}>OK</button></div>}

      <h2 className="sub">Me</h2>
      <div className="row">
        <span className="k muted">I am</span>
        <select value={settings.iAmRunnerId ?? ''} onChange={e => store.setSettings({ iAmRunnerId: e.target.value || null, iAmPrompted: true })}>
          <option value="">— pick your name —</option>
          {TEAM.runners.map(r => <option key={r.id} value={r.id}>{r.name} ({fmtPace(state.paces[r.id])}/mi)</option>)}
        </select>
      </div>
      <label className="switch" style={{ marginTop: 8 }}>
        <span>Captain's phone <span className="muted small">— wins conflicts; only one phone should be captain</span></span>
        <input type="checkbox" checked={settings.isCaptain} onChange={e => {
          if (e.target.checked && !confirm('Only one phone should be captain. Turn on?')) return
          store.setSettings({ isCaptain: e.target.checked })
        }} />
      </label>

      <h2 className="sub">Offline setup</h2>
      <div className="pre">
        {`1. Open this site in Safari or Chrome — not inside Instagram's or Gmail's built-in browser (those don't keep the offline copy).
2. Wait for the "Ready offline" chip once. After that it opens with no signal.
3. Recommended on iPhone: Share → "Add to Home Screen", then open it once from the icon while you have signal. (The icon copy is separate from the Safari copy — set "I am" again there.)
4. Download the offline Google Maps area for Mt Hood → Portland → Seaside: Google Maps → profile → Offline maps → Select your own map.
5. No bars in the van? Log handoffs on the captain's phone only; everyone else just looks.`}
      </div>
      <div className="muted small">{isStandalone() ? 'Running from the home-screen icon.' : isIOS() ? 'Running in the browser tab (iPhone).' : 'Running in the browser tab.'}</div>

      <h2 className="sub">Share / backup</h2>
      <div className="btnrow">
        <button className="btn primary" onClick={copyLink}>Copy current plan as link</button>
        <button className="btn" onClick={exportJson}>Export log (JSON)</button>
      </div>
      <div className="row"><input className="plain" type="text" placeholder="Paste a plan link here" value={paste} onChange={e => setPaste(e.target.value)} /><button className="btn" onClick={pasteLink}>Load</button></div>

      <h2 className="sub">Race settings</h2>
      <div className="row">
        <span className="k muted">Planned start</span>
        <input type="time" step={60} value={toHHMM(state.plannedStart)} onChange={e => { const t = fromHHMM(e.target.value, state.plannedStart); if (t != null) store.dispatch('planned_start_set', { at: t }) }} style={{ minHeight: 44, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '0 10px', color: 'var(--fg)' }} />
        <span className="muted small">Fri Aug 28 · {fmtClock(state.plannedStart)}</span>
      </div>
      <label className="switch">
        <span>Hill-adjusted estimates <span className="muted small">— climbs slower, descents faster (labeled "Hill-adj.")</span></span>
        <input type="checkbox" checked={state.hillAdjust} onChange={e => store.dispatch('settings_set', { hillAdjust: e.target.checked })} />
      </label>

      <h2 className="sub">Race essentials</h2>
      <div className="pre">
        {`NIGHT GEAR (6 PM–7 AM): headlamp or flashlight, one front + one back LED flasher, reflective vest. Vest required until 9 AM. Violations = DQ.
START (Timberline, 3:35 AM): team check-in opens ~1 hr before your start; gear check at check-in; Leg 1 has NO van support — drive straight to Exch 1.
ONE VAN on the course at all times. Never drive behind your runner at night. Display the van sign.
QUIET ZONES (early morning / night, rural + neighborhoods): engine and headlights off, no music, no cheering, no horns.
MAJOR EXCHANGES 6 · 12 · 18 · 24 · 30: big lots, bathrooms, food, long walk from parking to the chute — leave 15 min earlier. Sleeping only in designated fields at 18/24/30 (a one-van team keeps moving; use them for bathrooms and food).
LEGS 19–32: cell coverage unreliable. Legs 20–21 gravel/dust — bandana. Leg 28 passes the Elk Preserve: no stopping.
LEGS 31–36: traffic into Seaside backs up Saturday morning — extra buffer applied; consider dropping the next runner at the exchange early. Leg 36: vans don't follow the course — go to Seaside shuttle parking; the Leg 36 runner must wear the bib with the timing chip. Team meets and runs in together.
COURSE CLOSES 9 PM Saturday. If a marshal tells you to leapfrog (start the next runner before the current one arrives), do it — it's normal for teams running late.
EMERGENCY: 911 first, then race HQ (number on your team packet / handbook).`}
      </div>

      <h2 className="sub">Roster</h2>
      <div className="kv">{TEAM.runners.map(r => <><span key={r.id + 'k'} className="k">{r.name}</span><span key={r.id + 'v'}>{r.phone ?? <span className="muted">—</span>}</span></>)}</div>

      <h2 className="sub">Danger zone</h2>
      <div className="muted small">Clears every logged handoff and swap {sync.mode === 'on' ? 'on THIS phone (the team log is kept; it will reload from the team data)' : 'on this phone'}. Exports a backup first. Type RESET to enable.</div>
      <div className="row" style={{ marginTop: 6 }}>
        <input className="plain" type="text" placeholder="RESET" value={resetText} onChange={e => setResetText(e.target.value)} />
        <button className="btn" disabled={resetText !== 'RESET'} onClick={() => { exportJson(); store.replaceAll([]); setResetText(''); setMsg(sync.mode === 'on' ? 'Cleared. Reloading from team data…' : 'Cleared.') }}>{sync.mode === 'on' ? 'Reload from team data' : 'Clear all'}</button>
      </div>

      <div style={{ marginTop: 24 }}><button className="back" onClick={() => setShowDebug(!showDebug)}>{showDebug ? 'Hide' : 'Show'} debug</button></div>
      {showDebug && (
        <div className="kv small">
          <span className="k">events</span><span>{events.length}</span>
          <span className="k">sync</span><span>{sync.mode} · {sync.online ? 'online' : 'offline'} · pending {sync.pending}{sync.error ? ` · ${sync.error}` : ''}</span>
          <span className="k">device</span><span style={{ wordBreak: 'break-all' }}>{settings.deviceId}</span>
          <span className="k">team</span><span style={{ wordBreak: 'break-all' }}>{import.meta.env.VITE_TEAM_ID || '(none)'}</span>
          <span className="k">captain</span><span>{String(settings.isCaptain)} · seen: {state.captainDevices.length}</span>
          <span className="k">storage</span><span>{snap.storageOk ? 'ok' : 'MEMORY ONLY'}</span>
          <span className="k">test clock</span><span>
            <button className="btn" onClick={() => store.setSettings({ timeOffsetMs: settings.timeOffsetMs + 3600000 })}>+1 h</button>{' '}
            <button className="btn" onClick={() => store.setSettings({ timeOffsetMs: settings.timeOffsetMs + 15 * 60000 })}>+15 m</button>{' '}
            <button className="btn" onClick={() => store.setSettings({ timeOffsetMs: 0 })}>reset</button>{' '}
            <span className="muted">{Math.round(settings.timeOffsetMs / 60000)} min</span>
          </span>
          <span className="k">build</span><span>{import.meta.env.MODE} · {import.meta.env.BASE_URL}</span>
        </div>
      )}
    </div>
  )
}
