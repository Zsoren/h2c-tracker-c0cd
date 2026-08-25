import type { H2CEvent } from '../model/types'

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function unb64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}

async function gzip(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  const cs = new CompressionStream('gzip')
  const w = cs.writable.getWriter(); w.write(data as BufferSource); w.close()
  return new Uint8Array(await new Response(cs.readable).arrayBuffer())
}
async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const w = ds.writable.getWriter(); w.write(data as BufferSource); w.close()
  return new Uint8Array(await new Response(ds.readable).arrayBuffer())
}

/** Encode the event log into a shareable URL (same page, `#s=` fragment). */
export async function encodeShare(events: H2CEvent[], baseUrl: string): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(events))
  const gz = await gzip(raw)
  const payload = gz ? 'g' + b64url(gz) : 'p' + b64url(raw)
  return `${baseUrl}#s=${payload}`
}

/** Decode a share fragment or full URL; returns [] if it isn't one. */
export async function decodeShare(input: string): Promise<H2CEvent[]> {
  const m = /#s=([A-Za-z0-9_-]+)/.exec(input) || /^([gp][A-Za-z0-9_-]+)$/.exec(input.trim())
  if (!m) return []
  const s = m[1]
  const kind = s[0], body = unb64url(s.slice(1))
  const raw = kind === 'g' ? await gunzip(body) : body
  const parsed = JSON.parse(new TextDecoder().decode(raw))
  return Array.isArray(parsed) ? parsed : []
}
