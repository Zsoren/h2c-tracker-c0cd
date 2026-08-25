// Extract exchange data from the official HTC leg-map PDFs.
// Usage: node scripts/extract-exchanges.mjs <pdfDir> <out.json>
import fs from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function pagePieces(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
  const pieces = []
  const mk = arr => ({ x: arr[0].x, y: arr[0].y, xEnd: arr[arr.length - 1].x + arr[arr.length - 1].w, text: arr.map(i => i.s).join(' ').replace(/\s+/g, ' ').trim() })
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const items = tc.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5] - (p - 1) * 10000, w: i.width || 0 }))
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x))
    let line = []
    const flush = () => {
      if (!line.length) return
      line.sort((a, b) => a.x - b.x)
      let cur = [line[0]]
      for (let k = 1; k < line.length; k++) {
        const prev = cur[cur.length - 1]
        if (line[k].x - (prev.x + prev.w) > 25) { pieces.push(mk(cur)); cur = [] }
        cur.push(line[k])
      }
      pieces.push(mk(cur))
      line = []
    }
    let ly = null
    for (const it of items) {
      if (ly !== null && Math.abs(it.y - ly) > 3) flush()
      line.push(it); ly = it.y
    }
    flush()
  }
  return pieces
}

const LABEL_RE = /^(LEG DESCRIPTION|EXCH\s*\d+|GPS|NOTES|DIRECTIONS|EXCHANGE NOTES|Finish NOTES|Scan For|elevation|NET:|Named after|VAN\b|Van \d|driver notes)/i

/** Text after a label piece: same-line remainder (or the neighbouring piece) plus wrapped continuation lines. */
function labeled(pieces, labelRe) {
  const i = pieces.findIndex(p => labelRe.test(p.text))
  if (i < 0) return ''
  const lab = pieces[i]
  let text = lab.text.replace(labelRe, '').trim()
  let colX = lab.x
  if (!text) {
    const same = pieces.find(p => p !== lab && Math.abs(p.y - lab.y) <= 3 && p.x > lab.x && p.x - lab.xEnd < 220 && !LABEL_RE.test(p.text))
    if (same) { text = same.text; colX = same.x }
  }
  let y = lab.y
  for (let k = i + 1; k < pieces.length; k++) {
    const p = pieces[k]
    if (p.y >= lab.y - 1) continue
    if (y - p.y > 16) break
    if (LABEL_RE.test(p.text)) break
    if (Math.abs(p.x - colX) > 12 && Math.abs(p.x - lab.x) > 12) continue
    text += ' ' + p.text
    y = p.y
  }
  return text.replace(/\s+/g, ' ').trim()
}

function column(pieces, header, stopRe, maxLines = 40) {
  const hi = pieces.indexOf(header)
  const out = []
  for (let i = hi + 1; i < pieces.length && out.length < maxLines; i++) {
    const p = pieces[i]
    if (p.y >= header.y) continue
    if (Math.abs(p.x - header.x) > 45) continue
    if (stopRe.test(p.text)) break
    out.push(p.text)
  }
  return out
}

function dmsToDec(d, m, s, hemi) {
  const v = +d + +m / 60 + +s / 3600
  return /[SW]/i.test(hemi) ? -v : v
}

function parseGps(text) {
  let g = /(-?\d+\.\d+)\s*,?\s*(-?\d+\.\d+)/.exec(text)
  if (g) return { lat: +g[1], lng: +g[2] }
  const d = /(\d+)\D{1,3}(\d+)\D{1,3}([\d.]+)\D{1,3}([NS])\D{1,4}(\d+)\D{1,3}(\d+)\D{1,3}([\d.]+)\D{1,3}([EW])/.exec(text)
  if (d) return { lat: +dmsToDec(d[1], d[2], d[3], d[4]).toFixed(6), lng: +dmsToDec(d[5], d[6], d[7], d[8]).toFixed(6) }
  return null
}

