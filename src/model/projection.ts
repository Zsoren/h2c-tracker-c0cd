import type { Leg, RaceState, RunnerId, TeamData } from './types'
import { localMinutes } from './time'
import { N_LEGS } from './events'

export type Gear = 'NIGHT' | 'REFLECTIVE' | 'DAY'
export type TimeKind = 'actual' | 'est' | 'projected'

export interface LegProjection {
  n: number
  runnerId: RunnerId
  start: number
  end: number
  durationSec: number
  startKind: TimeKind
  endKind: TimeKind
  gear: Gear
  leaveBy: number | 'now'
  driveMin: number
  walkMin: number
  expectEdited: boolean
  flags: string[]
}

export type Phase = 'pre' | 'racing' | 'finished'

export interface Projection {
  legs: LegProjection[]          // index 0 → leg 1
  finish: number
  finishKind: TimeKind
  planFinish: number
  deltaSec: number               // finish − planFinish (positive = behind)
  phase: Phase
  currentLeg: number             // 1..36 while racing; 0 pre; 37 finished
  maxLogged: number              // highest index with an actual handoff (0 = start only, -1 none)
}

export function legDurationSec(leg: Leg, paceSec: number, hillAdjust: boolean): number {
  return Math.round(leg.miles * paceSec * (hillAdjust ? gradeFactor(leg, paceSec) : 1))
}

export function gradeFactor(leg: Leg, paceSec: number): number {
  const ft = leg.miles * 5280
  const gainPct = (leg.gain / ft) * 100
  const lossPct = (leg.loss / ft) * 100
  const deltaSecPerMile = 12 * gainPct - 8 * lossPct
  return clamp(1 + deltaSecPerMile / paceSec, 0.8, 1.2)
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)) }

/** Does [start,end) overlap the local-time window [winStart,winEnd) (minutes of day; may wrap midnight)? */
export function overlapsWindow(start: number, end: number, winStart: number, winEnd: number): boolean {
  if (end <= start) return false
  if (end - start >= 24 * 3600 * 1000) return true
  const m0 = localMinutes(start)
  const m1 = m0 + (end - start) / 60000
  const wins = winStart < winEnd ? [[winStart, winEnd]] : [[winStart, 1440], [0, winEnd]]
  for (const [a, b] of wins) for (const off of [0, 1440, 2880]) if (m0 < b + off && m1 > a + off) return true
  return false
}

/** Badge text for a gear tag. */
export function gearLabel(g: Gear): string {
  return g === 'NIGHT' ? 'NIGHT GEAR' : g === 'REFLECTIVE' ? 'VEST' : 'DAY'
}

export function gearFor(start: number, end: number): Gear {
  if (overlapsWindow(start, end, 18 * 60, 7 * 60)) return 'NIGHT'
  if (overlapsWindow(start, end, 7 * 60, 9 * 60)) return 'REFLECTIVE'
  return 'DAY'
}

