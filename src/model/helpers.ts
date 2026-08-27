import type { Leg } from './types'
import type { Projection } from './projection'
import { TZ } from './time'

export interface Reminder { text: string; key: string }

/** Situational reminders for NOW (most important first). `names` = short names by runner id. */
export function reminders(legs: Leg[], proj: Projection, now: number, names: Record<string, string> = {}): Reminder[] {
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
  const next = legs[n] ?? null
  // stale log: nothing logged for a long time → the one thing to do
  if (now > lp.end + 30 * 60000) out.push({ key: 'stale', text: `Nothing logged since ${clock(lp.start)} — LOG HANDOFF, pick the exchange` })
  // where the van goes
  if (n === 36) out.push({ key: 'novan', text: 'Van → Seaside shuttle lot, walk to beach' })
  else if (leg.vanSupport === 'no') out.push({ key: 'novan', text: `No van support — drive to Exch ${n}` })
  // the runner about to go out
  if (next) {
    const water = next.vanSupport !== 'yes' || /water/i.test(next.vanNote)
    if (next.vanSupport === 'no' || /water/i.test(next.vanNote)) out.push({ key: 'nextwater', text: `Leg ${n + 1} runner: carry water — no van` })
    else if (water && next.vanSupport === 'restricted') out.push({ key: 'nextvan', text: `Leg ${n + 1} runner: van rules — carry water` })
    if (next.notes.some(x => /gravel/i.test(x))) out.push({ key: 'nextgravel', text: `Leg ${n + 1} runner: gravel — bandana` })
  }
  if (n === 18) out.push({ key: 'cell', text: "Cell dies after Exch 18 — captain's phone logs" })
  if (n === 19) out.push({ key: 'sign', text: 'Van sign up for legs 19–23' })
  if (n === 36) out.push({ key: 'seaside', text: `Meet ${names[lp.runnerId] ?? 'the runner'} before the chute — run in together` })
  if (leg.vanSupport === 'restricted' && n !== 36) out.push({ key: 'vanrules', text: `Van rules on this leg — see Leg ${n}` })
  if (lp.gear === 'NIGHT') out.push({ key: 'night', text: "Night: don't trail the runner" })
  if (leg.notes.some(x => /quiet/i.test(x))) out.push({ key: 'quiet', text: 'Quiet zone: engine & lights off' })
  if (leg.majorExchange) out.push({ key: 'major', text: 'Major exch: long walk, leave early' })
  const prev = legs[n - 2]
  if (prev?.majorExchange && now - lp.start < 15 * 60000) out.push({ key: 'finisher', text: 'Finisher: go straight to van lot' })
  if (n >= 31 && n < 36) out.push({ key: 'seaside', text: 'Seaside traffic — drop runner early' })
  if (leg.notes.some(x => /gravel/i.test(x))) out.push({ key: 'gravel', text: 'Gravel / dust — bandana helps' })
  if (leg.notes.some(x => /shade/i.test(x)) && lp.gear === 'DAY') out.push({ key: 'shade', text: 'Little/no shade — water & hat' })
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
