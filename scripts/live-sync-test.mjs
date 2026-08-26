// Real two-phone sync test against the deployed site (Firestore). Leaves the shared log clean:
// phone A writes a note on Leg 36, phone B must see it, then A clears it.
// Usage: node scripts/live-sync-test.mjs [url]
import { chromium } from 'playwright'

const url = process.argv[2] || 'https://h2c.zanesorenson.com/'
const browser = await chromium.launch()
const out = []
const stamp = 'sync test ' + new Date().toISOString().slice(11, 19)

async function phone(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
  const page = await ctx.newPage()
  page.on('pageerror', e => out.push(`[${name}] PAGE ERROR ${e.message}`))
  await page.goto(url, { waitUntil: 'load' })
  await page.evaluate(n => localStorage.setItem('h2c:settings:v1', JSON.stringify({ deviceId: 'livetest-' + n, iAmRunnerId: null, isCaptain: false, iAmPrompted: true, bannerDismissed: true, timeOffsetMs: 0, dismissedAlts: [] })), name)
  await page.goto(url + '?r=' + name + '#/now', { waitUntil: 'load' })
  await page.waitForSelector('.now', { timeout: 20000 })
  return { ctx, page }
}
const status = p => p.$eval('.status', s => s.textContent).catch(() => '?')
const syncLog = p => p.evaluate(() => (window.__h2cSyncLog || []).slice(-6).join(' | '))

const A = await phone('A'), B = await phone('B')
// wait for sync to come up on both
for (const [n, p] of [['A', A.page], ['B', B.page]]) {
  await p.waitForFunction(() => /Synced|Syncing|Connecting|Offline/.test(document.querySelector('.status')?.textContent || ''), null, { timeout: 30000 }).catch(() => {})
  out.push(`[${n}] status: ${await status(p)}`)
}
out.push(`[A] sync log: ${await syncLog(A.page)}`)

// A writes a note on Leg 36
await A.page.goto(url + '?r=A#/leg/36', { waitUntil: 'load' })
await A.page.waitForSelector('.page')
await A.page.click('button:has-text("Edit")')
await A.page.fill('textarea.plain', stamp)
await A.page.click('button:has-text("Save")')
await A.page.waitForTimeout(500)
out.push(`[A] wrote note "${stamp}" · status: ${await status(A.page).catch(() => '(not on NOW)')}`)

// B must see it
await B.page.goto(url + '?r=B#/leg/36', { waitUntil: 'load' })
await B.page.waitForSelector('.page')
const seen = await B.page.waitForFunction(s => document.body.innerText.includes(s), stamp, { timeout: 25000 }).then(() => true).catch(() => false)
out.push(`[B] saw A's note within 25 s: ${seen}`)
out.push(`[B] sync log: ${await syncLog(B.page)}`)
if (!seen) out.push(`[A] sync log now: ${await syncLog(A.page)}`)

// A clears the note (leaves state as it was)
await A.page.click('button:has-text("Edit")')
await A.page.fill('textarea.plain', '')
await A.page.click('button:has-text("Save")')
await A.page.waitForTimeout(1500)
const cleared = await B.page.waitForFunction(s => !document.body.innerText.includes(s), stamp, { timeout: 25000 }).then(() => true).catch(() => false)
out.push(`[B] saw the note cleared: ${cleared}`)
await A.page.goto(url + '?r=A#/now', { waitUntil: 'load' }); await A.page.waitForSelector('.now')
out.push(`[A] final status: ${await status(A.page)}`)
await browser.close()
console.log(out.join('\n'))
