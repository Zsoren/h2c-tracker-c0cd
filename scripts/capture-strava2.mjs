import fs from 'node:fs'
import { chromium } from 'playwright'
const [url, outDir] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
let i = 0
page.on('response', async r => {
  try {
    const u = r.url(), ct = r.headers()['content-type'] || ''
    const buf = await r.body().catch(() => null)
    if (!buf || buf.length < 200) return
    const name = `${String(i++).padStart(2, '0')}-${buf.length}`
    console.log(name, ct.slice(0, 30), u.slice(0, 110))
    if (!/image|font|css/.test(ct)) fs.writeFileSync(`${outDir}/${name}.bin`, buf)
  } catch { /* ignore */ }
})
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(5000)
// also dump any window-level route data
const inline = await page.evaluate(() => { const s = document.querySelector('#__NEXT_DATA__'); return s ? s.textContent.slice(0, 200000) : '' })
fs.writeFileSync(`${outDir}/next-data.json`, inline)
console.log('__NEXT_DATA__ length', inline.length)
await browser.close()
