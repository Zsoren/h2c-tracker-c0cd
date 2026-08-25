import type { Leg, RaceState, RunnerId, TeamData } from './types'
import type { Projection } from './projection'
import { N_LEGS } from './events'
import { TZ } from './time'

/** Default driver for leg N: the runner who ran leg N−4 (rested, not on deck); never the runner of N−1, N or N+1. */
export function defaultDriver(team: TeamData, s: RaceState, n: number): RunnerId | null {
  const avoid = new Set<RunnerId>([s.assignments[n - 1], s.assignments[n - 2], s.assignments[n]].filter(Boolean) as RunnerId[])
  const order: number[] = []
  for (let k = n - 4; k >= 1; k--) order.push(k)
  for (let k = n + 5; k <= N_LEGS; k++) order.push(k)
  for (const k of order) {
    const r = s.assignments[k - 1]
    if (r && !avoid.has(r) && s.runnerStatus[r] === 'active') return r
  }
  return team.runners.find(r => !avoid.has(r.id) && s.runnerStatus[r.id] === 'active')?.id ?? null
}

export interface Reminder { text: string; key: string }

/** Situational reminders for NOW (most important first). */
export function reminders(legs: Leg[], proj: Projection, now: number): Reminder[] {
  const out: Reminder[] = []
  if (proj.phase === 'pre') {
    out.push({ key: 'checkin', text: 'Check-in 1 hr before start — gear check' })
    out.push({ key: 'leg1', text: 'Leg 1: night gear · no van support' })
    return out
  }
  if (proj.phase === 'finished') { out.push({ key: 'done', text: 'Awards 5:15 PM main stage · course closes 9 PM' }); return out }
  const n = proj.currentLeg
  const leg = legs[n - 1]
  const lp = proj.legs[n - 1]
  if (leg.vanSupport === 'no') out.push({ key: 'novan', text: `No van support — drive to Exch ${n}` })
  else if (leg.vanSupport === 'restricted') out.push({ key: 'vanrules', text: `Van rules on this leg — see Leg ${n}` })
  if (lp.gear === 'NIGHT') out.push({ key: 'night', text: "Night: don't trail the runner" })
  if (leg.notes.some(x => /quiet/i.test(x))) out.push({ key: 'quiet', text: 'Quiet zone: engine & lights off' })
  if (leg.majorExchange) out.push({ key: 'major', text: 'Major exch: long walk, leave early' })
  const prev = legs[n - 2]
  if (prev?.majorExchange && now - lp.start < 15 * 60000) out.push({ key: 'finisher', text: 'Finisher: go straight to van lot' })
  if (n >= 31) out.push({ key: 'seaside', text: 'Seaside traffic — drop runner early' })
  if (leg.notes.some(x => /gravel/i.test(x))) out.push({ key: 'gravel', text: 'Gravel / dust — bandana helps' })
  if (leg.notes.some(x => /shade/i.test(x)) && lp.gear === 'DAY') out.push({ key: 'shade', text: 'Little/no shade — water & hat' })
  return out
}

const pFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false })

function pacificParts(ts: number) {
  const o: Record<string, number> = {}
  for (const p of pFmt.formatToParts(new Date(ts))) if (p.type !== 'literal') o[p.type] = +p.value
  if (o.hour === 24) o.hour = 0
  return o
}

/** "HH:MM" in Pacific time for an <input type=time>. */
export function toHHMM(ts: number): string {
  const p = pacificParts(ts)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/**
 * Combine a Pacific-local "HH:MM" with the calendar day of `anchor`.
 * If the result lands more than 12 h after `anchor`, assume it was meant for the previous day (just-after-midnight entry).
 */
export function fromHHMM(hhmm: string, anchor: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const p = pacificParts(anchor)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const offsetMs = asUtc - Math.floor(anchor / 1000) * 1000
  let ts = Date.UTC(p.year, p.month - 1, p.day, +m[1], +m[2], 0) - offsetMs
  if (ts - anchor > 12 * 3600 * 1000) ts -= 24 * 3600 * 1000
  if (anchor - ts > 12 * 3600 * 1000) ts += 24 * 3600 * 1000
  return ts
}

export function mapsUrl(leg: Leg): string {
  if (leg.lat != null && leg.lng != null) return `https://maps.google.com/?q=${leg.lat},${leg.lng}`
  return `https://maps.google.com/?q=${encodeURIComponent(leg.address)}`
}

export function difficultyLabel(d: number): string {
  return ['', 'Easy', 'Moderate', 'Hard', 'Very hard'][d] ?? String(d)
}
