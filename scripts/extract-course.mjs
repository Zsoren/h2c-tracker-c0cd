// Extract the full-course polyline from the Strava route embed HTML (saved from strava-embeds.com/route/<id>).
// Usage: node scripts/extract-course.mjs <embed.html> <out-points.json>
import fs from 'node:fs'

const [htmlPath, outPath] = process.argv.slice(2)
const html = fs.readFileSync(htmlPath, 'utf8')

function decodePolyline(str) {
  let idx = 0, lat = 0, lng = 0
  const out = []
  while (idx < str.length) {
    let b, shift = 0, result = 0
    do { b = str.charCodeAt(idx++) - 63; result |= (b & 31) << shift; shift += 5 } while (b >= 32)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = str.charCodeAt(idx++) - 63; result |= (b & 31) << shift; shift += 5 } while (b >= 32)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    out.push([lat / 1e5, lng / 1e5])
  }
  return out
}
const R = 3958.8
export function distMi(a, b) {
  const dl = ((b[0] - a[0]) * Math.PI) / 180, dg = ((b[1] - a[1]) * Math.PI) / 180
  const x = Math.sin(dl / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dg / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// Candidate 1: long JSON string values (encoded polylines). Unescape JSON escapes.
const re = /"((?:[^"\\]|\\.){1500,})"/g
const cands = []
for (const m of html.matchAll(re)) {
  let s = m[1]
  try { s = JSON.parse('"' + s + '"') } catch { /* keep raw */ }
  cands.push(s)
}
console.log('long string candidates:', cands.length)
let best = null
for (const c of cands) {
  try {
    const pts = decodePolyline(c)
    if (pts.length < 100) continue
    if (!pts.every(p => p[0] > 44 && p[0] < 47 && p[1] > -125 && p[1] < -121)) continue
    let d = 0
    for (let i = 1; i < pts.length; i++) d += distMi(pts[i - 1], pts[i])
    console.log(`candidate: ${pts.length} pts, start ${pts[0]}, end ${pts[pts.length - 1]}, ${d.toFixed(1)} mi`)
    if (!best || pts.length > best.pts.length) best = { pts, d }
  } catch { /* not a polyline */ }
}
// Candidate 2: GeoJSON coordinate arrays [lng, lat]
const gj = [...html.matchAll(/"coordinates"\s*:\s*(\[\s*\[\s*-12\d\.\d+\s*,\s*4[56]\.\d+\s*\](?:\s*,\s*\[\s*-12\d\.\d+\s*,\s*4[56]\.\d+\s*\]){100,}\s*\])/g)]
for (const m of gj) {
  try {
    const arr = JSON.parse(m[1]).map(([lng, lat]) => [lat, lng])
    let d = 0
    for (let i = 1; i < arr.length; i++) d += distMi(arr[i - 1], arr[i])
    console.log(`geojson candidate: ${arr.length} pts, ${d.toFixed(1)} mi`)
    if (!best || arr.length > best.pts.length) best = { pts: arr, d }
  } catch { /* ignore */ }
}
if (best) {
  fs.writeFileSync(outPath, JSON.stringify(best.pts))
  console.log(`saved ${best.pts.length} points, ${best.d.toFixed(1)} mi → ${outPath}`)
} else {
  console.log('no route polyline found')
  const hits = [...html.matchAll(/polyline[^,]{0,200}/g)].slice(0, 5).map(m => m[0])
  console.log(hits.join('\n---\n'))
}
