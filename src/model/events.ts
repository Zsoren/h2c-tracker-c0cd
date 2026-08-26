import type { H2CEvent, RaceState, RunnerId, RunnerStatus, TeamData, Role, Alternate } from './types'

export const N_LEGS = 36

export function keyOf(e: H2CEvent): string | null {
  const p = e.payload
  switch (e.type) {
    case 'handoff_logged': return `handoff:${p.leg}`
    case 'assignment_set': return `assignment:${p.leg}`
    case 'runner_status_set': return `status:${p.runnerId}`
    case 'pace_set': return `pace:${p.runnerId}`
    case 'leg_expect_set': return `expect:${p.leg}`
    case 'driver_set': return `driver:${p.leg}`
    case 'drive_min_set': return `drivemin:${p.leg}`
    case 'note_set': return `note:${p.leg}`
    case 'planned_start_set': return 'plannedStart'
    case 'settings_set': return 'settings'
    default: return null
  }
}

export function initialState(team: TeamData): RaceState {
  const paces: Record<RunnerId, number> = {}
  const paceEntered: Record<RunnerId, boolean> = {}
  const runnerStatus: Record<RunnerId, RunnerStatus> = {}
  for (const r of team.runners) { paces[r.id] = r.paceSec; paceEntered[r.id] = false; runnerStatus[r.id] = 'active' }
  return {
    actual: Array(N_LEGS + 1).fill(null),
    assignments: [...team.assignments],
    runnerStatus,
    paces,
    paceEntered,
    expect: Array(N_LEGS + 1).fill(null),
    drivers: Array(N_LEGS + 1).fill(null),
    driveMin: Array(N_LEGS + 1).fill(null),
    notes: Array(N_LEGS + 1).fill(''),
    plannedStart: Date.parse(team.plannedStart),
    hillAdjust: false,
    alternates: {},
    captainDevices: [],
    lastHandoffTs: null,
  }
}

function cmp(a: H2CEvent, b: H2CEvent): number {
  return (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Decide between the current winner and a concurrent candidate. Returns the new winner. */
function pickConcurrent(winner: H2CEvent, cand: H2CEvent): H2CEvent {
  if (winner.role !== cand.role) return winner.role === 'captain' ? winner : cand
  if (winner.type === 'handoff_logged') {
    const wa = winner.payload.at as number, ca = cand.payload.at as number
    if (wa !== ca) return wa < ca ? winner : cand
  }
  return cmp(cand, winner) > 0 ? cand : winner
}

export function resolveKeys(events: H2CEvent[]): { winners: Map<string, H2CEvent>; alternates: Record<string, Alternate[]> } {
  const undone = new Set<string>()
  for (const e of events) if (e.type === 'undo') undone.add(String(e.payload.targetEventId))
  const groups = new Map<string, H2CEvent[]>()
  for (const e of events) {
    if (e.type === 'undo' || undone.has(e.id)) continue
    const k = keyOf(e)
    if (!k) continue
    const g = groups.get(k) ?? []
    g.push(e); groups.set(k, g)
  }
  const winners = new Map<string, H2CEvent>()
  const alternates: Record<string, Alternate[]> = {}
  for (const [k, g] of groups) {
    g.sort(cmp)
    let winner: H2CEvent | null = null
    let alts: Alternate[] = []
    for (const c of g) {
      if (!winner) { winner = c; continue }
      const corrects = c.deviceId === winner.deviceId || c.seenTs >= winner.ts
      if (corrects) { winner = c; alts = []; continue }
      const w = pickConcurrent(winner, c)
      const loser = w === winner ? c : winner
      winner = w
      alts.push({ event: loser, winner })
    }
    winners.set(k, winner!)
    if (alts.length) alternates[k] = alts
  }
  return { winners, alternates }
}

export function reduce(team: TeamData, events: H2CEvent[], now?: number): RaceState {
  const s = initialState(team)
  const { winners, alternates } = resolveKeys(events)
  s.alternates = alternates
  let lastHandoffTs: number | null = null
  for (const [, e] of winners) {
    const p = e.payload
    switch (e.type) {
      case 'handoff_logged':
        s.actual[p.leg as number] = p.at as number
        if (lastHandoffTs === null || e.ts > lastHandoffTs) lastHandoffTs = e.ts
        break
      case 'assignment_set': s.assignments[(p.leg as number) - 1] = p.runnerId as RunnerId; break
      case 'runner_status_set': s.runnerStatus[p.runnerId as RunnerId] = p.status as RunnerStatus; break
      case 'pace_set': s.paces[p.runnerId as RunnerId] = p.paceSec as number; s.paceEntered[p.runnerId as RunnerId] = true; break
      case 'leg_expect_set': s.expect[p.leg as number] = (p.durationSec as number | null) ?? null; break
      case 'driver_set': s.drivers[p.leg as number] = (p.runnerId as RunnerId | null) ?? null; break
      case 'drive_min_set': s.driveMin[p.leg as number] = p.minutes as number; break
      case 'note_set': s.notes[p.leg as number] = String(p.text ?? ''); break
      case 'planned_start_set': s.plannedStart = p.at as number; break
      case 'settings_set': if (typeof p.hillAdjust === 'boolean') s.hillAdjust = p.hillAdjust; break
    }
  }
  s.lastHandoffTs = lastHandoffTs
  // captain devices seen within 24h of the newest event (event-time based, so it never depends on the phone clock)
  let maxTs = 0
  for (const e of events) if (e.ts > maxTs) maxTs = e.ts
  const cutoff = (now !== undefined ? Math.min(now, maxTs) : maxTs) - 24 * 3600 * 1000
  const caps = new Set<string>()
  for (const e of events) if (e.role === 'captain' && e.ts >= cutoff) caps.add(e.deviceId)
  s.captainDevices = [...caps]
  return s
}

export interface EventCtx { deviceId: string; role: Role; log: H2CEvent[]; now: number; id?: string }

/** Create an event; seenTs = newest ts from OTHER devices in the local log. */
export function makeEvent(type: string, payload: Record<string, unknown>, ctx: EventCtx): H2CEvent {
  let seenTs = 0
  for (const e of ctx.log) if (e.deviceId !== ctx.deviceId && e.ts > seenTs) seenTs = e.ts
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) if (v !== undefined) clean[k] = v
  return { id: ctx.id ?? newId(), v: 1, ts: ctx.now, seenTs, deviceId: ctx.deviceId, role: ctx.role, type, payload: clean }
}

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
