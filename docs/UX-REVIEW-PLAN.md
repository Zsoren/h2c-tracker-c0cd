# UI/UX review — proposed changes (Thu Aug 27, race in ~19 h)

Three independent reviewers looked at the live app and screenshots at three phone sizes, tapped through every flow on a sandboxed local copy, and read the code: a **UX expert**, a **UI/visual expert**, and an **experienced relay runner**. All three verdicts: *ready for tomorrow*; nothing needs rebuilding. Their findings overlap a lot, so below they're merged and deduplicated. Each item is small (**S = under 30 min**); everything in P0 + P1 is about **3 hours of work**, well inside today. Nothing here adds a backend or new data.

**Legend:** [UX] UX expert · [UI] UI expert · [RR] relay runner.

---

## P0 — do today (about 1.5 h) — guards against a bad race day

1. **Pre-race guard on the big button.** [UX] Tonight a curious teammate can tap START RACE at 7:50 PM (no warning) or pick any leg and log a phantom handoff — every phone flips to "racing." *Change:* before the race the sheet offers only "Start"; if the entered time is more than 2 h from the planned 3:35 AM, an amber line: "Planned start is Fri 3:35 AM (19 h away). Confirming tells every phone the race has begun." Warn, don't block.
2. **Captain-only race settings.** [UX] The planned-start time and the hills toggle under Info change on one tap with no confirm — shared to all phones. *Change:* show them only on the captain's phone.
3. **LEAVE row that never lies.** [UI][UX][RR] Three problems in one row: the word **LATE** gets cut off by the "…" at 375 px (leaving color-only, which we ruled out); the row is amber for 30–50 % of every leg (people will learn to ignore it); on short legs the leave-by time is before the leg even starts (Leg 32: leave 6:40 for a 6:43 start). *Change:* right-hand side shows "in 13 min ›" / "LEAVE NOW ›" (within 10 min) / "LATE 9 min ›" and is never truncated; amber only within ±10 min of the deadline; leave-by that lands before the leg starts becomes "LEAVE NOW"; add a **Maps ↗** link to the next exchange right on the row (the most-tapped thing at 2 AM).
4. **Warn the *next* runner, not the current one.** [RR] Reminders key on the leg being run, so "no van access — carry water" (Springwater Trail, Legs 9–11) and "gravel — bandana" (20–21) appear only after that runner has left. *Change:* a first reminder line for the runner about to go out: "Leg 10 runner: carry water — no van" / "Leg 20 runner: gravel — bandana."
5. **Right words at Exch 18 and at the finish.** [RR] On Leg 36 NOW says "drive to Exch 36" and "drop runner early" — the runner is already out and the van never goes to Exch 36. *Change:* Leg 36 → "Van → Seaside shuttle lot, walk to beach" and "Meet Jerald before the chute — run in together." At Legs 18–19 → "Cell dies after 18 — captain's phone logs" and "Van sign up for 19–23."
6. **Honest copy when the log goes stale.** [UX][RR] With nothing logged for hours, NOW reads "arrives at Exch 26 3h 24m ago" and "On deck … 2h 14m ago." *Change:* "was due 2:43 AM · nothing logged since Exch 25 — tap LOG HANDOFF"; button subtitle "Which exchange are you at?"; your own line "Leg 1 · running now" once your leg has started.
7. **Three visual fixes.** [UI] The gear badge on NEXT wraps onto two lines on night legs (exactly when it matters) → no-wrap; the disabled CONFIRM ("Pick a leg first") is 2.4:1 contrast → readable grey; deploy the leg-page copy fixes already made locally ("Hard (official: Hard)", stray "sideruns.").

## P1 — also today if you approve (about 1.5 h) — polish that earns its keep

8. **"Set pace" only shouts on your own row.** [UX][UI] Nine amber "Set pace" buttons on Home invite editing other people's paces. *Change:* amber only on the YOU row; other empty rows read a muted "no pace yet" (still tappable); editing someone else's pace says "Changes Warren's legs on every phone."
9. **Stale sheet: make the suggestion tappable.** [UI][UX][RR] "Probably Leg 30?" is plain text and the leg chips open at Leg 1 — 29 chips of scrolling at 6 AM. *Change:* "Probably Exch 30 — Nicole just finished Leg 30?" as a chip that selects it; chips scroll to the suggestion.
10. **Undo within reach.** [UX] Undoing a wrong leg after the 10-s toast means Info → scroll ~2,000 px past the roster. *Change:* move "Recent changes" directly under "Me" in Info.
11. **Dead-zone hint in the sheet.** [UX] "No bars → log on the captain's phone" lives only in Info. *Change:* one muted line in the handoff sheet when offline and not captain.
12. **Drop-runner spreads the load.** [RR] Dropping John proposes all three of his legs to Alex (17 → 33 mi, and she's the 12:00 runner). *Change:* don't suggest the same runner twice in one drop.
13. **Copy nits.** [UX][RR][UI] "Legs 1, 10, 19, 28 · 22.1 mi" (not five run-together numbers); "ADJUST" in grey so it stops competing with the button; estimated times get an " est." suffix; "REFLECTIVE GEAR" → "VEST"; drop "Leg named after bruce h." fragments; Roster header in sentence case; "LEAVE BY (latest)" on the leg page plus "leave when the finisher's in the van"; Leg 29 gets a 20-min walk buffer (official note: parking ½ mile away).
14. **Pre-race "Tonight" card on Home.** [UX] "Wait for ✓ Ready offline · Add to Home Screen · set your pace · download offline maps (Info)."
15. **Visual consistency.** [UI] Dim the LEG and CAPTAIN pills (amber reserved for LATE, warnings, ADJUST-only-when-needed, the button); runner line never wraps; bold the LEAVE and Finish times; rows ≥ 44 px on phones taller than 600 px; tab-bar stopwatch icon renders as a color emoji on iPhone → text glyph; badge backgrounds lifted so NO SHADE / MAJOR EXCH don't vanish in sun; leg-page gear badge no longer stretches full width.

## P2 — after the race (not tonight)

- One "On our way" tap on the LEAVE row so LATE stops being guesswork; later, learn real drive times from taps. [RR]
- Pre-race NOW shows your four legs instead of empty space. [RR]
- Consolidate 15 font sizes to 6; "✓ Ready offline" chip shouldn't cover the page title; slightly lighter cards for sun; done legs mute their times too. [UI]
- First-run: tapping the dark backdrop shouldn't count as a permanent Skip; "Who just finished?" chips in leg order; expected-time effect line hidden until something changes; clean stray lines in the official runner directions; roster phone numbers. [UX]

## What all three said is working
- The handoff sheet is "the right shape": giant leg label, live "John → Zane," restating CONFIRM, −N chips, 10-s UNDO, and the "Who just finished? / Legs 26–29 will get estimated times · about on pace" recovery — it fits at 375×553 with no scrolling.
- NOW's hierarchy (leg + exchange → huge ETA → LEAVE → NEXT with computed gear → big amber button) reads at a glance; contrast is real (nothing under 7:1).
- Leg pages carry exactly what a tired driver needs in a dead zone: address and GPS as text, explicit Starts at / Ends at, the official van notes.

## Proposed sequence
1. You approve / trim this list (reply with numbers to drop).
2. I implement P0 then P1 in one batch (~3 h), re-run the automated checks (tests, no-scroll at 375×553, contrast), and deploy **once** — open phones reload automatically.
3. Code freeze after that deploy. Team opens the link tonight, picks their name, enters their pace.
