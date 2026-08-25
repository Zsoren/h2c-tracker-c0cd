import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare } from './share'
import type { H2CEvent } from '../model/types'

const ev = (i: number): H2CEvent => ({ id: `id-${i}`, v: 1, ts: 1000 + i, seenTs: 0, deviceId: 'A', role: 'member', type: 'handoff_logged', payload: { leg: i, at: 1756373700000 + i * 3600000 } })

describe('share link', () => {
  it('round-trips the event log through a #s= link', async () => {
    const events = Array.from({ length: 40 }, (_, i) => ev(i))
    const url = await encodeShare(events, 'https://example.test/app/')
    expect(url.startsWith('https://example.test/app/#s=')).toBe(true)
    expect(url.length).toBeLessThan(4000)
    const back = await decodeShare(url)
    expect(back).toEqual(events)
    const fromFragmentOnly = await decodeShare(url.slice(url.indexOf('#s=') + 3))
    expect(fromFragmentOnly).toEqual(events)
  })
  it('ignores non-links', async () => {
    expect(await decodeShare('hello')).toEqual([])
  })
})
