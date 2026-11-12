# Demo script

For the 5-minute stage pitch (about 3 minutes of it live), the video (#22) and the booth. The deck is the HackCult '26 pitch in Claude; the live demo follows the problem statement's four features in order.

## Before you go on

- **Phone:** the latest Nidhi APK (the QR on the website, or `/get`), signed in as a demo household in **Ahmedabad** that belongs to **શાંતિ એપાર્ટમેન્ટ્સ (ડેમો)**. Notifications allowed. Language: English for the stage; switch to ગુજરાતી once.
- **Laptop:** the GEDA console at `nidhi-gujarat.vercel.app/login`, signed in as **geda@gmail.com** (state admin). A second tab on the app's web version, `nidhi-app-rosy.vercel.app`, as a backup.
- **Props:** a printed electricity bill (any DISCOM).
- **Two minutes before:** open the website once so the API is awake (it also stays awake through a ping every 10 minutes), and check `lifeline-api-9ox2.onrender.com/api/health` is green.
- The Peak Hour Challenge on 14 Nov reads "Live now" only inside its window; outside it, it shows as today's event.

## The three minutes

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Home | Point at the LiFE Score, homes like yours, Green Hours and today's 3 moves | "Your footprint, how you compare with similar homes in your district, and three things to do today, each with a reason." |
| 0:20 | **Bill X-ray** (card on Home) | Tap **X-ray a bill photo**, photograph the bill | "Snap the bill. Here's where the money goes, exactly as the DISCOM charges it: slabs, fuel surcharge, duty. Your last units are the dearest, and here's the cut that drops you a slab." |
| 0:45 | Bill X-ray → **What if…** | Tap AC +2°C, LEDs +3, solar +1 kW | "Change a habit or add solar and the bill changes as you tap, priced at your own tariff. That's rupees, kilograms of CO₂ and trees a year." |
| 1:05 | **Ask Nidhi** | Switch to ગુજરાતી; tap *મારું બિલ આટલું વધારે કેમ છે?* | "Ask in Gujarati, Hindi or English. Every number in the answer is your own; an AI can't invent one." |
| 1:20 | Ask Nidhi | Tap **Log** under the answer | "One tap from advice to action. Logging now earns 40% of the points; a photo GEDA verifies earns the rest." |
| 1:30 | Celebration | Let it play; tap the **share** button | "Rewarded, and shared to WhatsApp as a card with the household's real impact." |
| 1:45 | **Alerts** (bell) | Show "Right now" | "Contextual nudges: the evening peak, the solar window, today's temperature. They're in the app even without push, and on Android they also arrive as notifications." |
| 1:55 | **My progress** | Show the bars under the dashed start line | "Improvement over time: each month's units against where you started." |
| 2:05 | **Team** | The district map, then the duel | "Gujarat's 33 districts racing to their monthly goals, and a housing society against a college, counted only when 40% of homes take part." |
| 2:20 | **Console** | Overview, map, then **New campaign → Diwali LED switch → post** | "GEDA sees participation, themes and districts live, and launches a festival campaign in one click…" |
| 2:40 | Phone, Home | Pull to refresh: the campaign banner appears | "…and it's on every household's Home." |
| 2:50 | Console | Approve a photo from the review queue | "A person approves; verified impact is kept separate from estimates and claims, never added together." |

## If something fails

- **No signal, or the API is waking:** say so and continue on the laptop's web version (same account). A log made offline is sent when the signal returns.
- **Bill photo not read:** Bill X-ray still opens on the household's usual month, and My progress takes typed units.
- **Ask Nidhi's AI not configured:** answers still come from Nidhi's own reviewed answers, with the same numbers.
- **Push doesn't arrive:** the Alerts inbox has the same content.
- **Peak event not live:** outside its window it shows as today's event with its hours.

## Booth

- Judges install from the QR on the landing page (Android APK) or open the web app; on a laptop the web app has a desktop layout with a sidebar.
- "Where does this number come from?": `/methodology` on the website, and Bill X-ray's slab breakdown.
- Q&A answers: `docs/QA.md`.
