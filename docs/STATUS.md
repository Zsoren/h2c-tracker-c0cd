# Build status

Live site: **https://h2c.zanesorenson.com/** (custom domain, HTTPS enforced; deploys automatically from `main`; the old github.io URL redirects)
Plan: `C:\Users\Zane\.claude\plans\i-am-running-hood-synthetic-scroll.md` (council-approved v5)

## Done (Mon Aug 24, night)
- Data: 9 runners + 36 legs from the sheet; official PDF + video links for all 36 legs; exchange name/address/GPS/van rules/directions extracted from the official PDFs (36/36 pins validated: in Oregon, progressing west, no duplicates; official mileages match the sheet).
- Engine: event log + reducer (correction-vs-conflict, captain wins, undo, order-independent) and projection (flat = sheet's 31:54:18 to the second; hills toggle; per-leg expected time; skipped-leg estimation; gear tags; LEAVE BY). 24 automated tests pass.
- Screens: NOW (9-row fixed layout, verified no-scroll at 375×553 / 375×667 / 390×844), SCHEDULE, LEG DETAIL, RUNNERS (pace edit, drop runner), INFO (setup, essentials, share/paste link, settings, captain switch, reset, debug).
- LOG HANDOFF sheet: leg chips, "Who just finished?" when stale, any time, chips, skipped-leg estimates + plausibility, same-runner-continues, restating CONFIRM, 10-s UNDO, re-log warning.
- Expected-time sheet (ETA chips / duration; effect line), change-runner sheet (back-to-back warning), driver picker, conflict note with "use X instead".
- Offline: service worker precaches everything; verified with a headless "airplane mode" test (loads offline, logs persist across relaunch). "Ready offline" chip, iOS install banner, first-run "Which runner are you?".
- Contrast: axe audit (AA + AAA rules) passes on NOW, handoff sheet, Schedule, Leg detail, Runners, Info. Live-site smoke test passes (SW scope, manifest, offline reload).
- Sync: Firestore transport (Tue Aug 25 — Supabase project limit hit, switched to the council-approved Firestore design): append-only rules, memory cache only, serverTs cursor, snapshot listener, re-subscribe on foreground/online; dev transport verified between two tabs. Activates when `VITE_TEAM_ID` (variable) and `VITE_FIREBASE_CONFIG` (secret) exist.

## Thu Aug 27 (race eve) — review round applied, CODE FREEZE
- Round 4 (Thu ~10 AM): LEAVE row is one statement (LEAVE by 10:07 AM · in 13 min → LEAVE NOW · latest 10:07 AM → LATE · should have left 10:07 AM · 9 min ago); leg-page buttons renamed "Adjust estimate" / "Log actual handoff" with a one-line explainer; van-support sentence removed from Info; shared log reset again via a new team id.
- Later Thu: Zane's round 3 — HQ number (503) 292-4626 under Emergency; van-support framing removed (only real driving rules remain); "Open NOW" removed; hills on by default with the ahead/behind baseline = the plan itself (pre-race always "on plan"); NOW re-laid out per a second three-reviewer pass: running card + one up-next card (LEAVE, NEXT), On deck cut, You + Team finish as quiet lines at the bottom, amber only on the button (LEAVE urgency = amber text + ring), reminders trimmed to driver-relevant ones. Test starts from the phone were undone again.
- Zane's phone-check round 2 applied; shared log reset via a new team id (all phones start clean).
- Three-reviewer UI/UX pass (UX expert, UI expert, relay runner; all "ready"): all P0+P1 items from `docs/UX-REVIEW-PLAN.md` implemented and deployed — pre-race guard, captain-only race settings, LEAVE row states + Maps link, short-leg LEAVE NOW, next-runner warnings, Exch 18/Seaside copy, stale-log copy, pace CTA only on your row, suggestion chip, Recent changes moved up, offline hint, drop-runner spread, copy nits, Tonight card, visual consistency. P2: the small/safe items done the same evening (chip position, first-run backdrop, chip order, re-log now, effect line, directions cleanup, done-leg times); the rest dropped as not worth it for a one-day race.

## Tue Aug 25 — phone-check feedback applied
- Tabs: Home · Now · Schedule · Info. Home = roster (Des/Alex/Bre short names, legs, miles, tap-to-edit pace) + start/finish/total; runner detail page replaces the Runners tab. Driver removed. Captain switch only for "Zane". Adjust sheet: leg time + pace side by side. NOW leads with LEG N → Exch N · name. Leg pages: Starts at / Ends at with map links. Big deltas as "2d 7h". Test-race entries from the phone check undone in the shared log.

## Wed Aug 26
- First-run now asks for the runner's planned flat pace after the name; the captain's estimates stay hidden ("Set pace") until a runner enters theirs.
- Per-leg GPX (36 files, from the official H2C Strava route, cut at the exchange pins; every leg within ±6% of official mileage) — "GPX ⬇" button on each leg page, works offline.

## Tuesday
- Zane: `docs/ZANE-SETUP.md` (Firebase project + rules; add config as a GitHub secret himself; DNS CNAME; phone check; 3-pin spot check). Kevin confirmed.
- Custom domain live Tue Aug 25 (h2c.zanesorenson.com; Cloudflare proxy had to be set to DNS-only; repo var BASE_PATH=/).
- Sync LIVE Tue Aug 25 evening: Firebase secret added by Zane; real two-browser test on h2c.zanesorenson.com — change visible on the other phone in ~2 s, status "Synced". (Console snippet parser fixed on the way.)
- Me: polish from Zane's screenshot; Wed evening airplane-mode + conflict test with Zane.

## Wednesday evening
- Airplane-mode + two-phone sync test with Zane (incl. deliberate conflict with captain on). Go/no-go on sync.

## Thursday
- Buffer; code freeze Thu evening. Team opens the site at home with signal.
