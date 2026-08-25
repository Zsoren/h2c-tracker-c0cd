import { useEffect, useState, useSyncExternalStore } from 'react'
import { store, type Snapshot } from './store'

export function useRace(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/** Current time (with test offset), refreshed every `ms`. */
export function useNow(ms = 15000): number {
  const [now, setNow] = useState(() => store.now())
  useEffect(() => {
    const tick = () => setNow(store.now())
    tick()
    const t = setInterval(tick, ms)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    const unsub = store.subscribe(tick)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); unsub() }
  }, [ms])
  return now
}

export function useStandalone(): boolean {
  const [v, setV] = useState(() => isStandalone())
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const on = () => setV(isStandalone())
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return v
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