export function parse(pieces, n) {
  const all = pieces.map(p => p.text).join('\n')
  const r = {}
  r.namedAfter = labeled(pieces, /^Named after:\s*/i)
  const vanPiece = pieces.find(p => /^VAN\s*[\d&\s]+$/i.test(p.text) || /^VAN\s*[\d&\s]+\s+[\d.]+\s*Mi/i.test(p.text))
  if (vanPiece) {
    r.vanLabel = (vanPiece.text.match(/VAN\s*([\d&\s]+?)(?:\s+[\d.]+\s*Mi|$)/i) || [])[1]?.replace(/\s/g, '')
    const sameLine = pieces.filter(p => Math.abs(p.y - vanPiece.y) <= 3).map(p => p.text).join(' ')
    const hm = /([\d.]+)\s*Mi\s*\|\s*([A-Za-z ]+)/i.exec(sameLine)
    if (hm) { r.officialMiles = +hm[1]; r.officialDifficulty = hm[2].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }
  }
  if (r.officialMiles == null) {
    const hm = /([\d.]+)\s*Mi\s*\|\s*([A-Za-z ]+)/i.exec(all)
    if (hm) { r.officialMiles = +hm[1]; r.officialDifficulty = hm[2].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }
  }
  r.description = labeled(pieces, /^LEG DESCRIPTION:\s*/i)
  r.address = labeled(pieces, /^EXCH\s*\d+[^:]*ADDRESS:\s*/i).replace(/\s+\d{1,2}$/, m => (+m.trim() === n ? '' : m)).trim()
  let gps = parseGps(labeled(pieces, /^GPS:\s*/i))
  if (!gps) {
    // fall back: any piece anywhere that looks like a coordinate pair
    for (const p of pieces) { gps = parseGps(p.text.replace(/^GPS:\s*/i, '')); if (gps && gps.lat > 44 && gps.lat < 47) break; gps = null }
  }
  if (gps) { r.lat = gps.lat; r.lng = gps.lng > 0 ? -gps.lng : gps.lng }
  r.notes = labeled(pieces, /^NOTES:\s*/i).replace(/^and\s+/i, '… ')
  const dirHdr = pieces.find(p => /DIRECTIONS FROM/i.test(p.text))
  r.directionsTitle = dirHdr ? dirHdr.text : ''
  r.runnerDirections = dirHdr
    ? column(pieces, dirHdr, /^(EXCHANGE NOTES|Finish NOTES|Scan For|elevation GAIN|Van \d.*directions|NET:|driver notes)/i)
    : pieces.filter(p => /^(→|←|↑|↓|\d+\.\d+\s)/.test(p.text)).map(p => p.text).slice(0, 25)
  const vanHdr = pieces.find(p => /^Van \d.*directions/i.test(p.text))
  r.vanDirectionsTitle = vanHdr ? vanHdr.text : ''
  r.vanDirections = vanHdr ? column(pieces, vanHdr, /^(EXCHANGE NOTES|Scan For|elevation GAIN|NET:)/i, 12) : []
  const exHdr = pieces.find(p => /^(EXCHANGE NOTES|Finish NOTES)/i.test(p.text))
  r.exchangeNotes = exHdr ? column(pieces, exHdr, /^(elevation GAIN|NET:|Scan For)/i) : []
  const ex = new RegExp(`Exchange\\s+${n}\\s*\\(([^)\\n]{1,80})`).exec(all)
  r.exchangeName = ex ? ex[1].replace(/\s+/g, ' ').trim() : ''
  const elev = /GAIN\/LOSS:?\s*(-?[\d,]+)\/(-?[\d,]+)\s*ft|(-?[\d,]+)\/(-?[\d,]+)\s*ft\s*elevation GAIN\/LOSS/.exec(all)
  if (elev) { r.officialGain = +(elev[1] ?? elev[3]).replace(/,/g, ''); r.officialLoss = +(elev[2] ?? elev[4]).replace(/,/g, '') }
  const up = [r.notes, r.description, ...r.exchangeNotes, ...r.vanDirections].join('\n').toUpperCase()
  r.vanSupport =
    /NOT ALLOWED TO STOP ON THIS LEG|NO VAN SUPPORT|VANS? (ARE )?NOT (ALLOWED|PERMITTED) ON THIS LEG|VANS DO NOT FOLLOW COURSE|NO ACCESS BY VANS|NEARLY NO ACCESS/.test(up) ? 'no'
    : /NOT ALLOWED TO STOP|LIMITED VAN|RESTRICT|NO STOPPING ON (LEFT|SHOULDER)|NO STOPPING WITHIN|ONLY VAN 2 WITH COLORED|COLORED SIGN/.test(up) ? 'restricted'
    : 'yes'
  return r
}

if (process.argv[1] && /extract-exchanges\.mjs$/.test(process.argv[1])) {
  const [dir, out] = process.argv.slice(2)
  const result = {}
  for (let n = 1; n <= 36; n++) {
    const f = path.join(dir, `leg-${n}.pdf`)
    try { result[n] = parse(await pagePieces(f), n) } catch (e) { result[n] = { error: String(e) } }
  }
  fs.writeFileSync(out, JSON.stringify(result, null, 1))
  for (let n = 1; n <= 36; n++) {
    const r = result[n]
    console.log(`${String(n).padStart(2)} | VAN ${r.vanLabel ?? '?'} ${r.officialMiles ?? '?'}mi ${r.officialDifficulty ?? ''} | ${r.exchangeName || '(no name)'} | ${r.lat ?? '?'},${r.lng ?? '?'} | van=${r.vanSupport} | dirs=${r.runnerDirections.length} exn=${r.exchangeNotes.length}`)
    console.log(`     ADDR: ${r.address || '?'}`)
    console.log(`     NOTES: ${r.notes || '(none)'}`)
  }
}
