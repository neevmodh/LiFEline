# Demo script

For the 5-minute stage pitch (about 2 minutes of it live) and the booth. The deck is the HackCult '26 pitch in Claude (10 slides); slide 4 is the live demo.

## Before you go on

- Phone: the Nidhi APK installed and signed in as a demo household in **Ahmedabad** that belongs to **શાંતિ એપાર્ટમેન્ટ્સ (ડેમો)** (in a duel with the college). Language: English for the stage, switch to ગુજરાતી once to show it.
- Laptop: the GEDA console open at `nidhi-gujarat.vercel.app/geda`, signed in as the state team; a second tab on the methodology page.
- A printed electricity bill (any DISCOM) for the photo step, and a photo of a switched-off geyser or a cloth bag for proof.
- Demo data loaded with `--peak-day` set to the day of the pitch, so the Peak Hour Challenge shows (18:00–20:00; it reads "Live now" only inside the window).
- Check `/api/health` is green 10 minutes before; Render can take a minute to wake.

## The two minutes

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | App, sign-up | Create a new account, pick Surat | "A new household. Two minutes to start." |
| 0:15 | Onboarding | Photograph the bill; units and DISCOM fill in; the footprint card updates | "The bill fills this in. Torrent is suggested for Surat. This is their footprint today." |
| 0:35 | Home | Point at the score, homes like yours, today's 3 actions | "How am I doing, how do I compare, what do I do today, each with a reason." |
| 0:50 | Home | Tap **Done** on the first action | "One tap. 40% of the points now." |
| 1:00 | Act | Log an action **with photo**; then the same photo again | "A photo earns the rest after GEDA checks it. The same photo twice is refused." |
| 1:15 | Community (demo household) | Show the duel card and the Peak Hour Challenge | "A society against a college, counted only when 40% take part. GEDA's evening peak event." |
| 1:30 | Console | Funnel, themes, communities and duels | "GEDA sees who takes part, in which LiFE themes, and every duel." |
| 1:45 | Console | Approve the photo from the queue | "A person approves; the household's tree grows and verified impact moves." |
| 1:55 | Me (app) | Impact Ledger | "Estimates, claims and verified impact, never added together." |

## If something fails

- **No signal or the API is waking:** say so, continue on the laptop with the app's web version (same account), and show the offline queue: an action logged offline is sent when the signal is back.
- **Bill photo not read:** type the units; the screen says bill reading isn't available and nothing blocks.
- **Peak event not live:** it's outside 18:00–20:00; show it on Community as today's event with its window.

## Booth

- Judges sign up on their own phones from the QR on the landing page (Android APK) or the web app link.
- Show `/methodology` for "where does this number come from?"
- Q&A answers: `docs/QA.md`.
