import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const legs = process.argv.slice(3).map(Number)
for (const n of legs) {
  const data = new Uint8Array(fs.readFileSync(`${process.argv[2]}/leg-${n}.pdf`))
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
  console.log(`\n===== LEG ${n} (pages ${doc.numPages}) =====`)
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), w: Math.round(i.width || 0) }))
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x))
    for (const it of items.slice(0, 34)) console.log(`p${p} y=${String(it.y).padStart(3)} x=${String(it.x).padStart(3)} w=${String(it.w).padStart(3)} | ${it.s}`)
  }
}
