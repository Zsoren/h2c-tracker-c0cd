import { store } from '../state/store'
import { loadJSON, saveJSON } from '../state/storage'
import type { H2CEvent } from '../model/types'

interface Cfg { url: string; key: string; team: string }
interface Row { id: string; team_id: string; v: number; ts: number | string; seen_ts: number | string; device_id: string; role: string; type: string; payload: Record<string, unknown>; inserted_at?: string }

const SYNCED_KEY = 'h2c:synced:v1'
const CURSOR_KEY = 'h2c:cursor:v1'

function toRow(e: H2CEvent, team: string): Omit<Row, 'inserted_at'> {
  return { id: e.id, team_id: team, v: e.v, ts: e.ts, seen_ts: e.seenTs, device_id: e.deviceId, role: e.role, type: e.type, payload: e.payload }
}
function toEvent(r: Row): H2CEvent {
  return { id: r.id, v: 1, ts: Number(r.ts), seenTs: Number(r.seen_ts), deviceId: r.device_id, role: r.role === 'captain' ? 'captain' : 'member', type: r.type, payload: r.payload ?? {} }
}

export function startSupabase(cfg: Cfg) {
  const synced = new Set<string>(loadJSON<string[]>(SYNCED_KEY, []))
  let cursor: string | null = loadJSON<string | null>(CURSOR_KEY, null)
  let client: import('@supabase/supabase-js').SupabaseClient | null = null
  let flushing = false, fetching = false, retryMs = 5000, flushTimer: ReturnType<typeof setTimeout> | null = null
  const debug: string[] = []
  const log = (m: string) => { debug.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (debug.length > 50) debug.shift(); (window as unknown as { __h2cSyncLog?: string[] }).__h2cSyncLog = debug }

  const pendingCount = () => store.getSnapshot().events.filter(e => !synced.has(e.id)).length
  const saveSynced = () => saveJSON(SYNCED_KEY, [...synced])
  const status = (patch: Partial<Parameters<typeof store.setSync>[0]> = {}) => store.setSync({ pending: pendingCount(), online: navigator.onLine, ...patch })

  async function getClient() {
    if (client) return client
    const mod = await import('@supabase/supabase-js')
    client = mod.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 5 } } })
    return client
  }

  async function flush() {
    if (flushing) return
    const outbox = store.getSnapshot().events.filter(e => !synced.has(e.id))
    if (!outbox.length) { status({ syncing: false }); return }
    if (!navigator.onLine) { status({ syncing: false }); return }
    flushing = true
    status({ syncing: true })
    try {
      const sb = await getClient()
      const rows = outbox.map(e => toRow(e, cfg.team))
      const { error } = await sb.from('events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) {
        if (error.code === '23505') { for (const e of outbox) synced.add(e.id); saveSynced(); log('dup → synced') }
        else if (error.code === '42501') { for (const e of outbox) synced.add(e.id); saveSynced(); log('DENIED ' + error.message); status({ error: 'sync denied: ' + error.message }) }
        else throw error
      } else {
        for (const e of outbox) synced.add(e.id)
        saveSynced()
        retryMs = 5000
        log(`sent ${rows.length}`)
        status({ lastSynced: Date.now(), error: null })
      }
    } catch (e) {
      log('flush error ' + String((e as Error).message ?? e))
      status({ error: String((e as Error).message ?? e) })
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = setTimeout(() => { flushTimer = null; void flush() }, retryMs)
      retryMs = Math.min(retryMs * 2, 60000)
    } finally {
      flushing = false
      status({ syncing: false })
    }
  }

  async function fetchSince() {
    if (fetching || !navigator.onLine) return
    fetching = true
    try {
      const sb = await getClient()
      let q = sb.from('events').select('*').eq('team_id', cfg.team).order('inserted_at', { ascending: true }).limit(1000)
      if (cursor) q = q.gt('inserted_at', new Date(Date.parse(cursor) - 3600000).toISOString())
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as Row[]
      const fresh = store.merge(rows.map(toEvent))
      for (const r of rows) synced.add(r.id)
      saveSynced()
      const maxIns = rows.reduce((m, r) => (r.inserted_at && r.inserted_at > m ? r.inserted_at : m), cursor ?? '')
      if (maxIns) { cursor = maxIns; saveJSON(CURSOR_KEY, cursor) }
      log(`fetched ${rows.length} (${fresh} new)`)
      status({ lastSynced: Date.now(), error: null })
    } catch (e) {
      log('fetch error ' + String((e as Error).message ?? e))
      status({ error: String((e as Error).message ?? e) })
    } finally { fetching = false }
  }

  async function subscribe() {
    const sb = await getClient()
    sb.channel('events-' + cfg.team.slice(0, 8))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `team_id=eq.${cfg.team}` }, payload => {
        const r = payload.new as Row
        synced.add(r.id); saveSynced()
        const fresh = store.merge([toEvent(r)])
        if (r.inserted_at && (!cursor || r.inserted_at > cursor)) { cursor = r.inserted_at; saveJSON(CURSOR_KEY, cursor) }
        if (fresh) log('live +1'); status({ lastSynced: Date.now() })
      })
      .subscribe(st => { log('channel ' + st); if (st === 'SUBSCRIBED') void fetchSince() })
  }

  // wiring
  store.onLocalEvents(() => { status(); if (flushTimer) clearTimeout(flushTimer); flushTimer = setTimeout(() => { flushTimer = null; void flush() }, 300) })
  window.addEventListener('online', () => { status(); void flush(); void fetchSince() })
  window.addEventListener('offline', () => status())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { void fetchSince(); void flush() } })
  setInterval(() => { if (document.visibilityState === 'visible') { void fetchSince(); void flush() } }, 120000)
  status()
  void flush()
  void subscribe()
}
