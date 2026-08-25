import type { Projection } from './projection'
import type { Leg, RaceState, RunnerId, TeamData } from './types'
import { N_LEGS } from './events'

export const STALE_MS = 30 * 60000

/** Leg whose handoff the sheet should pre-select (0 = race start), or null when the time is clearly stale. */
export function defaultLeg(proj: Projection, at: number): number | null {
  const next = proj.maxLogged + 1
  if (next > N_LEGS) return null
  if (next < 1) return 0
  const end = proj.legs[next - 1].end
  return at <= end + STALE_MS ? next : null
}

/** Unlogged leg whose projected finish is nearest `at`. */
export function suggestedLeg(proj: Projection, s: RaceState, at: number): number | null {
  let best: number | null = null, bestD = Infinity
  for (let L = 1; L <= N_LEGS; L++) {
    if (s.actual[L] !== null) continue
    const d = Math.abs(proj.legs[L - 1].end - at)
    if (d < bestD) { bestD = d; best = L }
  }
  return best
}

/** The runner's next leg at or after the race's current position (what "Who just finished?" resolves to). */
export function currentLegOf(s: RaceState, maxLogged: number, runnerId: RunnerId): number | null {
  for (let L = Math.max(1, maxLogged + 1); L <= N_LEGS; L++) if (s.assignments[L - 1] === runnerId && s.actual[L] === null) return L
  return null
}

export function mismatchWarning(proj: Projection, chosen: number, at: number): boolean {
  if (chosen < 1) return false
  const lp = proj.legs[chosen - 1]
  return Math.abs(lp.end - at) > lp.durationSec * 1000
}

export interface SkipInfo { skipped: number[]; scale: number; elapsedSec: number; amber: boolean }

/** Legs that would get estimated times if `chosen` is logged at `at`. */
export function skipInfo(proj: Projection, s: RaceState, chosen: number, at: number): SkipInfo | null {
  let a = chosen
  while (a - 1 >= 1 && s.actual[a - 1] === null) a--
  if (a === chosen) return null
  const anchor = s.actual[a - 1] ?? s.plannedStart
  let sum = 0
  for (let k = a; k <= chosen; k++) sum += proj.legs[k - 1].durationSec
  const elapsedSec = (at - anchor) / 1000
  const scale = sum > 0 ? elapsedSec / sum : 0
  const skipped: number[] = []
  for (let k = a; k < chosen; k++) skipped.push(k)
  return { skipped, scale, elapsedSec, amber: scale < 0.7 || scale > 1.5 }
}

/** Leg to pre-select for "I just finished", or null if the link must be hidden. */
export function showIJustFinished(proj: Projection, s: RaceState, me: RunnerId | null): number | null {
  if (proj.phase !== 'racing' || !me) return null
  const L = proj.currentLeg
  if (L < 1 || L > N_LEGS) return null
  return s.assignments[L - 1] === me && s.actual[L] === null ? L : null
}

export function totalMilesFor(legs: Leg[], team: TeamData, s: RaceState): Record<RunnerId, number> {
  const out: Record<RunnerId, number> = {}
  for (const r of team.runners) out[r.id] = 0
  for (const leg of legs) out[s.assignments[leg.n - 1]] = (out[s.assignments[leg.n - 1]] ?? 0) + leg.miles
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100
  return out
}
