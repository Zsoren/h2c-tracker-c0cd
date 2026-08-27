import type { Leg } from './types'
import type { Projection } from './projection'
import { TZ } from './time'

export interface Reminder { text: string; key: string }

/**
 * Situational reminders for NOW, most important first. Only things that change what the driver does;
 * ~14 of 36 legs show one, the rest show nothing. `names` = short names by runner id.
 */
export function reminders(legs: Leg[], proj: Projection, now: number, names: Record<string, string> = {}): Reminder[] {
  const out: Reminder[] = []
  if (proj.phase === 'pre') {
    out.push({ key: 'checkin', text: 'Check-in 1 hr before start — gear check' })
    out.push({ key: 'leg1', text: 'Leg 1: night gear · van drives straight to Exch 1' })
    return out
  }
  if (proj.phase === 'finished') { out.push({ key: 'done', text: 'Awards 5:15 PM main stage · course closes 9 PM' }); return out }
  const n = proj.currentLeg
  const leg = legs[n - 1]
  const lp = proj.legs[n - 1]
  const next = legs[n] ?? null
  if (now > lp.end + 30 * 60000) out.push({ key: 'stale', text: `Nothing logged since ${clock(lp.start)} — LOG HANDOFF, pick the exchange` })
  if (n === 18) out.push({ key: 'cell', text: "Cell dies after Exch 18 — log on captain's phone" })
  if (n >= 33 && n <= 35) out.push({ key: 'sign', text: 'Colored HTC sign in windshield — legs 33–35' })
  if (n === 36) {
    out.push({ key: 'lot', text: 'Van → Seaside shuttle lot, walk to the beach' })
    out.push({ key: 'meet', text: `Meet ${names[lp.runnerId] ?? 'the runner'} before the chute — run in together` })
  }
  if (leg.notes.some(x => /quiet/i.test(x))) out.push({ key: 'quiet', text: `Quiet zone at Exch ${n} — engine & lights off` })
  if (leg.majorExchange) out.push({ key: 'major', text: `Exch ${n} is a major — long walk to the chute, go early` })
  if (next && next.notes.some(x => /gravel/i.test(x))) out.push({ key: 'nextgravel', text: `Leg ${n + 1} runner: gravel & dust — bandana` })
  return out
}

const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
function clock(ts: number) { return clockFmt.format(new Date(ts)).replace(/\s/g, ' ') }

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
