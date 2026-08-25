// Smoke-test the deployed site: loads, service worker registers under the base path, offline reload works.
// Usage: node scripts/live-check.mjs [url]
import { chromium } from 'playwright'
const url = process.argv[2] || 'https://zsoren.github.io/h2c-tracker-c0cd/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
const page = await ctx.newPage()
const out = []
page.on('pageerror', e => out.push(`PAGE ERROR ${e.message}`))
page.on('console', m => { if (m.type() === 'error') out.push(`console.error ${m.text().slice(0, 160)}`) })
await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('.now', { timeout: 20000 })
out.push('NOW rendered')
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller != null, null, { timeout: 20000 }).catch(() => out.push('SW did not take control'))
const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? { scope: r.scope, active: !!r.active } : null })
out.push(`SW registration: ${JSON.stringify(reg)}`)
const mf = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); if (!l) return 'no manifest link'; const r = await fetch(l.href); const j = await r.json(); return `${j.name} · start_url=${j.start_url} · icons=${j.icons.length}` })
out.push(`manifest: ${mf}`)
await ctx.setOffline(true)
await page.reload({ waitUntil: 'load' }).catch(e => out.push(`offline reload failed: ${e.message}`))
out.push(`offline reload rendered NOW: ${(await page.$('.now')) != null}`)
await ctx.setOffline(false)
await page.screenshot({ path: 'C:/Users/Zane/AppData/Local/Temp/claude/C--Users-Zane-Desktop-h2c-app/201c4a01-dfb8-4ee4-9bd6-cd358f8b77b7/scratchpad/shots/live.png' })
await browser.close()
console.log(out.join('\n'))
