import { useState } from 'react'
import { TEAM, store, type Snapshot } from '../state/store'
import { encodeShare, decodeShare } from '../state/share'
import { fmtClock, fmtHMS, fmtPace } from '../model/time'
import { fromHHMM, toHHMM } from '../model/helpers'
import { isIOS, isStandalone } from '../state/hooks'
import { runnerShort } from '../state/store'
import type { H2CEvent } from '../model/types'

function describe(e: H2CEvent): string {
  const p = e.payload
  const leg = p.leg as number | undefined
  switch (e.type) {
    case 'handoff_logged': return leg === 0 ? `Race started ${fmtClock(p.at as number)}` : leg === 36 ? `Finish logged ${fmtClock(p.at as number)}` : `Leg ${leg} handoff ${fmtClock(p.at as number)}`
    case 'assignment_set': return `Leg ${leg} → ${runnerShort(p.runnerId as string)}`
    case 'runner_status_set': return `${runnerShort(p.runnerId as string)} ${p.status === 'dropped' ? 'dropped' : 'reactivated'}`
    case 'pace_set': return `${runnerShort(p.runnerId as string)} pace ${fmtPace(p.paceSec as number)}`
    case 'leg_expect_set': return p.durationSec == null ? `Leg ${leg} expected time reset` : `Leg ${leg} expected ${fmtHMS(p.durationSec as number)}`
    case 'driver_set': return `Leg ${leg} driver ${runnerShort(p.runnerId as string | null)}`
    case 'drive_min_set': return `Leg ${leg} drive time ${p.minutes} min`
    case 'note_set': return `Leg ${leg} note ${p.text ? `"${String(p.text).slice(0, 30)}"` : 'cleared'}`
    case 'planned_start_set': return `Planned start ${fmtClock(p.at as number)}`
    case 'settings_set': return `Hill-adjust ${p.hillAdjust ? 'on' : 'off'}`
    default: return e.type
  }
}

