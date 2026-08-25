# Zane — Tuesday evening (about 20 minutes)

## 1. Supabase (10 min) — this powers "everyone's phone updates"

1. Go to https://supabase.com/dashboard → **New project**.
   - Name: `h2c-tracker` · Region: **West US (Oregon)** · any database password (you won't need it again).
   - Wait ~2 minutes for it to finish provisioning.
2. Left sidebar → **SQL Editor** → **New query** → paste the entire contents of `supabase/schema.sql` from this project (or the copy I send you) → **Run**. It should say "Success. No rows returned."
3. Left sidebar → **Project Settings** (gear) → **API**.
   - Copy **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - Copy the **anon public** key (long string starting with `eyJ…`)
4. Paste both to me in chat. I'll plug them into the site and redeploy. (The anon key is designed to be public; the database rules only allow adding rows to our team's log — nothing can be edited or deleted.)

## 2. Phone check (5 min)

1. On your phone, open **https://zsoren.github.io/h2c-tracker-c0cd/** in Safari (iPhone) or Chrome (Android).
2. Pick your name when it asks. Tap around: NOW, Schedule, a leg, Runners, Info.
3. Try **START RACE** → confirm → then **UNDO** on the toast. (It's all local on your phone; nothing is shared yet.)
4. Send me a screenshot of the NOW screen and tell me anything that looks off, is too small, or is confusing.

## 3. Exchange pin spot-check (3 min)

Schedule → tap **Leg 6** → **Open in Maps** — should land at Sandy High School.
Same for **Leg 12** (OMSI gravel lot, Portland) and **Leg 30** (HWY 202 near Astoria).
If any pin is obviously wrong, tell me which.

## 4. One question

The sheet lists "Gene Kevin Sicat" with the initial **K** — I'm showing him as **Kevin** in the app. Correct, or should it be Gene?
