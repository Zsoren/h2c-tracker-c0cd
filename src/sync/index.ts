import { store } from '../state/store'
import { startFirestore } from './firestore'
import { startBroadcast } from './broadcast'

/** Start the sync layer if configured. Never blocks or throws into the UI. */
export function startSync() {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined
  const team = import.meta.env.VITE_TEAM_ID as string | undefined
  try {
    if (raw && team && team.length >= 20) {
      const config = parseConfig(raw)
      if (config) {
        store.setSync({ mode: 'on' })
        startFirestore({ config, team })
        return
      }
      store.setSync({ error: 'Firebase config could not be read' })
    } else if (import.meta.env.VITE_SYNC_FAKE) {
      store.setSync({ mode: 'on' })
      startBroadcast()
    }
  } catch (e) {
    store.setSync({ error: String(e) })
  }
}

/** Accepts the JSON object from the Firebase console, or the `const firebaseConfig = {...};` snippet pasted whole. */
function parseConfig(raw: string): Record<string, string> | null {
  const m = /\{[\s\S]*\}/.exec(raw)
  if (!m) return null
  let s = m[0]
  try { return JSON.parse(s) } catch { /* try relaxed */ }
  s = s.replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"').replace(/,\s*}/g, '}')
  try { return JSON.parse(s) } catch { return null }
}
