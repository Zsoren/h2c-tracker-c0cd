import teamJson from '../data/team.json'
import legsJson from '../data/legs.json'
import type { H2CEvent, Leg, RaceState, RunnerId, TeamData } from '../model/types'
import { makeEvent, newId, reduce } from '../model/events'
import { project, type Projection } from '../model/projection'
import { loadJSON, removeKey, saveJSON, storageOk } from './storage'

export const TEAM = teamJson as TeamData
export const LEGS = legsJson as Leg[]

export interface Settings {
  deviceId: string
  iAmRunnerId: RunnerId | null
  isCaptain: boolean
  iAmPrompted: boolean
  bannerDismissed: boolean
  timeOffsetMs: number
  /** ids of conflict-loser events the user chose to keep dismissed */
  dismissedAlts: string[]
  /** team id this phone's log belongs to; a new build with a different id wipes the local log (clean slate) */
  teamId: string
}

export type SyncMode = 'off' | 'on'
export interface SyncStatus {
  mode: SyncMode
  online: boolean
  pending: number
  syncing: boolean
  lastSynced: number | null
  error: string | null
}

export interface Flags {
  offlineReady: boolean
  noSW: boolean
  /** transient notice from sync (e.g. "Leg 14 logged from another phone") */
  notice: { text: string; until: number } | null
}

export interface Snapshot {
  events: H2CEvent[]
  state: RaceState
  proj: Projection
  settings: Settings
  sync: SyncStatus
  flags: Flags
  storageOk: boolean
}

const EVENTS_KEY = 'h2c:events:v1'
const SETTINGS_KEY = 'h2c:settings:v1'

type Listener = () => void

class RaceStore {
  private events: H2CEvent[]
  private settings: Settings
  private sync: SyncStatus = { mode: 'off', online: typeof navigator !== 'undefined' ? navigator.onLine : true, pending: 0, syncing: false, lastSynced: null, error: null }
  private flags: Flags = { offlineReady: false, noSW: false, notice: null }
  private listeners = new Set<Listener>()
  private localListeners = new Set<(events: H2CEvent[]) => void>()
  snapshot!: Snapshot

  constructor() {
    this.events = loadJSON<H2CEvent[]>(EVENTS_KEY, [])
    const def: Settings = { deviceId: newId(), iAmRunnerId: null, isCaptain: false, iAmPrompted: false, bannerDismissed: false, timeOffsetMs: 0, dismissedAlts: [], teamId: '' }
    this.settings = { ...def, ...loadJSON<Partial<Settings>>(SETTINGS_KEY, {}) }
    // Clean slate when the build's team id changes (used once before the race to drop all test entries).
    const builtTeam = (import.meta.env.VITE_TEAM_ID as string | undefined) ?? ''
    if (this.settings.teamId !== builtTeam) {
      this.events = []
      removeKey(EVENTS_KEY); removeKey('h2c:synced:v1'); removeKey('h2c:cursor:v1')
      this.settings = { ...this.settings, teamId: builtTeam, dismissedAlts: [], timeOffsetMs: 0 }
    }
    saveJSON(SETTINGS_KEY, this.settings)
    this.recompute()
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setSync({ online: true }))
      window.addEventListener('offline', () => this.setSync({ online: false }))
    }
  }

  private recompute() {
    const state = reduce(TEAM, this.events)
    const proj = project(TEAM, LEGS, state)
    this.snapshot = { events: this.events, state, proj, settings: this.settings, sync: this.sync, flags: this.flags, storageOk }
  }

  setFlags(patch: Partial<Flags>) {
    this.flags = { ...this.flags, ...patch }
    this.recompute(); this.emit()
  }

  private emit() { for (const l of this.listeners) l() }

  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l) } }
  getSnapshot = () => this.snapshot

  /** Wall clock plus the optional test offset. */
  now(): number { return Date.now() + this.settings.timeOffsetMs }

  dispatch(type: string, payload: Record<string, unknown>): H2CEvent {
    const e = makeEvent(type, payload, { deviceId: this.settings.deviceId, role: this.settings.isCaptain ? 'captain' : 'member', log: this.events, now: this.now() })
    this.events = [...this.events, e]
    saveJSON(EVENTS_KEY, this.events)
    this.recompute(); this.emit()
    for (const l of this.localListeners) l([e])
    return e
  }

  undo(targetEventId: string): H2CEvent { return this.dispatch('undo', { targetEventId }) }

  /** Merge events from another source (sync, pasted link). Returns how many were new. */
  merge(incoming: H2CEvent[], announce = false): number {
    const have = new Set(this.events.map(e => e.id))
    const fresh = incoming.filter(e => e && typeof e.id === 'string' && !have.has(e.id) && e.v === 1)
    if (!fresh.length) return 0
    const before = this.snapshot.proj.currentLeg
    this.events = [...this.events, ...fresh]
    saveJSON(EVENTS_KEY, this.events)
    this.recompute()
    if (announce) {
      const remote = fresh.filter(e => e.deviceId !== this.settings.deviceId)
      const cur = this.snapshot.proj.currentLeg
      const hit = remote.find(e => e.type === 'handoff_logged' && ((e.payload.leg as number) === before || (e.payload.leg as number) === before - 1 || cur !== before))
        ?? remote.find(e => ['assignment_set', 'leg_expect_set'].includes(e.type) && (e.payload.leg as number) === cur)
      if (hit) {
        const leg = hit.payload.leg as number
        const text = hit.type === 'handoff_logged' ? `Leg ${leg} logged from ${hit.role === 'captain' ? "captain's" : 'another'} phone` : hit.type === 'assignment_set' ? `Leg ${leg} runner changed on another phone` : `Leg ${leg} expected time changed on another phone`
        this.flags = { ...this.flags, notice: { text, until: Date.now() + 8000 } }
        this.recompute()
      }
    }
    this.emit()
    return fresh.length
  }

  /** Replace the whole log (used by "Reload from team data"). */
  replaceAll(events: H2CEvent[]) {
    this.events = [...events]
    saveJSON(EVENTS_KEY, this.events)
    this.recompute(); this.emit()
  }

  setSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch }
    saveJSON(SETTINGS_KEY, this.settings)
    this.recompute(); this.emit()
  }

  setSync(patch: Partial<SyncStatus>) {
    this.sync = { ...this.sync, ...patch }
    this.recompute(); this.emit()
  }

  onLocalEvents(l: (events: H2CEvent[]) => void) { this.localListeners.add(l); return () => { this.localListeners.delete(l) } }
}

export const store = new RaceStore()

export function runnerById(id: RunnerId | null | undefined) {
  return TEAM.runners.find(r => r.id === id) ?? null
}
export function runnerShort(id: RunnerId | null | undefined): string {
  return runnerById(id)?.short ?? '—'
}
export function legByN(n: number): Leg | undefined { return LEGS[n - 1] }
