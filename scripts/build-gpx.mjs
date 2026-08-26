// Build per-leg GPX files from the full-course route embedded in the H2C Strava route page,
// cut at the official exchange GPS pins from legs.json.
// Usage: node scripts/build-gpx.mjs <strava-embed.html> [src/data/legs.json] [public/gpx]
import fs from 'node:fs'
import path from 'node:path'

const [htmlPath, legsPath = 'src/data/legs.json', outDir = 'public/gpx'] = process.argv.slice(2)
const html = fs.readFileSync(htmlPath, 'utf8')
const legs = JSON.parse(fs.readFileSync(legsPath, 'utf8'))

// 1. route points in document order: every "coordinates":[[lng,lat,ele],...] array (route segments, in order)
const pts = []
for (const m of html.matchAll(/\\?"coordinates\\?":\s*\[(\[[^\]]*\](?:\s*,\s*\[[^\]]*\])*)\]/g)) {
  for (const t of m[1].matchAll(/\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?))?\s*\]/g)) {
    const lng = +t[1], lat = +t[2], ele = t[3] != null ? +t[3] : null
    if (lat > 44 && lat < 47 && lng > -125 && lng < -121) pts.push([lat, lng, ele])
  }
}
// drop exact consecutive duplicates (segment joins repeat the shared point)
const route = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1])

const R = 3958.8
const dist = (a, b) => {
  const dl = ((b[0] - a[0]) * Math.PI) / 180, dg = ((b[1] - a[1]) * Math.PI) / 180
  const x = Math.sin(dl / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dg / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
let total = 0
for (let i = 1; i < route.length; i++) total += dist(route[i - 1], route[i])
console.log(`route: ${route.length} points, ${total.toFixed(1)} mi, start ${route[0]}, end ${route[route.length - 1]}`)

// 2. cut indices: nearest route point to each exchange pin, searched forward from the previous cut
const cuts = [0]
let from = 0
const report = []
for (const leg of legs) {
  if (leg.lat == null) { cuts.push(null); continue }
  let best = -1, bestD = Infinity
  for (let i = from; i < route.length; i++) {
    const d = dist(route[i], [leg.lat, leg.lng])
    if (d < bestD) { bestD = d; best = i }
  }
  if (leg.n === 36) best = route.length - 1
  cuts.push(best)
  from = best
  report.push({ n: leg.n, idx: best, offMi: bestD })
}

// 3. write GPX per leg
fs.mkdirSync(outDir, { recursive: true })
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const problems = []
for (const leg of legs) {
  const a = cuts[leg.n - 1], b = cuts[leg.n]
  if (a == null || b == null || b <= a) { problems.push(`leg ${leg.n}: no cut (${a} → ${b})`); continue }
  const seg = route.slice(a, b + 1)
  let d = 0
  for (let i = 1; i < seg.length; i++) d += dist(seg[i - 1], seg[i])
  const startName = leg.n === 1 ? 'Timberline Lodge (start)' : `Exchange ${leg.n - 1} — ${legs[leg.n - 2].exchangeName}`
  const endName = `Exchange ${leg.n} — ${leg.exchangeName}`
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="h2c-tracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(`Hood to Coast 2026 — Leg ${leg.n} (${leg.miles} mi)`)}</name><desc>${esc(`Derived from the official Hood to Coast Strava route (simplified, ${seg.length} points, ~${d.toFixed(2)} mi). Verify against the official leg map PDF.`)}</desc></metadata>
  <wpt lat="${seg[0][0]}" lon="${seg[0][1]}"><name>${esc(startName)}</name></wpt>
  <wpt lat="${seg[seg.length - 1][0]}" lon="${seg[seg.length - 1][1]}"><name>${esc(endName)}</name></wpt>
  <trk><name>${esc(`HTC Leg ${leg.n}`)}</name><trkseg>
${seg.map(p => `    <trkpt lat="${p[0]}" lon="${p[1]}">${p[2] != null ? `<ele>${p[2].toFixed(1)}</ele>` : ''}</trkpt>`).join('\n')}
  </trkseg></trk>
</gpx>
`
  fs.writeFileSync(path.join(outDir, `leg-${leg.n}.gpx`), gpx)
  const off = report.find(r => r.n === leg.n)?.offMi ?? 0
  const pct = ((d - leg.miles) / leg.miles) * 100
  console.log(`leg ${String(leg.n).padStart(2)}: ${seg.length.toString().padStart(4)} pts, track ${d.toFixed(2)} mi vs official ${leg.miles} (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%), pin→route ${(off * 5280).toFixed(0)} ft`)
  if (Math.abs(pct) > 15) problems.push(`leg ${leg.n}: track length off by ${pct.toFixed(0)}%`)
  if (off > 0.25) problems.push(`leg ${leg.n}: exchange pin is ${off.toFixed(2)} mi from the route`)
}
console.log(problems.length ? 'PROBLEMS:\n - ' + problems.join('\n - ') : 'all legs within tolerance')
