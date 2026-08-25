# Build status

Live site: https://zsoren.github.io/h2c-tracker-c0cd/ (deploys automatically from `main` via GitHub Actions)
Plan: `C:\Users\Zane\.claude\plans\i-am-running-hood-synthetic-scroll.md` (council-approved v5)

## Done (Mon Aug 24, night)
- Data: 9 runners + 36 legs from the sheet; official PDF + video links for all 36 legs; exchange name/address/GPS/van rules/directions extracted from the official PDFs (36/36 pins validated: in Oregon, progressing west, no duplicates; official mileages match the sheet).
- Engine: event log + reducer (correction-vs-conflict, captain wins, undo, order-independent) and projection (flat = sheet's 31:54:18 to the second; hills toggle; per-leg expected time; skipped-leg estimation; gear tags; LEAVE BY). 24 automated tests pass.
- Screens: NOW (9-row fixed layout, verified no-scroll at 375×553 / 375×667 / 390×844), SCHEDULE, LEG DETAIL, RUNNERS (pace edit, drop runner), INFO (setup, essentials, share/paste link, settings, captain switch, reset, debug).
- LOG HANDOFF sheet: leg chips, "Who just finished?" when stale, any time, chips, skipped-leg estimates + plausibility, same-runner-continues, restating CONFIRM, 10-s UNDO, re-log warning.
- Expected-time sheet (ETA chips / duration; effect line), change-runner sheet (back-to-back warning), driver picker, conflict note with "use X instead".
- Offline: service worker precaches everything; verified with a headless "airplane mode" test (loads offline, logs persist across relaunch). "Ready offline" chip, iOS install banner, first-run "Which runner are you?".
- Contrast: axe audit (AA + AAA rules) passes on NOW, handoff sheet, Schedule, Leg detail, Runners, Info. Live-site smoke test passes (SW scope, manifest, offline reload).
- Sync: Supabase transport written (append-only upsert, server-time cursor, realtime, re-fetch on foreground/online); dev transport verified between two tabs. Activates when the three repo variables exist.

## Tuesday
- Zane: `docs/ZANE-TUESDAY.md` (Supabase project + SQL + keys; phone check; 3-pin spot check; "Kevin?" question).
- Me: set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` repo variables → redeploy → real two-phone sync test; incoming-change toast; contrast audit; README; polish from Zane's screenshot.

## Wednesday evening
- Airplane-mode + two-phone sync test with Zane (incl. deliberate conflict with captain on). Go/no-go on sync.

## Thursday
- Buffer; code freeze Thu evening. Team opens the site at home with signal.
