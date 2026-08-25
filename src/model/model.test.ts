import { describe, it, expect } from 'vitest'
import teamJson from '../data/team.json'
import { LEGS } from '../test/legs'
import type { H2CEvent, TeamData, Role } from './types'
import { reduce, initialState, makeEvent, N_LEGS } from './events'
import { project, validateHandoff, suggestReplacement, backToBack, legDurationSec } from './projection'
import { parseHMS, fmtHMS, localMinutes, fmtDelta } from './time'
import { defaultLeg, skipInfo, showIJustFinished, currentLegOf, mismatchWarning } from './sheet'

const T = teamJson as TeamData
const START = Date.parse(T.plannedStart)
const MIN = 60000
const H = 60 * MIN

let seq = 0
function ev(type: string, payload: Record<string, unknown>, o: { ts: number; dev?: string; role?: Role; seenTs?: number; id?: string }): H2CEvent {
  seq++
  return { id: o.id ?? `e${String(seq).padStart(4, '0')}`, v: 1, ts: o.ts, seenTs: o.seenTs ?? 0, deviceId: o.dev ?? 'A', role: o.role ?? 'member', type, payload }
}
const handoff = (leg: number, at: number, o: Parameters<typeof ev>[2]) => ev('handoff_logged', { leg, at }, o)

/** Plan (sheet) end time of leg n, flat pace, default assignments. */
function planEnd(n: number): number {
  let t = START
  for (const leg of LEGS.slice(0, n)) t += legDurationSec(leg, T.runners.find(r => r.id === T.assignments[leg.n - 1])!.paceSec, false) * 1000
  return t
}

describe('projection matches the sheet', () => {
  const p = project(T, LEGS, initialState(T))
  it('flat total is 31:54:18 and leg 1 is 1:02:36', () => {
    expect(p.finish - START).toBe(parseHMS('31:54:18') * 1000)
    expect(p.legs[0].durationSec).toBe(parseHMS('1:02:36'))
    expect(p.legs[8].durationSec).toBe(parseHMS('59:11'))
    expect(fmtHMS(parseHMS('31:54:18'))).toBe('31:54:18')
  })
  it('pre-race phase, on plan', () => {
    expect(p.phase).toBe('pre'); expect(p.currentLeg).toBe(0); expect(p.deltaSec).toBe(0); expect(fmtDelta(p.deltaSec)).toBe('on plan')
    expect(localMinutes(START)).toBeCloseTo(3 * 60 + 35, 3)
  })
  it('gear tags computed from times: 1–4 NIGHT, 5–6 REFLECTIVE, 7 DAY, 16 NIGHT', () => {
    const g = p.legs.map(l => l.gear)
    expect(g.slice(0, 4)).toEqual(['NIGHT', 'NIGHT', 'NIGHT', 'NIGHT'])
    expect(g.slice(4, 6)).toEqual(['REFLECTIVE', 'REFLECTIVE'])
    expect(g[6]).toBe('DAY'); expect(g[8]).toBe('DAY'); expect(g[15]).toBe('NIGHT'); expect(g[35]).toBe('DAY')
  })
  it('hills toggle: climbs slower, descents faster, labeled per leg', () => {
    const s = initialState(T); s.hillAdjust = true
    const h = project(T, LEGS, s)
    expect(h.legs[19].durationSec).toBeGreaterThan(p.legs[19].durationSec)
    expect(h.legs[0].durationSec).toBeLessThan(p.legs[0].durationSec)
  })
  it('LEAVE BY: leg 1 is now; others = end − drive − walk', () => {
    expect(p.legs[0].leaveBy).toBe('now')
    const l6 = p.legs[5]
    expect(l6.leaveBy).toBe(l6.end - (l6.driveMin + 15) * MIN)
  })
})

