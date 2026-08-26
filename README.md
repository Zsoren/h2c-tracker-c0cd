# Hood to Coast 2026 — team tracker

Offline-first website for a 9-runner, one-van Hood to Coast team: who's running, when the van must leave, projected finish, per-leg info from the official maps, and an append-only shared log that syncs when there's signal.

- **Live:** https://h2c.zanesorenson.com/ (custom domain on GitHub Pages; deploys from `main` via GitHub Actions; the old https://zsoren.github.io/h2c-tracker-c0cd/ redirects here)
- **Plan / design:** the council-reviewed plan (v5) — see `docs/STATUS.md` for current status and `docs/ZANE-SETUP.md` for the owner's setup steps.

## Develop

```sh
npm install
npm run dev          # local dev server
npm test             # engine + share-link tests (vitest)
npm run build        # type-check + production build (PWA)
```

Verification harnesses (Playwright, headless Chromium):

```sh
node scripts/shot.mjs <outDir> all      # screenshots + "NOW never scrolls" checks at 375×553 / 375×667 / 390×844
node scripts/offline-test.mjs           # service worker: load offline, log handoffs, relaunch, verify persistence
VITE_SYNC_FAKE=1 npx vite build --outDir dist-fake && node scripts/sync-test.mjs   # two-tab sync via BroadcastChannel
node scripts/axe-check.mjs              # contrast audit (AA + AAA rules)
node scripts/live-check.mjs             # smoke test against the deployed site
```

## Data

- `src/data/team.json` — runners, paces, leg assignments, planned start (from the team sheet).
- `src/data/legs.json` — built by `node scripts/build-legs.mjs <course-maps.html> <videos.json> <exchanges.json>` from `scripts/sheet-legs.mjs` (sheet transcription), the official course-maps page (PDF + video links) and `scripts/extract-exchanges.mjs` output (exchange address/GPS/van rules/directions from the official leg PDFs).

## Sync (optional)

Set repository variable `VITE_TEAM_ID` (≥20 random chars) and repository secret `VITE_FIREBASE_CONFIG` (the Firebase web config object); publish `firebase/firestore.rules` in the Firebase console. Without them the site runs in single-phone mode with copy/paste plan links.

## Architecture (short)

- `src/model/` — pure engine: event log reducer (`events.ts`), projection (`projection.ts`), handoff-sheet rules (`sheet.ts`), time helpers.
- `src/state/` — store (localStorage is the only local source of truth), router, share links.
- `src/sync/` — Firestore outbox/snapshot transport (memory cache only; localStorage stays the source of truth); dev BroadcastChannel transport.
- `src/screens/`, `src/components/` — NOW, Schedule, Leg detail, Runners, Info; handoff / expected-time / change-runner / drop-runner sheets.
