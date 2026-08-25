// Print parsed "pieces" (line fragments) for given legs, optionally filtered by a regex.
// Usage: node scripts/debug-pieces.mjs <pdfDir> <regex|-> <leg...>
import { pagePieces } from './extract-exchanges.mjs'
const [dir, pat, ...legs] = process.argv.slice(2)
const re = pat && pat !== '-' ? new RegExp(pat, 'i') : null
for (const n of legs.map(Number)) {
  const pieces = await pagePieces(`${dir}/leg-${n}.pdf`)
  console.log(`===== LEG ${n} (${pieces.length} pieces) =====`)
  for (const p of pieces) if (!re || re.test(p.text)) console.log(`y=${p.y.toFixed(0).padStart(4)} x=${p.x.toFixed(0).padStart(3)}-${p.xEnd.toFixed(0).padStart(3)} | ${JSON.stringify(p.text)}`)
}
