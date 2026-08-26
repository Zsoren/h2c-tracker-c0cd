// Contrast audit with axe-core (AA 4.5:1 + AAA 7:1 rules) across the main screens in a mid-race state.
// Usage: node scripts/axe-check.mjs
import fs from 'node:fs'
import { preview } from 'vite'
import { chromium } from 'playwright'
import { SHEET_LEGS } from './sheet-legs.mjs'

const PACE = { D: 600, W: 480, N: 540, B: 600, J: 480, Z: 600, A: 720, K: 600, Je: 660 }
const ORDER = ['D', 'W', 'N', 'B', 'J', 'Z', 'A', 'K', 'Je']
const START = Date.parse('2026-08-28T03:35:00-07:00')
function planEnd(n) { let t = START; for (let i = 0; i < n; i++) t += Math.round(SHEET_LEGS[i][1] * PACE[ORDER[i % 9]]) * 1000; return t }
const ev = (type, payload, ts) => ({ id: 'seed-' + type + '-' + (payload.leg ?? '') + '-' + ts, v: 1, ts, seenTs: 0, deviceId: 'seed', role: 'member', type, payload })
const events = [ev('handoff_logged', { leg: 0, at: START }, START)]
for (let n = 1; n <= 13; n++) events.push(ev('handoff_logged', { leg: n, at: planEnd(n) + 240000 }, planEnd(n) + 240000))
const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const server = await preview({ preview: { port: 4176, strictPort: true }, logLevel: 'silent' })
const url = 'http://localhost:4176/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
const page = await ctx.newPage()
await page.goto(url)
await page.evaluate(({ events, off }) => { localStorage.clear(); localStorage.setItem('h2c:events:v1', JSON.stringify(events)); localStorage.setItem('h2c:settings:v1', JSON.stringify({ deviceId: 'axe', iAmRunnerId: 'Z', isCaptain: true, iAmPrompted: true, bannerDismissed: true, timeOffsetMs: off, dismissedAlts: [] })) }, { events, off: planEnd(13) + 20 * 60000 - Date.now() })

const out = []
async function audit(name, path, prep) {
  await page.goto(url + '?r=' + name + path)
  await page.waitForSelector('.app')
  await page.waitForTimeout(300)
  if (await page.$('.sheet')) await page.click('.sheet .cancel').catch(() => {})
  if (prep) await prep()
  await page.addScriptTag({ content: axeSrc })
  const res = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast', 'color-contrast-enhanced'] } }))
  for (const v of res.violations) for (const n of v.nodes) {
    const d = n.any[0]?.data || {}
    out.push(`[${name}] ${v.id}: ${d.contrastRatio ?? '?'}:1 (need ${d.expectedContrastRatio ?? '?'}) fg ${d.fgColor} bg ${d.bgColor} — ${n.target[0]} — "${(n.html || '').replace(/\s+/g, ' ').slice(0, 90)}"`)
  }
  out.push(`[${name}] ${res.violations.length ? '' : 'no contrast violations'}`.trimEnd())
}
await audit('now', '#/now')
await audit('sheet', '#/now', async () => { await page.click('.bigbtn'); await page.waitForSelector('.sheet') })
await audit('schedule', '#/schedule')
await audit('leg14', '#/leg/14')
await audit('home', '#/home')
await audit('runner', '#/runner/Z')
await audit('info', '#/info')
await browser.close(); await server.close()
console.log(out.filter(Boolean).join('\n'))
