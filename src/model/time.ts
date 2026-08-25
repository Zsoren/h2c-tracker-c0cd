export const TZ = 'America/Los_Angeles'

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short', month: 'numeric', day: 'numeric',
})

function parts(ts: number) {
  const out: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(new Date(ts))) out[p.type] = p.value
  return out
}

/** Minutes since local (Pacific) midnight, with fractional seconds. */
export function localMinutes(ts: number): number {
  const p = parts(ts)
  const h = (+p.hour) % 24
  const m = +p.minute
  const secs = Math.floor(ts / 1000) % 60
  return h * 60 + m + secs / 60
}

export function localDayKey(ts: number): string {
  const p = parts(ts)
  return `${p.month}/${p.day}`
}

export function weekday(ts: number): string {
  return parts(ts).weekday
}

const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })

/** "4:31 PM" */
export function fmtClock(ts: number): string {
  return clockFmt.format(new Date(ts)).replace(/\s/g, ' ')
}

/** "4:31 PM" if same local day as `now`, else "Sat 2:14 AM". */
export function fmtTimeRel(ts: number, now: number): string {
  const c = fmtClock(ts)
  return localDayKey(ts) === localDayKey(now) ? c : `${weekday(ts)} ${c}`
}

/** "in 38 min" / "38 min ago" / "in 2h 10m" */
export function fmtRelative(ts: number, now: number): string {
  const d = Math.round((ts - now) / 60000)
  const abs = Math.abs(d)
  const body = abs < 60 ? `${abs} min` : `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m`
  return d >= 0 ? `in ${body}` : `${body} ago`
}

/** "2h 10m" / "38 min" for a positive duration in ms */
export function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** seconds → "1:02:36" or "48:24" */
export function fmtHMS(sec: number, forceHours = false): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (h > 0 || forceHours) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

/** "1:02:36" or "48:24" → seconds */
export function parseHMS(s: string): number {
  const p = s.trim().split(':').map(Number)
  if (p.some(isNaN)) throw new Error(`bad time ${s}`)
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return p[0]
}

/** seconds per mile → "10:00" */
export function fmtPace(paceSec: number): string {
  const total = Math.round(paceSec)
  const m = Math.floor(total / 60), s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "12 min behind" / "4 min ahead" / "on plan" for a signed second delta (positive = later than plan) */
export function fmtDelta(sec: number): string {
  const m = Math.round(sec / 60)
  if (m === 0) return 'on plan'
  return m > 0 ? `${m} min behind` : `${-m} min ahead`
}
