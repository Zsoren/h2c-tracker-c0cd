// Safe localStorage wrapper: falls back to memory (and reports it) if storage is unavailable.
const mem = new Map<string, string>()
let ok = true
try {
  const k = 'h2c:probe'
  localStorage.setItem(k, '1'); localStorage.removeItem(k)
} catch { ok = false }

export const storageOk = ok

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = ok ? localStorage.getItem(key) : mem.get(key) ?? null
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

export function saveJSON(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value)
  if (!ok) { mem.set(key, raw); return false }
  try { localStorage.setItem(key, raw); return true } catch { mem.set(key, raw); return false }
}

export function removeKey(key: string) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
  mem.delete(key)
}