describe('re-anchoring to logged handoffs', () => {
  it('a 4-minute-late leg 1 shifts everything by 4 min', () => {
    const late = planEnd(1) + 4 * MIN
    const s = reduce(T, [handoff(0, START, { ts: START }), handoff(1, late, { ts: late })])
    const p = project(T, LEGS, s)
    expect(p.phase).toBe('racing'); expect(p.currentLeg).toBe(2)
    expect(p.legs[1].start).toBe(late); expect(p.legs[1].startKind).toBe('actual')
    expect(p.deltaSec).toBe(240); expect(fmtDelta(p.deltaSec)).toBe('4 min behind')
    expect(p.finish).toBe(planEnd(36) + 4 * MIN)
  })
  it('forgotten handoff: log 11 late then 12 now → current leg 13', () => {
    const t12 = planEnd(12)
    const s = reduce(T, [handoff(0, START, { ts: START }), handoff(11, planEnd(11), { ts: t12 }), handoff(12, t12, { ts: t12 + 30000 })])
    const p = project(T, LEGS, s)
    expect(p.currentLeg).toBe(13); expect(p.legs[10].endKind).toBe('actual'); expect(p.legs[11].endKind).toBe('actual')
    expect(s.lastHandoffTs).toBe(t12 + 30000)
  })
  it('out-of-order times from another phone clamp and flag instead of breaking', () => {
    const s = reduce(T, [handoff(0, START, { ts: START }), handoff(1, START + 60 * MIN, { ts: 1 }), handoff(2, START + 50 * MIN, { ts: 2, dev: 'B' })])
    const p = project(T, LEGS, s)
    expect(p.legs[1].end).toBe(p.legs[1].start); expect(p.legs[1].flags).toContain('out-of-order')
    expect(p.legs[2].start).toBe(START + 60 * MIN)
  })
})

describe('skipped legs', () => {
  const t25 = planEnd(25)
  const t30 = t25 + 4 * H + 20 * MIN
  const base = [handoff(0, START, { ts: START }), handoff(25, t25, { ts: t25 })]
  it('logging 30 after 25 estimates 26–29 proportionally, summing exactly to the gap', () => {
    const s = reduce(T, [...base, handoff(30, t30, { ts: t30 })])
    const p = project(T, LEGS, s)
    for (const n of [26, 27, 28, 29]) expect(p.legs[n - 1].endKind).toBe('est')
    expect(p.legs[29].endKind).toBe('actual'); expect(p.legs[29].end).toBe(t30)
    expect(p.legs[25].start).toBe(t25)
    const sum = [26, 27, 28, 29, 30].reduce((a, n) => a + p.legs[n - 1].durationSec, 0)
    expect(Math.abs(sum - (t30 - t25) / 1000)).toBeLessThanOrEqual(2)
    expect(p.legs[30].start).toBe(t30); expect(p.currentLeg).toBe(31)
    const info = skipInfo(project(T, LEGS, reduce(T, base)), reduce(T, base), 30, t30)!
    expect(info.skipped).toEqual([26, 27, 28, 29]); expect(info.elapsedSec).toBe((t30 - t25) / 1000); expect(info.amber).toBe(false)
  })
  it('a real time for 27 later replaces its estimate; 26 and 28–29 re-estimate around it', () => {
    const t27 = t25 + 2 * H
    const s = reduce(T, [...base, handoff(30, t30, { ts: t30 }), handoff(27, t27, { ts: t30 + 1 })])
    const p = project(T, LEGS, s)
    expect(p.legs[26].endKind).toBe('actual'); expect(p.legs[26].end).toBe(t27)
    expect(p.legs[25].endKind).toBe('est'); expect(p.legs[25].end).toBeLessThan(t27); expect(p.legs[25].end).toBeGreaterThan(t25)
    expect(p.legs[27].endKind).toBe('est'); expect(p.legs[28].endKind).toBe('est')
  })
  it('skip from an unlogged start anchors on the planned start', () => {
    const t3 = START + 2 * H
    const s = reduce(T, [handoff(3, t3, { ts: t3 })])
    const p = project(T, LEGS, s)
    expect(p.legs[0].endKind).toBe('est'); expect(p.legs[1].endKind).toBe('est'); expect(p.legs[2].end).toBe(t3)
    const sum = p.legs.slice(0, 3).reduce((a, l) => a + l.durationSec, 0)
    expect(Math.abs(sum - 2 * 3600)).toBeLessThanOrEqual(2)
  })
  it('sheet default: next leg when fresh, nothing when stale; suggestions work', () => {
    const s = reduce(T, base)
    const p = project(T, LEGS, s)
    expect(defaultLeg(p, p.legs[25].end + 10 * MIN)).toBe(26)
    expect(defaultLeg(p, p.legs[25].end + 31 * MIN)).toBeNull()
    expect(defaultLeg(project(T, LEGS, initialState(T)), START)).toBe(0)
    expect(currentLegOf(s, p.maxLogged, 'N')).toBe(30)
    expect(currentLegOf(s, p.maxLogged, 'K')).toBe(26)
    expect(mismatchWarning(p, 26, t30)).toBe(true); expect(mismatchWarning(p, 30, t30)).toBe(false)
  })
})

