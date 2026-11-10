# Design decisions

Why Nidhi is built the way it is. Each entry: the choice, the reason, and what we gave up.

| Decision | Why | Trade-off |
|---|---|---|
| **Real data only.** Every factor and tariff lives in `services/factors.py` with its source, served at `/api/config` and shown on the How-we-calculate page. | Judges and citizens can check every number. Nothing is seeded, demo or guessed. | Empty maps and leaderboards until real people sign up. We say so instead of faking activity. |
| **Savings are priced in rupees at the household's own DISCOM slabs.** | People act on money. A marginal-rate view shows which slab a home is close to crossing. | Torrent Power's tariff is marked "unverified" until checked against the GERC schedule. |
| **Weather-adjusted savings** (degree-day regression on Open-Meteo archive data). | A cooler month is not a saving. | Needs a few months of bills; falls back to district, then state, pooled slopes. |
| **Open-Meteo, not OpenWeather.** | Free, no key, hourly solar radiation for Green Hours, and a historical archive for the regression. | Third-party dependency; results are cached. |
| **Points: 40% on logging, the rest on an approved photo.** Perceptual-hash duplicate detection and an AI pre-screen. A person always decides. | Instant feedback, but points mean something. | Reviewer workload; reviewers get a queue only. |
| **Group totals hidden below 5 households** (wards, societies). | Small groups identify individuals. | Small societies see no totals until they grow. |
| **First names only** on booth feed, share card, committee view and certificates. | Privacy by default. | Less personal. |
| **Campaign progress counts actions, not sign-ups.** Doing the action is taking part. | Nobody has to join anything; counts need no personal data. | Campaigns can't show who took part. |
| **Roles split by need:** citizen, committee (per society), admin, district officer, reviewer, auditor. | Least privilege: an officer sees one district, a reviewer only the queue, an auditor can't act. | More roles to explain. |
| **Free bill check before sign-up** (rate-limited, nothing stored). | Value in 30 seconds beats a sign-up wall. | Guests get a plan but no tracking. |
| **Straight-line bill forecast, labelled as such.** | Honest and explainable; avoids pretending to predict weather. | Less accurate for uneven months. |
| **Web Push via VAPID, at most 2 alerts a day,** scheduled by GitHub Actions every 15 minutes. | Works with the app closed; the free Render plan can't run a scheduler. | iPhone needs the app installed (iOS 16.4+). |
| **On-device OCR fallback for bills** (Tesseract.js, bundled language data). | Works offline and keeps the photo on the phone. | Slower than the vision model. |
| **Supabase Postgres with RLS on every table;** the API connects directly and photos live in a private bucket. | Managed Postgres, private proofs. | Free-plan limits; Render free plan sleeps (the alert cron keeps it warm). |
| **Account export and delete in the app.** | A user's data belongs to the user. | Deleting removes photos and membership permanently. |
| **English/Gujarati/Hindi, generated with Adaption, checked for placeholders.** | Reaches the people the programme is for. | Needs a native-speaker review before launch. |
