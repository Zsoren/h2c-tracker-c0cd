import { useEffect, useState } from 'react'
import { useRace, isIOS, useStandalone } from './state/hooks'
import { useRoute, go } from './state/router'
import { store, TEAM } from './state/store'
import { decodeShare } from './state/share'
import { Now } from './screens/Now'
import { Schedule } from './screens/Schedule'
import { LegDetail } from './screens/LegDetail'
import { Runners } from './screens/Runners'
import { Info } from './screens/Info'
import { Sheet } from './components/Sheet'
import { fmtPace } from './model/time'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void> }

export default function App() {
  const snap = useRace()
  const route = useRoute()
  const standalone = useStandalone()
  const [imported, setImported] = useState<number | null>(null)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [readyChip, setReadyChip] = useState(false)
  const { settings, flags, storageOk } = snap

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
      {route.tab === 'now' && <Now snap={snap} />}
      {route.tab === 'schedule' && <Schedule snap={snap} />}
      {route.tab === 'leg' && <LegDetail snap={snap} n={route.n} />}
      {route.tab === 'runners' && <Runners snap={snap} />}
      {route.tab === 'info' && <Info snap={snap} section={route.section} />}
      <nav className="tabbar">
        <Tab id="now" label="Now" ico="⏱" active={route.tab === 'now'} />
        <Tab id="schedule" label="Schedule" ico="≡" active={route.tab === 'schedule' || route.tab === 'leg'} />
        <Tab id="runners" label="Runners" ico="👟" active={route.tab === 'runners'} />
        <Tab id="info" label="Info" ico="ⓘ" active={route.tab === 'info'} />
      </nav>
      {showIAm && (
        <Sheet open onClose={() => store.setSettings({ iAmPrompted: true })}>
          <h2 style={{ fontSize: 26 }}>Which runner are you?</h2>
          <div className="names">Gives you a personal "You" line on NOW. You can change it under Info.</div>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {TEAM.runners.map(r => <button key={r.id} className="chip name" onClick={() => store.setSettings({ iAmRunnerId: r.id, iAmPrompted: true })}>{r.short} <span className="muted small">&nbsp;{fmtPace(snap.state.paces[r.id])}</span></button>)}
          </div>
          <button className="cancel" onClick={() => store.setSettings({ iAmPrompted: true })}>Skip</button>
        </Sheet>
      )}
    </div>
  )
}

function Tab({ id, label, ico, active }: { id: string; label: string; ico: string; active: boolean }) {
  return <button className={active ? 'active' : ''} onClick={() => go(id)}><span className="ico">{ico}</span>{label}</button>
}
