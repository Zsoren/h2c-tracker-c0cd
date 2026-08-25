# Zane — setup steps (about 25 minutes total)

Nothing here needs to be pasted into chat. The one value that matters (the Firebase config) goes straight into GitHub through the website.

## A. Firebase (10 min) — powers "everyone's phone updates"

1. Go to https://console.firebase.google.com → **Create a project** (or "Add project").
   - Name: `h2c-tracker`. Turn **off** Google Analytics. Create.
2. Left menu → **Build → Firestore Database** → **Create database**.
   - Location: **us-west1 (Oregon)** (or nam5 if that's what it offers).
   - Choose **Start in production mode**. Create.
3. In Firestore, open the **Rules** tab. Delete everything there, paste the entire contents of `firebase/firestore.rules` from the project, click **Publish**.
4. Click the **gear (Project settings)** → **General** → scroll to **Your apps** → click the **`</>`** (Web) icon.
   - Nickname: `h2c`. Leave "Firebase Hosting" unchecked. **Register app.**
   - It shows a code block containing `const firebaseConfig = { apiKey: "...", authDomain: "...", ... };`
   - **Copy that whole block** (the copy button is fine). Don't paste it anywhere yet.

## B. Put the config into GitHub (2 min) — instead of sending it to me

1. Open https://github.com/Zsoren/h2c-tracker-c0cd/settings/secrets/actions
2. **New repository secret** → Name: `VITE_FIREBASE_CONFIG` → Secret: paste the block you copied (the whole `const firebaseConfig = {...};` is fine, or just the `{...}` part) → **Add secret**.
3. Tell me "Firebase secret added" — I'll trigger a rebuild. (The site reads it during the build; it never appears in this chat or a terminal. This config is the kind of key that ships inside the website anyway; the Firestore rules you published are what protect the data.)

## C. DNS for your subdomain (5 min)

1. Decide the hostname, e.g. `h2c.yourdomain.com` (tell me which).
2. At your domain's DNS provider, add a record:
   - Type: **CNAME**
   - Name/Host: **h2c** (just the subdomain part)
   - Value/Target: **zsoren.github.io** (some providers want a trailing dot: `zsoren.github.io.`)
   - TTL: default.
3. Tell me the hostname once it's added. I'll then switch GitHub Pages to it and wait for the HTTPS certificate (usually minutes, can be up to an hour). **Until I do that step, keep using https://zsoren.github.io/h2c-tracker-c0cd/** — it works today.

## D. Phone check (5 min) — can be done right now with the github.io link

1. Open the site in Safari (iPhone) or Chrome (Android). Pick your name when asked.
2. Tap around: NOW, Schedule, a leg, Runners, Info. Try **START RACE** → confirm → **UNDO**.
3. Schedule → **Leg 6 → Open in Maps** (should be Sandy High School); same for **Leg 12** (OMSI gravel lot) and **Leg 30** (HWY 202 near Astoria).
4. Send me a screenshot of NOW and anything that looks off or confusing.
