import teamJson from '../data/team.json'
import legsJson from '../data/legs.json'
import type { H2CEvent, Leg, RaceState, RunnerId, TeamData } from '../model/types'
import { makeEvent, newId, reduce } from '../model/events'
import { project, type Projection } from '../model/projection'
import { loadJSON, saveJSON, storageOk } from './storage'

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
  private flags: Flags = { offlineReady: false, noSW: false }
  private listeners = new Set<Listener>()
  private localListeners = new Set<(events: H2CEvent[]) => void>()
  snapshot!: Snapshot

  constructor() {
    this.events = loadJSON<H2CEvent[]>(EVENTS_KEY, [])
    const def: Settings = { deviceId: newId(), iAmRunnerId: null, isCaptain: false, iAmPrompted: false, bannerDismissed: false, timeOffsetMs: 0, dismissedAlts: [] }
    this.settings = { ...def, ...loadJSON<Partial<Settings>>(SETTINGS_KEY, {}) }
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
  merge(incoming: H2CEvent[]): number {
    const have = new Set(this.events.map(e => e.id))
    const fresh = incoming.filter(e => e && typeof e.id === 'string' && !have.has(e.id) && e.v === 1)
    if (!fresh.length) return 0
    this.events = [...this.events, ...fresh]
    saveJSON(EVENTS_KEY, this.events)
    this.recompute(); this.emit()
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
