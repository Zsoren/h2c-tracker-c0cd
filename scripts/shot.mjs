// Screenshot + layout checks with Playwright against the built app (dist/, base '/').
// Usage: node scripts/shot.mjs <outDir> [scenario]   scenarios: all | pre | racing | stale
import fs from 'node:fs'
import path from 'node:path'
import { preview } from 'vite'
import { chromium } from 'playwright'
import { SHEET_LEGS } from './sheet-legs.mjs'

const outDir = process.argv[2] || 'shots'
const scenario = process.argv[3] || 'all'
fs.mkdirSync(outDir, { recursive: true })

const PACE = { D: 600, W: 480, N: 540, B: 600, J: 480, Z: 600, A: 720, K: 600, Je: 660 }
const ORDER = ['D', 'W', 'N', 'B', 'J', 'Z', 'A', 'K', 'Je']
const START = Date.parse('2026-08-28T03:35:00-07:00')
function planEnd(n) {
  let t = START
  for (let i = 0; i < n; i++) { const l = SHEET_LEGS[i]; t += Math.round(l[1] * PACE[ORDER[i % 9]]) * 1000 }
  return t
}
const ev = (type, payload, ts, extra = {}) => ({ id: 'seed-' + type + '-' + (payload.leg ?? payload.runnerId ?? '') + '-' + ts, v: 1, ts, seenTs: 0, deviceId: 'seed', role: 'member', type, payload, ...extra })

const server = await preview({ preview: { port: 4173, strictPort: true }, logLevel: 'silent' })
const url = 'http://localhost:4173/'
const browser = await chromium.launch()
const results = []

async function run(name, { viewport, events = [], timeOffsetMs = 0, settings = {}, steps = async () => {} }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/Los_Angeles' })
  const page = await ctx.newPage()
  page.on('pageerror', e => results.push(`[${name}] PAGE ERROR: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') results.push(`[${name}] console.error: ${m.text()}`) })
  await page.goto(url)
  await page.evaluate(({ events, settings }) => {
    localStorage.clear()
    localStorage.setItem('h2c:events:v1', JSON.stringify(events))
    localStorage.setItem('h2c:settings:v1', JSON.stringify({ deviceId: 'shot-device', iAmRunnerId: 'Z', isCaptain: true, iAmPrompted: true, bannerDismissed: true, ...settings }))
  }, { events, settings: { ...settings, timeOffsetMs } })
  await page.goto(url + '?r=' + Date.now() + '#/now')   // full navigation so the store re-reads storage
  await page.waitForSelector('.now')
  await page.waitForTimeout(300)
  if (await page.$('.sheet')) await page.click('.sheet .cancel')
  try { await steps(page, name) } catch (e) { results.push(`[${name}] STEP FAILED: ${String(e.message).split('\n')[0]}`); await page.screenshot({ path: path.join(outDir, name + '-FAILED.png') }) }
  await ctx.close()
}

async function shot(page, name) {
  await page.waitForTimeout(150)
  await page.screenshot({ path: path.join(outDir, name + '.png') })
}
async function checkNoScroll(page, name) {
  const m = await page.evaluate(() => {
    const n = document.querySelector('.now')
    return { nowScroll: n.scrollHeight, nowClient: n.clientHeight, docScroll: document.documentElement.scrollHeight, inner: window.innerHeight, overflowing: [...n.children].filter(c => c.getBoundingClientRect().bottom > n.getBoundingClientRect().bottom + 1).map(c => c.className) }
  })
  const ok = m.nowScroll <= m.nowClient + 1 && m.overflowing.length === 0
  results.push(`[${name}] NOW ${ok ? 'fits' : 'OVERFLOWS'}: scroll ${m.nowScroll} / client ${m.nowClient}, doc ${m.docScroll} / inner ${m.inner}${m.overflowing.length ? ' overflow: ' + m.overflowing.join(',') : ''}`)
}

const SE_TAB = { width: 375, height: 553 }   // iPhone SE in Safari with bars
const SE = { width: 375, height: 667 }
const P14 = { width: 390, height: 844 }
const offsetTo = t => t - Date.now()

if (scenario === 'all' || scenario === 'pre') {
  for (const [vp, tag] of [[SE_TAB, 'se-tab'], [P14, '14']]) {
    await run('pre-' + tag, { viewport: vp, timeOffsetMs: offsetTo(START - 65 * 60000), steps: async (page, name) => { await shot(page, name); await checkNoScroll(page, name) } })
  }
}
if (scenario === 'all' || scenario === 'racing') {
  const t14 = planEnd(13) + 20 * 60000   // 20 min into leg 14, started 4 min late
  const events = [ev('handoff_logged', { leg: 0, at: START }, START)]
  for (let n = 1; n <= 13; n++) events.push(ev('handoff_logged', { leg: n, at: planEnd(n) + 4 * 60000 }, planEnd(n) + 4 * 60000))
  for (const [vp, tag] of [[SE_TAB, 'se-tab'], [SE, 'se'], [P14, '14']]) {
    await run('racing-' + tag, { viewport: vp, events, timeOffsetMs: offsetTo(t14), steps: async (page, name) => {
      await shot(page, name); await checkNoScroll(page, name)
      if (tag === '14') {
        await page.click('.bigbtn'); await page.waitForSelector('.sheet'); await shot(page, 'sheet-handoff-' + tag)
        await page.click('.sheet .cancel')
        await page.click('.running .eta'); await page.waitForSelector('.sheet'); await shot(page, 'sheet-expect-' + tag)
        await page.click('.sheet .cancel')
        await page.goto(url + '#/schedule'); await page.waitForSelector('.list'); await shot(page, 'schedule-' + tag)
        await page.goto(url + '#/leg/14'); await page.waitForSelector('.page'); await shot(page, 'leg14-' + tag)
        await page.goto(url + '#/home'); await page.waitForSelector('.list'); await shot(page, 'home-' + tag)
        await page.goto(url + '#/runner/Z'); await page.waitForSelector('.list'); await shot(page, 'runner-' + tag)
        await page.goto(url + '#/info'); await page.waitForSelector('.page'); await shot(page, 'info-' + tag)
      }
    } })
  }
}
if (scenario === 'all' || scenario === 'stale') {
  const t25 = planEnd(25) + 4 * 60000
  const events = [ev('handoff_logged', { leg: 0, at: START }, START), ev('handoff_logged', { leg: 25, at: t25 }, t25)]
  await run('stale-14', { viewport: P14, events, timeOffsetMs: offsetTo(t25 + 4 * 3600000 + 20 * 60000), steps: async (page, name) => {
    await shot(page, name)
    await page.click('.bigbtn'); await page.waitForSelector('.sheet'); await shot(page, 'sheet-stale-' + name)
    const disabled = await page.$eval('.sheet .confirm', b => b.disabled)
    results.push(`[${name}] stale sheet: confirm disabled = ${disabled}`)
    await page.click('.sheet .chip.name:has-text("Nicole")'); await shot(page, 'sheet-stale-picked-' + name)
    const title = await page.$eval('.sheet h2', h => h.textContent)
    results.push(`[${name}] after picking Nicole: "${title}"`)
  } })
}

await browser.close()
await server.close()
console.log(results.join('\n'))
