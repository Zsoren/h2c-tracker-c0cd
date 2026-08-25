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

## C. DNS for your subdomain — `h2c.zanesorenson.com`

1. ✅ CNAME `h2c` → `zsoren.github.io` is added (Aug 25).
2. **One more click (Cloudflare):** open the DNS page for zanesorenson.com in Cloudflare, find the `h2c` record, and click the **orange cloud** so it turns **grey ("DNS only")**. With the orange proxy on, GitHub can't verify the domain or issue the HTTPS certificate.
3. Nothing else to do — I'm watching DNS. The moment it shows GitHub's addresses I switch GitHub Pages to `h2c.zanesorenson.com`, rebuild, and turn on HTTPS once the certificate is issued (minutes to an hour). Until then **https://zsoren.github.io/h2c-tracker-c0cd/** keeps working; afterwards it redirects to the new address automatically.

## D. Phone check (5 min) — can be done right now with the github.io link

1. Open the site in Safari (iPhone) or Chrome (Android). Pick your name when asked.
2. Tap around: NOW, Schedule, a leg, Runners, Info. Try **START RACE** → confirm → **UNDO**.
3. Schedule → **Leg 6 → Open in Maps** (should be Sandy High School); same for **Leg 12** (OMSI gravel lot) and **Leg 30** (HWY 202 near Astoria).
4. Send me a screenshot of NOW and anything that looks off or confusing.
