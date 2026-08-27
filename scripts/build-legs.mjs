// Merge sheet data + official PDF/video links + extracted exchange data → src/data/legs.json
// Usage: node scripts/build-legs.mjs <course-maps.html> <videos.json> <exchanges.json>
import fs from 'node:fs'
import { SHEET_LEGS, MAJOR_EXCHANGES } from './sheet-legs.mjs'

const [htmlPath, videosPath, exchangesPath] = process.argv.slice(2)
const html = fs.readFileSync(htmlPath, 'utf8')
const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'))
const ex = JSON.parse(fs.readFileSync(exchangesPath, 'utf8'))

const pdfUrl = {}
for (const m of html.matchAll(/https:\/\/hoodtocoast\.com\/wp-content\/uploads\/2026\/\d\d\/HTC-Leg-(\d+)\.pdf/g)) if (!pdfUrl[+m[1]]) pdfUrl[+m[1]] = m[0]

// Hand overrides where the official text needs interpretation for a single-van team.
const COLORED = 'Only the van displaying the colored HTC sign may drive this leg — your single van is that van; keep the sign visible.'
const OVERRIDES = {
  11: { vanSupport: 'restricted', vanNote: 'Springwater Trail leg — van access to the runner is limited. Runner should carry water.' },
  33: { vanSupport: 'restricted', vanNote: COLORED },
  34: { vanSupport: 'restricted', vanNote: COLORED },
  35: { vanSupport: 'restricted', vanNote: COLORED + ' Do not litter or drop water bottles on the Lewis & Clark Mainline Trail.' },
  36: { vanSupport: 'no', vanNote: 'Vans do not follow the course on Leg 36 — go straight to Seaside shuttle parking (handbook p.72) and walk to the beach finish.' },
}
// Curated names where the PDF text is missing or wraps awkwardly.
const NAME_FALLBACK = {
  2: 'Rd 35 / HWY 26 (Government Camp)',
  3: '9 Rd & HWY 26 (Rhododendron)',
  7: 'SE Proctor Rd, Boring',
  10: 'Springwater Trail near Shaw\'s Automotive / SE 111th Ave',
  11: 'Springwater Trail near SE 45th Ave / Johnson Creek Blvd',
  12: 'OMSI gravel lot (end of SE 2nd Place)',
  13: 'NW Front Ave (3838)',
  21: 'Pittsburgh Rd gravel section (GPS pin)',
  25: 'HWY 202 m.p. 41.3, Birkenfeld',
  26: 'HWY 202 (5.65 mi), Clatskanie',
  31: 'Coastline Christian Fellowship Church',
  34: 'Lewis & Clark Mainline (Fort Clatsop Rd)',
  35: 'Lewis & Clark Mainline (86645 Lewis & Clark Rd)',
}

/** Exchange N's name as written at the top of leg N+1's directions ("0.00 Exchange N (name)"), joining wrapped lines. */
function nameFromNextLeg(n) {
  const next = ex[n + 1]
  if (!next || !next.runnerDirections) return ''
  const joined = next.runnerDirections.slice(0, 4).join(' ')
  const m = new RegExp(`Exchange\\s+${n}\\s*\\(([^)]{1,80})\\)`).exec(joined)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}

const problems = []
const legs = SHEET_LEGS.map(([n, miles, gain, loss, net, difficulty, notes]) => {
  const e = ex[n] ?? {}
  const major = MAJOR_EXCHANGES.includes(n)
  let exchangeName = NAME_FALLBACK[n] || nameFromNextLeg(n) || e.exchangeName || (e.address || '').split(',')[0].replace(/^\(approx\.\)\s*/i, '').trim().slice(0, 48)
  if (n === 36) exchangeName = 'FINISH — Seaside beach (Broadway turnaround)'
  const WALK_OVERRIDE = { 29: 20 }   // official note: HIGH CONGESTION, parking ~½ mile from the exchange
  const walk = WALK_OVERRIDE[n] ?? (n === 36 ? 25 : (n >= 31 ? 20 : major ? 15 : 10))
  const leg = {
    n, miles, gain, loss, net, difficulty, notes,
    majorExchange: major,
    exchangeName,
    address: e.address || '',
    lat: e.lat ?? null, lng: e.lng ?? null,
    vanSupport: e.vanSupport || 'yes',
    vanNote: e.notes || '',
    vanRouteNote: (e.exchangeNotes || []).join(' ').replace(/\s+/g, ' ').trim(),
    driveMinDefault: Math.ceil((miles / 25) * 60) + 5,
    walkMinDefault: walk,
    ...(n === 1 ? { leaveNow: true } : {}),
    pdfUrl: pdfUrl[n] || '',
    videoId: (videos.find(v => v.leg === n) || {}).videoId || '',
    description: e.description || '',
    officialDifficulty: e.officialDifficulty || '',
    namedAfter: e.namedAfter || '',
    runnerDirections: e.runnerDirections || [],
    vanDirections: e.vanDirections || [],
    exchangeNotes: e.exchangeNotes || [],
    ...(OVERRIDES[n] || {}),
  }
  if (!leg.pdfUrl) problems.push(`leg ${n}: no PDF url`)
  if (!leg.videoId) problems.push(`leg ${n}: no video id`)
  if (leg.lat === null || leg.lng === null) problems.push(`leg ${n}: no GPS`)
  else if (leg.lat < 45.0 || leg.lat > 46.3 || leg.lng < -124.1 || leg.lng > -121.6) problems.push(`leg ${n}: GPS out of bounds ${leg.lat},${leg.lng}`)
  if (!leg.address) problems.push(`leg ${n}: no address`)
  if (e.officialMiles != null && Math.abs(e.officialMiles - miles) > 0.06) problems.push(`leg ${n}: official ${e.officialMiles} mi vs sheet ${miles} mi`)
  return leg
})

// westward progression (allow small eastward wiggles) and duplicate pins
for (let i = 1; i < legs.length; i++) {
  const a = legs[i - 1], b = legs[i]
  if (a.lng !== null && b.lng !== null) {
    if (b.lng > a.lng + 0.12) problems.push(`leg ${b.n}: not progressing west (${a.lng} → ${b.lng})`)
    if (Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5) problems.push(`leg ${b.n}: duplicate pin of leg ${a.n}`)
  }
}

fs.mkdirSync('src/data', { recursive: true })
fs.writeFileSync('src/data/legs.json', JSON.stringify(legs, null, 1) + '\n')
console.log(`wrote src/data/legs.json (${legs.length} legs)`)
console.log(problems.length ? 'PROBLEMS:\n - ' + problems.join('\n - ') : 'validation: all checks passed')
for (const l of legs) console.log(`${String(l.n).padStart(2)} ${l.vanSupport.padEnd(10)} ${l.exchangeName}`)
