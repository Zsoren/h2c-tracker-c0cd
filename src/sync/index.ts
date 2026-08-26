import { store } from '../state/store'
import { startFirestore } from './firestore'
import { startBroadcast } from './broadcast'
import { parseFirebaseConfig } from './config'

/** Start the sync layer if configured. Never blocks or throws into the UI. */
export function startSync() {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined
  const team = import.meta.env.VITE_TEAM_ID as string | undefined
  try {
    if (raw && team && team.length >= 20) {
      const config = parseFirebaseConfig(raw)
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