function RecentChanges({ snap }: { snap: Snapshot }) {
  const { events, settings } = snap
  const undone = new Set(events.filter(e => e.type === 'undo').map(e => String(e.payload.targetEventId)))
  const recent = events.filter(e => e.type !== 'undo').sort((a, b) => b.ts - a.ts).slice(0, 12)
  if (!recent.length) return <div className="muted small">Nothing yet.</div>
  return (
    <div className="list" style={{ gap: 4 }}>
      {recent.map(e => (
        <div key={e.id} className="row" style={{ minHeight: 44, opacity: undone.has(e.id) ? 0.5 : 1 }}>
          <span className="grow ellip small">{undone.has(e.id) ? '(undone) ' : ''}{describe(e)} <span className="muted">· {fmtClock(e.ts)} · {e.deviceId === settings.deviceId ? 'this phone' : e.role === 'captain' ? "captain's phone" : 'another phone'}</span></span>
          {!undone.has(e.id) && <button className="btn" onClick={() => { if (confirm(`Undo "${describe(e)}"?`)) store.undo(e.id) }}>Undo</button>}
        </div>
      ))}
    </div>
  )
}

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
          {TEAM.runners.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      {(settings.iAmRunnerId === 'Z' || settings.isCaptain) && (
        <label className="switch" style={{ marginTop: 8 }}>
          <span>Captain's phone <span className="muted small">— wins conflicts; only one phone should be captain</span></span>
          <input type="checkbox" checked={settings.isCaptain} onChange={e => {
            if (e.target.checked && !confirm('Only one phone should be captain. Turn on?')) return
            store.setSettings({ isCaptain: e.target.checked })
          }} />
        </label>
      )}

      <h2 className="sub">Recent changes</h2>
      <div className="muted small">Newest first, from every phone. Undo reverses one change (the undo itself syncs too).</div>
      <RecentChanges snap={snap} />

      <h2 className="sub">Offline setup</h2>
      <div className="kv">
        <span className="k">Browser</span><span>Open in Safari or Chrome (not inside Instagram/Gmail). Wait for "Ready offline" once.</span>
        <span className="k">iPhone</span><span>Share → Add to Home Screen, then open it once from the icon with signal.</span>
        <span className="k">Maps</span><span>Google Maps → Offline maps → download Mt Hood → Portland → Seaside.</span>
        <span className="k">No bars</span><span>Log handoffs on the captain's phone only; everyone else just looks.</span>
      </div>
      <div className="muted small">{isStandalone() ? 'Running from the home-screen icon.' : isIOS() ? 'Running in the browser tab (iPhone).' : 'Running in the browser tab.'}</div>

      <h2 className="sub">Share / backup</h2>
      <div className="btnrow">
        <button className="btn primary" onClick={copyLink}>Copy current plan as link</button>
        <button className="btn" onClick={exportJson}>Export log (JSON)</button>
      </div>
      <div className="row"><input className="plain" type="text" placeholder="Paste a plan link here" value={paste} onChange={e => setPaste(e.target.value)} /><button className="btn" onClick={pasteLink}>Load</button></div>

      {settings.isCaptain ? (
        <>
          <h2 className="sub">Race settings (captain)</h2>
          <div className="row">
            <span className="k muted">Planned start</span>
            <input type="time" step={60} value={toHHMM(state.plannedStart)} onChange={e => { const t = fromHHMM(e.target.value, state.plannedStart); if (t != null && confirm(`Set the planned start to ${fmtClock(t)} on every phone?`)) store.dispatch('planned_start_set', { at: t }) }} style={{ minHeight: 44, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '0 10px', color: 'var(--fg)' }} />
            <span className="muted small">Fri Aug 28 · {fmtClock(state.plannedStart)}</span>
          </div>
          <label className="switch">
            <span>Hill-adjusted estimates <span className="muted small">— climbs slower, descents faster (labeled "Hill-adj.")</span></span>
            <input type="checkbox" checked={state.hillAdjust} onChange={e => { if (confirm(`Turn hill-adjusted estimates ${e.target.checked ? 'on' : 'off'} for every phone?`)) store.dispatch('settings_set', { hillAdjust: e.target.checked }) }} />
          </label>
        </>
      ) : (
        <div className="muted small" style={{ marginTop: 12 }}>Planned start {fmtClock(state.plannedStart)} · estimates {state.hillAdjust ? 'hill-adjusted' : 'flat'} — the captain's phone can change these.</div>
      )}

      <h2 className="sub">Race essentials</h2>
      <div className="kv">
        <span className="k">Night 6 PM–7 AM</span><span>Vest + headlamp + 2 flashers. Vest until 9 AM.</span>
        <span className="k">Start</span><span>Timberline check-in 1 hr before · gear check · Leg 1: no van support, drive to Exch 1.</span>
        <span className="k">Van</span><span>One van on course · never trail your runner at night · sign in the window.</span>
        <span className="k">Quiet zones</span><span>Engine & lights off · no music, horns or cheering.</span>
        <span className="k">Majors 6·12·18·24·30</span><span>Bathrooms, food, long walk to the chute — leave 15 min early.</span>
        <span className="k">Legs 19–32</span><span>No cell service · 20–21 gravel (bandana) · 28: no stopping at the Elk Preserve.</span>
        <span className="k">Seaside 31–36</span><span>Traffic — drop the next runner early · Leg 36 runner wears the chip bib · van → shuttle parking · run in together.</span>
        <span className="k">Course closes</span><span>9 PM Sat. If a marshal says leapfrog, do it.</span>
        <span className="k">Emergency</span><span>911 first, then the Exchange Leader or Radio Operator at the nearest exchange (they reach the Race Command Center). Race office: <a href="tel:+15032924626">(503) 292-4626</a>.</span>
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
          <span className="k">sync log</span><span className="pre tiny">{(((window as unknown as { __h2cSyncLog?: string[] }).__h2cSyncLog) ?? ['(none)']).slice(-8).join('\n')}</span>
        </div>
      )}
    </div>
  )
}
