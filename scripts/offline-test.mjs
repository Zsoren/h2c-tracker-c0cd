// Offline test: install the service worker, cut the network, reload, log a handoff, force a reload, verify persistence.
// Usage: node scripts/offline-test.mjs
import { preview } from 'vite'
import { chromium } from 'playwright'

const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'silent' })
const url = 'http://localhost:4175/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
const page = await ctx.newPage()
const out = []
page.on('pageerror', e => out.push(`PAGE ERROR ${e.message}`))

await page.goto(url)
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('h2c:settings:v1', JSON.stringify({ deviceId: 'offline-test', iAmRunnerId: 'Z', isCaptain: true, iAmPrompted: true, bannerDismissed: true, timeOffsetMs: 0 })) })
await page.goto(url + '?r=1#/now')
await page.waitForSelector('.now')
// wait for the service worker to control the page
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller != null, null, { timeout: 15000 }).catch(() => out.push('SW never took control'))
const sw = await page.evaluate(() => !!navigator.serviceWorker.controller)
out.push(`service worker controlling page: ${sw}`)

// go offline
await ctx.setOffline(true)
await page.reload({ waitUntil: 'load' }).catch(e => out.push(`offline reload failed: ${e.message}`))
const loadedOffline = await page.$('.now') != null
out.push(`app loaded while OFFLINE: ${loadedOffline}`)
const status1 = await page.$eval('.status', s => s.textContent).catch(() => '?')
out.push(`status offline: ${status1}`)

// log START RACE + a handoff while offline
await page.click('.bigbtn'); await page.waitForSelector('.sheet'); await page.click('.sheet .confirm')
await page.waitForTimeout(200)
await page.click('.bigbtn'); await page.waitForSelector('.sheet'); await page.click('.sheet .confirm')
await page.waitForTimeout(200)
const btn1 = await page.$eval('.bigbtn, .toast', s => s.textContent)
out.push(`after two logs offline: "${btn1.trim().slice(0, 40)}"`)

// "force close": navigate away and back, still offline
await page.goto('about:blank')
await page.goto(url + '?r=2#/now', { waitUntil: 'load' }).catch(e => out.push(`second offline load failed: ${e.message}`))
await page.waitForSelector('.now', { timeout: 10000 }).catch(() => out.push('NOW not rendered after offline relaunch'))
const running = await page.$eval('.running .label', s => s.textContent).catch(() => '(no running card)')
out.push(`after offline relaunch: ${running}`)
const events = await page.evaluate(() => JSON.parse(localStorage.getItem('h2c:events:v1') || '[]').length)
out.push(`events persisted: ${events}`)
await page.screenshot({ path: 'C:/Users/Zane/AppData/Local/Temp/claude/C--Users-Zane-Desktop-h2c-app/201c4a01-dfb8-4ee4-9bd6-cd358f8b77b7/scratchpad/shots/offline-relaunch.png' })

await ctx.setOffline(false)
await browser.close(); await server.close()
console.log(out.join('\n'))
