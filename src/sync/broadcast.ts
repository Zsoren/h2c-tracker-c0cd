import { store } from '../state/store'
import type { H2CEvent } from '../model/types'

/** Dev-only transport: BroadcastChannel between tabs of the same browser. */
export function startBroadcast() {
  const ch = new BroadcastChannel('h2c-sync')
  ch.onmessage = (m: MessageEvent<{ events: H2CEvent[] } | { hello: true }>) => {
    if ('hello' in m.data) { ch.postMessage({ events: store.getSnapshot().events }); return }
    store.merge(m.data.events, true)
    store.setSync({ lastSynced: Date.now(), pending: 0, syncing: false })
  }
  store.onLocalEvents(events => {
    ch.postMessage({ events })
    store.setSync({ lastSynced: Date.now(), pending: 0 })
  })
  ch.postMessage({ hello: true })
  store.setSync({ lastSynced: Date.now(), pending: 0 })
}
