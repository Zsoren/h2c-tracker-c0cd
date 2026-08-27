import { useEffect, useState } from 'react'
import { useRace, isIOS, useStandalone } from './state/hooks'
import { useRoute, go } from './state/router'
import { store, TEAM } from './state/store'
import { decodeShare } from './state/share'
import { Home } from './screens/Home'
import { Now } from './screens/Now'
import { Schedule } from './screens/Schedule'
import { LegDetail } from './screens/LegDetail'
import { RunnerDetail } from './screens/Runners'
import { Info } from './screens/Info'
import { Sheet } from './components/Sheet'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void> }

export default function App() {
  const snap = useRace()
  const routeRaw = useRoute()
  const standalone = useStandalone()
  const [imported, setImported] = useState<number | null>(null)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [readyChip, setReadyChip] = useState(false)
  const { settings, flags, storageOk } = snap
  // Landing page: Home before the race, NOW once it has started.
  const route = routeRaw.tab === 'default' ? ({ tab: snap.proj.phase === 'pre' ? 'home' : 'now' } as const) : routeRaw

  // Every screen change starts at the top (Schedule scrolls itself to the current leg).
  const routeKey = JSON.stringify(route)
  useEffect(() => { if (route.tab !== 'schedule') window.scrollTo({ top: 0, left: 0 }) }, [routeKey, route.tab])

  // Ingest a pasted/shared "#s=" link once, then land on NOW.
  useEffect(() => {
    if (location.hash.startsWith('#s=')) {
      decodeShare(location.hash).then(evs => { const k = store.merge(evs); setImported(k); history.replaceState(null, '', location.pathname + '#/now') }).catch(() => go('now'))
    }
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  // "Ready offline" chip, shown once when the precache completes.
  useEffect(() => {
    if (!flags.offlineReady) return
    const seen = sessionStorage.getItem('h2c:readychip')
    if (seen) return
    sessionStorage.setItem('h2c:readychip', '1')
    setReadyChip(true)
    const t = setTimeout(() => setReadyChip(false), 4000)
    return () => clearTimeout(t)
  }, [flags.offlineReady])

  const showIAm = !settings.iAmPrompted && (flags.offlineReady || flags.noSW) && imported === null
  const showInstall = !standalone && !settings.bannerDismissed && (isIOS() || installEvt)

  return (
    <div className="app">
      {imported != null && <div className="banner" style={{ position: 'fixed', top: 8, left: 8, right: 8, zIndex: 50 }}><span className="grow">Plan link loaded · {imported} new change{imported === 1 ? '' : 's'}</span><button className="plain" onClick={() => setImported(null)}>OK</button></div>}
      {readyChip && <div style={{ position: 'fixed', top: 'calc(8px + env(safe-area-inset-top, 0px))', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}><span className="tag" style={{ fontSize: 14, padding: '6px 12px' }}>✓ Ready offline</span></div>}
      {!storageOk && <div className="banner red" style={{ position: 'fixed', top: 8, left: 8, right: 8, zIndex: 49 }}><span className="grow">This browser refused storage — changes will be lost when you close the tab. Open the site in Safari/Chrome (not private mode).</span></div>}
      {showInstall && route.tab !== 'now' && (
        <div className="banner" style={{ margin: '8px 12px 0' }}>
          <span className="grow small">{isIOS() ? <>Recommended on iPhone: tap Share <b>⬆</b> then <b>Add to Home Screen</b> for a more dependable offline copy and an icon — do it at home, then open it once from the icon.</> : <>Install this site for a dependable offline copy and an icon.</>}</span>
          {installEvt && <button onClick={() => installEvt.prompt()}>Install</button>}
          <button className="plain" onClick={() => store.setSettings({ bannerDismissed: true })}>Not now</button>
        </div>
      )}
      {route.tab === 'home' && <Home snap={snap} />}
      {route.tab === 'now' && <Now snap={snap} />}
      {route.tab === 'schedule' && <Schedule snap={snap} />}
      {route.tab === 'leg' && <LegDetail snap={snap} n={route.n} />}
      {route.tab === 'runner' && <RunnerDetail snap={snap} id={route.id} />}
      {route.tab === 'info' && <Info snap={snap} section={route.section} />}
      <nav className="tabbar">
        <Tab id="home" label="Home" ico="⌂" active={route.tab === 'home' || route.tab === 'runner'} />
        <Tab id="now" label="Now" ico="⏱" active={route.tab === 'now'} />
        <Tab id="schedule" label="Schedule" ico="≡" active={route.tab === 'schedule' || route.tab === 'leg'} />
        <Tab id="info" label="Info" ico="ⓘ" active={route.tab === 'info'} />
      </nav>
      {showIAm && <FirstRun snap={snap} />}
    </div>
  )
}

/** First-run: pick your name, then (unless a pace is already on file) enter your planned flat pace. */
function FirstRun({ snap }: { snap: ReturnType<typeof useRace> }) {
  const [runner, setRunner] = useState<string | null>(null)
  const [paceText, setPaceText] = useState('')
  const done = (id: string | null) => store.setSettings({ iAmRunnerId: id, iAmPrompted: true })
  const m = /^(\d{1,2}):(\d{2})$/.exec(paceText.trim())
  const paceSec = m ? +m[1] * 60 + +m[2] : null
  const valid = paceSec != null && paceSec >= 240 && paceSec <= 1200
  if (runner === null) {
    return (
      <Sheet open onClose={() => done(null)}>
        <h2 style={{ fontSize: 26 }}>Which runner are you?</h2>
        <div className="names">Gives you a personal "You" line on NOW. You can change it under Info.</div>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {TEAM.runners.map(r => <button key={r.id} className="chip name" onClick={() => (snap.state.paceEntered[r.id] ? done(r.id) : setRunner(r.id))}>{r.short}</button>)}
        </div>
        <button className="cancel" onClick={() => done(null)}>Skip</button>
      </Sheet>
    )
  }
  const short = TEAM.runners.find(r => r.id === runner)?.short ?? ''
  return (
    <Sheet open onClose={() => done(runner)}>
      <h2 style={{ fontSize: 26 }}>Hi {short} — what's your planned pace?</h2>
      <div className="names">Average <b>flat</b> pace in minutes:seconds per mile (e.g. 9:30). It's used to project your four legs; you can change it any time on Home.</div>
      <div className="timebox"><input type="text" inputMode="numeric" placeholder="9:30" value={paceText} onChange={e => setPaceText(e.target.value)} autoFocus /></div>
      {paceText && !valid && <div className="muted small">Enter minutes:seconds, e.g. 9:30 (between 4:00 and 20:00).</div>}
      <button className="confirm" disabled={!valid} onClick={() => { store.dispatch('pace_set', { runnerId: runner, paceSec }); done(runner) }}>SAVE {valid ? paceText.trim() + '/mi' : ''}</button>
      <button className="cancel" onClick={() => done(runner)}>Skip for now (the captain's estimate will be used)</button>
    </Sheet>
  )
}

function Tab({ id, label, ico, active }: { id: string; label: string; ico: string; active: boolean }) {
  return <button className={active ? 'active' : ''} onClick={() => go(id)}><span className="ico">{ico}</span>{label}</button>
}