describe('expected time per leg', () => {
  it('overrides only that leg and shifts the finish by the difference', () => {
    const flat = project(T, LEGS, initialState(T))
    const s = reduce(T, [ev('leg_expect_set', { leg: 14, durationSec: 4500 }, { ts: 1 })])
    const p = project(T, LEGS, s)
    expect(p.legs[13].durationSec).toBe(4500); expect(p.legs[13].expectEdited).toBe(true)
    expect(p.legs[14].durationSec).toBe(flat.legs[14].durationSec)
    expect(p.deltaSec).toBe(4500 - flat.legs[13].durationSec)
  })
})

describe('reducer: merge rules', () => {
  const t = START + 10 * H
  it('is order-independent', () => {
    const events = [
      handoff(0, START, { ts: START }), handoff(14, t, { ts: t, dev: 'A' }), handoff(14, t + MIN, { ts: t + 5, dev: 'B' }),
      ev('assignment_set', { leg: 15, runnerId: 'W' }, { ts: t + 10, dev: 'B' }), ev('pace_set', { runnerId: 'Z', paceSec: 630 }, { ts: t + 20 }),
      ev('undo', { targetEventId: 'u1' }, { ts: t - 100 }), ev('leg_expect_set', { leg: 20, durationSec: 3000 }, { ts: t + 30, id: 'u1' }),
      ev('driver_set', { leg: 15, runnerId: 'N' }, { ts: t + 40, dev: 'C' }),
    ]
    const ref = JSON.stringify(reduce(T, events, t + H))
    for (let i = 0; i < 25; i++) {
      const sh = [...events].sort(() => Math.random() - 0.5)
      expect(JSON.stringify(reduce(T, sh, t + H))).toBe(ref)
    }
    const s = reduce(T, events, t + H)
    expect(s.expect[20]).toBeNull()               // undo landed even though it sorts before its target
    expect(s.actual[14]).toBe(t)                  // no captain → earlier `at` wins
    expect(s.alternates['handoff:14']).toHaveLength(1)
  })
  it('captain wins a true conflict; a later correction that saw it wins back; same device always corrects', () => {
    const a = handoff(14, t, { ts: 1000, dev: 'A' })
    const b = handoff(14, t + 5 * MIN, { ts: 1500, dev: 'B', role: 'captain' })
    let s = reduce(T, [a, b], t)
    expect(s.actual[14]).toBe(t + 5 * MIN); expect(s.alternates['handoff:14'][0].event.id).toBe(a.id)
    const fix = handoff(14, t + 3 * MIN, { ts: 2000, dev: 'A', seenTs: 1500 })
    s = reduce(T, [a, b, fix], t)
    expect(s.actual[14]).toBe(t + 3 * MIN); expect(s.alternates['handoff:14']).toBeUndefined()
    const again = handoff(14, t + 7 * MIN, { ts: 1200, dev: 'A' })
    s = reduce(T, [a, again], t)
    expect(s.actual[14]).toBe(t + 7 * MIN)
    expect(s.captainDevices).toEqual([])
  })
  it('a fast clock cannot fake a correction: unseen → concurrent → captain rule', () => {
    const cap = handoff(14, t, { ts: 1000, dev: 'A', role: 'captain' })
    const fast = handoff(14, t + 9 * MIN, { ts: 5000, dev: 'B' })
    const s = reduce(T, [cap, fast], t + H)
    expect(s.actual[14]).toBe(t); expect(s.captainDevices).toEqual(['A'])
  })
  it('different kinds of changes never conflict', () => {
    const s = reduce(T, [handoff(14, t, { ts: 1000, dev: 'A' }), ev('assignment_set', { leg: 14, runnerId: 'W' }, { ts: 1000, dev: 'B' })])
    expect(s.actual[14]).toBe(t); expect(s.assignments[13]).toBe('W'); expect(Object.keys(s.alternates)).toHaveLength(0)
  })
  it('two captains fall through to the type rule and are both reported', () => {
    const s = reduce(T, [handoff(14, t + MIN, { ts: 1000, dev: 'A', role: 'captain' }), handoff(14, t, { ts: 1100, dev: 'B', role: 'captain' })], t)
    expect(s.actual[14]).toBe(t); expect(s.captainDevices.sort()).toEqual(['A', 'B'])
  })
  it('makeEvent stamps seenTs from other devices only and strips undefined', () => {
    const log = [ev('pace_set', { runnerId: 'Z', paceSec: 600 }, { ts: 500, dev: 'A' }), ev('pace_set', { runnerId: 'Z', paceSec: 610 }, { ts: 900, dev: 'B' })]
    const e = makeEvent('note_set', { leg: 3, text: 'left side', extra: undefined }, { deviceId: 'A', role: 'member', log, now: 1000 })
    expect(e.seenTs).toBe(900); expect('extra' in e.payload).toBe(false); expect(e.id).toMatch(/[0-9a-f-]{36}/)
  })
})

