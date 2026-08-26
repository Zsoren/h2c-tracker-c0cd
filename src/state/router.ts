import { useEffect, useState } from 'react'

export type Route =
  | { tab: 'default' }
  | { tab: 'home' }
  | { tab: 'now' }
  | { tab: 'schedule' }
  | { tab: 'info'; section?: string }
  | { tab: 'leg'; n: number }
  | { tab: 'runner'; id: string }

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const m = /^leg\/(\d+)/.exec(h)
  if (m) return { tab: 'leg', n: +m[1] }
  const r = /^runner\/([^/]+)/.exec(h)
  if (r) return { tab: 'runner', id: decodeURIComponent(r[1]) }
  if (h.startsWith('home')) return { tab: 'home' }
  if (h.startsWith('now')) return { tab: 'now' }
  if (h.startsWith('schedule')) return { tab: 'schedule' }
  if (h.startsWith('runners')) return { tab: 'home' }
  if (h.startsWith('info')) return { tab: 'info', section: h.split('/')[1] }
  return { tab: 'default' }
}

export function go(path: string) {
  location.hash = '#/' + path.replace(/^\/+/, '')
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