export function project(_team: TeamData, legs: Leg[], s: RaceState): Projection {
  const dur: number[] = Array(N_LEGS + 1).fill(0)
  for (const leg of legs) {
    const pace = s.paces[s.assignments[leg.n - 1]] ?? 600
    dur[leg.n] = s.expect[leg.n] ?? legDurationSec(leg, pace, s.hillAdjust)
  }
  // --- estimated times for skipped legs: run a..b-1 unknown, b known, anchor = actual[a-1] ?? plannedStart
  const est: (number | null)[] = Array(N_LEGS + 1).fill(null)
  for (let b = 1; b <= N_LEGS; b++) {
    if (s.actual[b] === null) continue
    let a = b
    while (a - 1 >= 1 && s.actual[a - 1] === null) a--
    if (a === b) continue
    const anchor = s.actual[a - 1] ?? s.plannedStart
    let sum = 0
    for (let k = a; k <= b; k++) sum += dur[k]
    const scale = sum > 0 ? Math.max(0, (s.actual[b]! - anchor) / (sum * 1000)) : 0
    let t = anchor
    for (let k = a; k < b; k++) { t += dur[k] * 1000 * scale; est[k] = Math.round(t) }
  }
  const out: LegProjection[] = []
  let prevEnd = s.actual[0] ?? s.plannedStart
  let prevKind: TimeKind = s.actual[0] !== null ? 'actual' : 'projected'
  for (const leg of legs) {
    const n = leg.n
    const start = prevEnd
    const startKind = prevKind
    const flags: string[] = []
    let end: number, endKind: TimeKind
    if (s.actual[n] !== null) {
      end = s.actual[n]!
      endKind = 'actual'
      if (end < start) { flags.push('out-of-order'); end = start }
    } else if (est[n] !== null) {
      end = est[n]!; endKind = 'est'
    } else {
      end = start + dur[n] * 1000; endKind = 'projected'
    }
    const driveMin = s.driveMin[n] ?? leg.driveMinDefault
    const walkMin = leg.walkMinDefault
    let leaveBy: number | 'now' = leg.leaveNow ? 'now' : end - (driveMin + walkMin) * 60000
    // short legs: if the deadline lands before (or within 3 min of) the leg start, the answer is simply "leave now"
    if (leaveBy !== 'now' && leaveBy <= start + 3 * 60000) leaveBy = 'now'
    out.push({
      n, runnerId: s.assignments[n - 1], start, end, durationSec: Math.round((end - start) / 1000),
      startKind, endKind, gear: gearFor(start, end), leaveBy, driveMin, walkMin,
      expectEdited: s.expect[n] !== null, flags,
    })
    prevEnd = end; prevKind = endKind
  }
  // --- baseline plan: the same projection with nothing logged and no mid-race adjustments
  // (current paces, assignments and hills setting, from the planned start). Pre-race the delta is therefore 0;
  // during the race it measures real handoffs + hand-set expected times against the plan.
  let planFinish = s.plannedStart
  for (const leg of legs) {
    const pace = s.paces[s.assignments[leg.n - 1]] ?? 600
    planFinish += legDurationSec(leg, pace, s.hillAdjust) * 1000
  }
  let maxLogged = -1
  for (let i = 0; i <= N_LEGS; i++) if (s.actual[i] !== null) maxLogged = i
  const phase: Phase = s.actual[36] !== null ? 'finished' : s.actual[0] !== null ? 'racing' : 'pre'
  const currentLeg = phase === 'pre' ? 0 : phase === 'finished' ? 37 : maxLogged + 1
  const last = out[out.length - 1]
  return { legs: out, finish: last.end, finishKind: last.endKind, planFinish, deltaSec: (last.end - planFinish) / 1000, phase, currentLeg, maxLogged }
}

export function runnerMiles(legs: Leg[], assignments: RunnerId[], runnerId: RunnerId): number {
  let m = 0
  for (const leg of legs) if (assignments[leg.n - 1] === runnerId) m += leg.miles
  return Math.round(m * 100) / 100
}

/** Most-rested active runner with no adjacent leg; tie → fewest miles. */
export function suggestReplacement(team: TeamData, legs: Leg[], s: RaceState, proj: Projection, legN: number, exclude: RunnerId[] = []): RunnerId | null {
  const cands = team.runners
    .filter(r => s.runnerStatus[r.id] === 'active' && !exclude.includes(r.id))
    .filter(r => s.assignments[legN - 2] !== r.id && s.assignments[legN] !== r.id)
  if (!cands.length) return null
  const startL = proj.legs[legN - 1].start
  const scored = cands.map(r => {
    let prevEnd = s.plannedStart
    for (let k = legN - 1; k >= 1; k--) if (s.assignments[k - 1] === r.id) { prevEnd = proj.legs[k - 1].end; break }
    return { id: r.id, rest: startL - prevEnd, miles: runnerMiles(legs, s.assignments, r.id) }
  })
  scored.sort((a, b) => (b.rest - a.rest) || (a.miles - b.miles) || (a.id < b.id ? -1 : 1))
  return scored[0].id
}

/** Adjacent legs already assigned to this runner (would create a back-to-back). */
export function backToBack(s: RaceState, legN: number, runnerId: RunnerId): number[] {
  const out: number[] = []
  if (legN - 1 >= 1 && s.assignments[legN - 2] === runnerId) out.push(legN - 1)
  if (legN + 1 <= N_LEGS && s.assignments[legN] === runnerId) out.push(legN + 1)
  return out
}

export interface ValidationError { message: string }

/** Validate a handoff time for leg `legN` (0..36). */
export function validateHandoff(s: RaceState, legN: number, at: number, now: number): ValidationError | null {
  if (at > now + 60000) return { message: 'That time is in the future.' }
  for (let i = legN - 1; i >= 0; i--) {
    if (s.actual[i] !== null) {
      if (at < s.actual[i]!) return { message: `Must be after the ${i === 0 ? 'race start' : `Leg ${i} handoff`}.` }
      break
    }
  }
  for (let i = legN + 1; i <= N_LEGS; i++) {
    if (s.actual[i] !== null) {
      if (at > s.actual[i]!) return { message: `Must be before the Leg ${i} handoff.` }
      break
    }
  }
  return null
}
