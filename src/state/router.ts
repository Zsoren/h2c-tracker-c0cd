import { useEffect, useState } from 'react'

export type Route =
  | { tab: 'now' }
  | { tab: 'schedule' }
  | { tab: 'runners' }
  | { tab: 'info'; section?: string }
  | { tab: 'leg'; n: number }

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const m = /^leg\/(\d+)/.exec(h)
  if (m) return { tab: 'leg', n: +m[1] }
  if (h.startsWith('schedule')) return { tab: 'schedule' }
  if (h.startsWith('runners')) return { tab: 'runners' }
  if (h.startsWith('info')) return { tab: 'info', section: h.split('/')[1] }
  return { tab: 'now' }
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