describe('swaps, drops, validation', () => {
  it('replacement suggestion is never adjacent, active, and rested', () => {
    const s = reduce(T, [ev('runner_status_set', { runnerId: 'J', status: 'dropped' }, { ts: 1 })])
    const p = project(T, LEGS, s)
    const pick = suggestReplacement(T, LEGS, s, p, 32, ['J'])!
    expect(pick).not.toBe('J'); expect(pick).not.toBe('Z'); expect(pick).not.toBe('B')
    expect(backToBack(s, 32, 'Z')).toEqual([33]); expect(backToBack(s, 32, 'B')).toEqual([31]); expect(backToBack(s, 32, 'D')).toEqual([])
  })
  it('validation rejects times before the previous handoff, in the future, or after a later one', () => {
    const s = reduce(T, [handoff(0, START, { ts: START }), handoff(1, START + 60 * MIN, { ts: 1 }), handoff(3, START + 3 * H, { ts: 2 })])
    const now = START + 5 * H
    expect(validateHandoff(s, 2, START + 50 * MIN, now)?.message).toMatch(/after the Leg 1/)
    expect(validateHandoff(s, 2, now + H, now)?.message).toMatch(/future/)
    expect(validateHandoff(s, 2, START + 4 * H, now)?.message).toMatch(/before the Leg 3/)
    expect(validateHandoff(s, 2, START + 2 * H, now)).toBeNull()
    expect(validateHandoff(s, 1, START - MIN, now)?.message).toMatch(/race start/)
  })
  it('"I just finished" only while racing and only for my current/unlogged leg', () => {
    const pre = project(T, LEGS, initialState(T))
    expect(showIJustFinished(pre, initialState(T), 'Z')).toBeNull()
    const s = reduce(T, [handoff(0, START, { ts: START }), handoff(5, planEnd(5), { ts: 1 })])
    const p = project(T, LEGS, s)
    expect(showIJustFinished(p, s, 'Z')).toBe(6)     // Zane is running leg 6
    expect(showIJustFinished(p, s, 'A')).toBeNull()  // Alexandria's leg 7 hasn't started
    expect(showIJustFinished(p, s, null)).toBeNull()
    expect(N_LEGS).toBe(36)
  })
})
