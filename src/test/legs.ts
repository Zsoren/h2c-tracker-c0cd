// Test fixture: legs built from the transcribed sheet (no exchange data needed for engine tests).
// @ts-ignore — plain ESM module without types
import { SHEET_LEGS, MAJOR_EXCHANGES } from '../../scripts/sheet-legs.mjs'
import type { Leg } from '../model/types'

export const LEGS: Leg[] = (SHEET_LEGS as [number, number, number, number, number, number, string[]][]).map(
  ([n, miles, gain, loss, net, difficulty, notes]) => ({
    n, miles, gain, loss, net, difficulty, notes,
    majorExchange: (MAJOR_EXCHANGES as number[]).includes(n),
    exchangeName: '', address: '', lat: null, lng: null,
    vanSupport: 'yes', vanNote: '', vanRouteNote: '',
    driveMinDefault: Math.ceil((miles / 25) * 60) + 5,
    walkMinDefault: (MAJOR_EXCHANGES as number[]).includes(n) ? 15 : 10,
    leaveNow: n === 1,
    pdfUrl: '', videoId: '',
  }),
)
