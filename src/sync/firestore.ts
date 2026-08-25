import { store } from '../state/store'
import { loadJSON, saveJSON } from '../state/storage'
import type { H2CEvent } from '../model/types'

type FS = typeof import('firebase/firestore')
interface Cfg { config: Record<string, string>; team: string }

const SYNCED_KEY = 'h2c:synced:v1'
const CURSOR_KEY = 'h2c:cursor:v1'
const WIRE_KEYS = ['id', 'v', 'ts', 'seenTs', 'deviceId', 'role', 'type', 'payload'] as const

function toWire(e: H2CEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of WIRE_KEYS) out[k] = e[k]
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(e.payload)) if (v !== undefined) payload[k] = v
  out.payload = payload
  return out
}
function toEvent(d: Record<string, unknown>): H2CEvent {
  return { id: String(d.id), v: 1, ts: Number(d.ts), seenTs: Number(d.seenTs ?? 0), deviceId: String(d.deviceId), role: d.role === 'captain' ? 'captain' : 'member', type: String(d.type), payload: (d.payload as Record<string, unknown>) ?? {} }
}

/**
 * Firestore transport. The phone's localStorage log is the only local store; Firestore is a pure outbox/inbox
 * (memory cache only). Rules are append-only; duplicates are harmless; a lost reply is recovered by the snapshot.
 */
export function startFirestore({ config, team }: Cfg) {
  const synced = new Set<string>(loadJSON<string[]>(SYNCED_KEY, []))
  let cursorMs = loadJSON<number>(CURSOR_KEY, 0)
  let fb: FS | null = null
  let db: import('firebase/firestore').Firestore | null = null
  let flushing = false, retryMs = 5000, flushTimer: ReturnType<typeof setTimeout> | null = null, unsub: (() => void) | null = null
  const debug: string[] = []
  const log = (m: string) => { debug.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (debug.length > 60) debug.shift(); (window as unknown as { __h2cSyncLog?: string[] }).__h2cSyncLog = debug }
  const pendingCount = () => store.getSnapshot().events.filter(e => !synced.has(e.id)).length
  const saveSynced = () => saveJSON(SYNCED_KEY, [...synced])
  const status = (patch: Partial<Parameters<typeof store.setSync>[0]> = {}) => store.setSync({ pending: pendingCount(), online: navigator.onLine, ...patch })

  async function init() {
    const { initializeApp } = await import('firebase/app')
    fb = await import('firebase/firestore')
    const app = initializeApp(config)
    db = fb.initializeFirestore(app, { localCache: fb.memoryLocalCache() })
    log('firestore ready')
  }
  const col = () => fb!.collection(db!, 'teams', team, 'events')

  async function flush() {
    if (flushing || !fb || !db) return
    const outbox = store.getSnapshot().events.filter(e => !synced.has(e.id))
    if (!outbox.length || !navigator.onLine) { status({ syncing: false }); return }
    flushing = true
    status({ syncing: true })
    try {
      const timeout = new Promise<'timeout'>(res => setTimeout(() => res('timeout'), 20000))
      const writes = Promise.allSettled(outbox.map(e => fb!.setDoc(fb!.doc(col(), e.id), { ...toWire(e), serverTs: fb!.serverTimestamp() })))
      const r = await Promise.race([writes, timeout])
      if (r === 'timeout') { log('flush timed out (will confirm via snapshot)'); return }
      let ok = 0, denied = 0, failed = 0
      r.forEach((res, i) => {
        const e = outbox[i]
        if (res.status === 'fulfilled') { synced.add(e.id); ok++ }
        else {
          const code = (res.reason as { code?: string })?.code ?? ''
          if (code === 'permission-denied') { synced.add(e.id); denied++ }   // exists already (append-only) or rules block it; never retry forever
          else failed++
        }
      })
      saveSynced()
      log(`sent ${ok}, denied ${denied}, failed ${failed}`)
      if (denied) status({ error: 'some entries were refused by the database rules' })
      if (ok && !failed) { retryMs = 5000; status({ lastSynced: Date.now(), error: denied ? 'some entries were refused by the database rules' : null }) }
      if (failed) throw new Error(`${failed} write(s) failed`)
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

  function subscribe() {
    if (!fb || !db) return
    if (unsub) { unsub(); unsub = null }
    const since = fb.Timestamp.fromMillis(Math.max(0, cursorMs - 3600000))
    const q = fb.query(col(), fb.where('serverTs', '>', since), fb.orderBy('serverTs'))
    unsub = fb.onSnapshot(q, { includeMetadataChanges: true }, snap => {
      const fromServer = !snap.metadata.fromCache
      const evs: H2CEvent[] = []
      snap.docs.forEach(d => {
        const data = d.data() as Record<string, unknown> & { serverTs?: { toMillis(): number } | null }
        evs.push(toEvent(data))
        if (!d.metadata.hasPendingWrites && data.serverTs) {
          synced.add(String(data.id))
          const ms = data.serverTs.toMillis()
          if (ms > cursorMs) cursorMs = ms
        }
      })
      const fresh = store.merge(evs, true)
      saveSynced(); saveJSON(CURSOR_KEY, cursorMs)
      if (fresh) log(`snapshot +${fresh}${fromServer ? '' : ' (cache)'}`)
      if (fromServer) status({ lastSynced: Date.now(), error: null })
      else status()
    }, err => {
      log('listen error ' + err.code + ' ' + err.message)
      status({ error: err.code === 'permission-denied' ? 'database rules refuse reads — check the rules were published' : err.message })
    })
  }

  // wiring
  store.onLocalEvents(() => { status(); if (flushTimer) clearTimeout(flushTimer); flushTimer = setTimeout(() => { flushTimer = null; void flush() }, 300) })
  window.addEventListener('online', () => { status(); void flush(); subscribe() })
  window.addEventListener('offline', () => status())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { void flush(); subscribe() } })
  setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) void flush() }, 120000)
  status()
  init().then(() => { subscribe(); void flush() }).catch(e => { log('init failed ' + String(e)); status({ error: 'sync setup failed: ' + String((e as Error).message ?? e) }) })
}
