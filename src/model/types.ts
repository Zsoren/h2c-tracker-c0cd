export type RunnerId = string

export interface Runner {
  id: RunnerId
  name: string
  short: string
  initials: string
  paceSec: number
  phone?: string
}

export type VanSupport = 'yes' | 'no' | 'restricted'

export interface Leg {
  n: number
  miles: number
  gain: number
  loss: number
  net: number
  difficulty: number
  notes: string[]
  majorExchange: boolean
  exchangeName: string
  address: string
  lat: number | null
  lng: number | null
  vanSupport: VanSupport
  /** the official NOTES line (van rules, hazards) */
  vanNote: string
  /** parking / van-route guidance from EXCHANGE NOTES + van directions */
  vanRouteNote: string
  driveMinDefault: number
  walkMinDefault: number
  leaveNow?: boolean
  pdfUrl: string
  videoId: string
  description?: string
  officialDifficulty?: string
  namedAfter?: string
  runnerDirections?: string[]
  vanDirections?: string[]
  exchangeNotes?: string[]
}

export interface TeamData {
  teamName: string
  plannedStart: string
  runners: Runner[]
  assignments: RunnerId[]
  sun: { sunrise: string; sunset: string }
  /** default for the hills toggle (can still be changed by the captain) */
  hillAdjust?: boolean
}

export type Role = 'captain' | 'member'

export interface H2CEvent {
  id: string
  v: 1
  ts: number
  seenTs: number
  deviceId: string
  role: Role
  type: string
  payload: Record<string, unknown>
}

export type RunnerStatus = 'active' | 'dropped'

export interface Alternate {
  event: H2CEvent
  winner: H2CEvent
}

export interface RaceState {
  /** index 0..36: time the handoff *ending* leg i happened (0 = race start). null = not logged */
  actual: (number | null)[]
  /** index 0..35 → leg 1..36 */
  assignments: RunnerId[]
  runnerStatus: Record<RunnerId, RunnerStatus>
  paces: Record<RunnerId, number>
  /** true once someone has actually entered this runner's pace (otherwise the sheet default is used silently) */
  paceEntered: Record<RunnerId, boolean>
  /** index 1..36: hand-set expected duration (seconds) or null */
  expect: (number | null)[]
  drivers: (RunnerId | null)[]
  driveMin: (number | null)[]
  notes: string[]
  plannedStart: number
  hillAdjust: boolean
  /** key → concurrent losers */
  alternates: Record<string, Alternate[]>
  captainDevices: string[]
  /** ts of the most recent confirmed handoff event (for the re-log warning) */
  lastHandoffTs: number | null
}
