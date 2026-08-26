// Load the Strava route embed in a browser and capture any response that looks like route geometry.
import fs from 'node:fs'
import { chromium } from 'playwright'
const [url, outPath] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage()
const bodies = []
page.on('response', async r => {
  try {
    const ct = r.headers()['content-type'] || ''
    const u = r.url()
    if (/json|javascript|text/.test(ct) && !/\.css/.test(u)) {
      const t = await r.text()
      if (/polyline|latlng|coordinates|"points"/i.test(t) && t.length > 500) bodies.push({ url: u.slice(0, 120), len: t.length, body: t })
    }
  } catch { /* ignore */ }
})
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(4000)
await browser.close()
bodies.sort((a, b) => b.len - a.len)
for (const b of bodies) console.log(b.len, b.url)
fs.writeFileSync(outPath, bodies.map(b => b.body).join('\n'))
console.log('captured', bodies.length, 'bodies →', outPath)
