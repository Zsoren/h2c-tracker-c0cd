import { store } from '../state/store'
import { startSupabase } from './supabase'
import { startBroadcast } from './broadcast'

/** Start the sync layer if configured. Never blocks or throws into the UI. */
export function startSync() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  const team = import.meta.env.VITE_TEAM_ID as string | undefined
  try {
    if (url && key && team && team.length >= 20) {
      store.setSync({ mode: 'on' })
      startSupabase({ url, key, team })
    } else if (import.meta.env.VITE_SYNC_FAKE) {
      store.setSync({ mode: 'on' })
      startBroadcast()
    }
  } catch (e) {
    store.setSync({ error: String(e) })
  }
}
