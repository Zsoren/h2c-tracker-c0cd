// Dump a leg PDF's text as lines (grouped by y), for parser design. Usage: node scripts/pdf-text.mjs <pdf>
import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function pdfLines(path) {
  const data = new Uint8Array(fs.readFileSync(path))
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
  const out = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: i.height || 0 }))
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x))
    let line = [], ly = null
    for (const it of items) {
      if (ly !== null && Math.abs(it.y - ly) > 3) { out.push(line); line = [] }
      line.push(it); ly = it.y
    }
    if (line.length) out.push(line)
  }
  return out.map(l => ({ y: l[0].y, text: l.map(i => i.s).join(' ').replace(/\s+/g, ' ').trim() }))
}

if (process.argv[1] && process.argv[1].endsWith('pdf-text.mjs')) {
  const lines = await pdfLines(process.argv[2])
  for (const l of lines) console.log(l.y.toFixed(0).padStart(4), '|', l.text)
}
