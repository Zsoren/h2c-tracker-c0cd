// Two-tab sync test using the dev BroadcastChannel transport (build with VITE_SYNC_FAKE=1 → dist-fake/).
// Usage: node scripts/sync-test.mjs
import { preview } from 'vite'
import { chromium } from 'playwright'

const server = await preview({ build: { outDir: 'dist-fake' }, preview: { port: 4174, strictPort: true }, logLevel: 'silent' })
const url = 'http://localhost:4174/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
const out = []
const pageA = await ctx.newPage(), pageB = await ctx.newPage()
for (const [p, name] of [[pageA, 'A'], [pageB, 'B']]) {
  p.on('pageerror', e => out.push(`[${name}] PAGE ERROR ${e.message}`))
  await p.goto(url)
  await p.evaluate(({ name }) => { localStorage.clear(); localStorage.setItem('h2c:settings:v1', JSON.stringify({ deviceId: 'dev-' + name, iAmRunnerId: null, isCaptain: name === 'A', iAmPrompted: true, bannerDismissed: true, timeOffsetMs: 0 })) }, { name })
  await p.goto(url + '?r=' + name + '#/now')
  await p.waitForSelector('.now')
}
// Note: both tabs share one origin's localStorage in Playwright — that's fine for this transport test; each tab has its own in-memory store instance
// and only learns about the other's events via BroadcastChannel (the store reads storage only at load).
const statusA = await pageA.$eval('.status', s => s.textContent)
out.push(`A status: ${statusA}`)
await pageA.click('.bigbtn'); await pageA.waitForSelector('.sheet'); await pageA.click('.sheet .confirm')
await pageB.waitForTimeout(500)
const bTitle = await pageB.$eval('.running .label', s => s.textContent).catch(() => '(no running card)')
out.push(`B after A started race: ${bTitle}`)
const bBtn = await pageB.$eval('.bigbtn', s => s.textContent).catch(() => '(no button)')
out.push(`B button: ${bBtn}`)
const statusB = await pageB.$eval('.status', s => s.textContent)
out.push(`B status: ${statusB}`)
await browser.close(); await server.close()
console.log(out.join('\n'))
