# Judge Q&A

Short, honest answers. Numbers are from the repo and the live app.

**What problem does it solve?** Mission LiFE asks households to change habits, but people can't see how they're doing, what to do today, or whether solar pays. GEDA can't see who takes part or what is really saved. Nidhi answers both: an app for households and a console for GEDA on one API.

**What does a household see first?** A two-minute start from a bill photo, then Home: a LiFE Score out of 100, a comparison with similar homes in their district, the Action Engine's three best actions for today with the reason for each, a streak, and a Nidhi tree that grows only with verified impact.

**How does the Action Engine choose?** It ranks every action that applies to this home by rupees and CO₂ for this household, the time of day and season (Green Hours, the evening peak, today's temperature), what you've already done, and today's challenge. Each card says why it's there.

**How is the LiFE Score worked out?** Efficiency up to 50 (your units against the median of similar homes), consistency up to 30 (days with a green action in the last 14) and verified up to 20 (photo-approved actions in 30 days). The formula is on the methodology page.

**Is the data real?** Tariffs, emission factors and commute factors are cited in `factors.py` and on the methodology page. Weather and solar come from Open-Meteo and PVGIS, boundaries from geoBoundaries, installers from the government's registered list. Demo people and communities exist only for rehearsals: every name carries "ડેમો" and one command removes them.

**How do you keep numbers honest?** Estimated (from the household's plan), self-reported, awaiting review and verified are kept apart in the Impact Ledger and the console, never added together. Actions with no defensible CO₂ figure (plastic, water, food, waste) earn points but show no CO₂.

**How do you stop fake points?** Logging gives 40% of points; a photo approved by GEDA earns the rest. Perceptual hashing blocks the same picture (even resized) backing two claims, an AI pre-screen flags unrelated photos, and a person decides.

**What are duels?** Two communities (a society against a college, say) compete for 30 days on CO₂ avoided per household. A side only counts once 40% of its households take part, so a few keen people can't carry an inactive community. Only committees start or accept one.

**What is a Peak Hour Challenge?** A one-day GEDA event with an hour window, demand response without payments. People get a reminder 30 minutes before, and only heavy loads moved out of the peak, logged inside the window, count.

**Is it private?** Row-level security on every table, photos in a private bucket, community totals hidden below 5 households, committees see first names and counts only, district officers see only their district, and anyone can download or delete all their data in the app.

**What did you build for GEDA?** All 33 districts on a map, the participation funnel, actions by Mission LiFE theme, communities and duels, campaigns and Peak Hour Challenges created from the console, the photo review queue, CSV reports and role-scoped access (state team, district officer, reviewer, auditor).

**Does it work offline and in Gujarati?** Actions logged without signal wait on the phone and are sent later. Every screen, the server's own sentences and all 33 district names are in English, Gujarati and Hindi. The first machine translation was rewritten by hand with one word per idea (points is પોઇન્ટ and अंक everywhere), and tests fail if any key is missing or loses a placeholder. A native speaker should still read it once.

**What AI and data science is in it, and why?** A vision model reads bills; an AI pre-screen flags unlikely proof photos (a person approves); a degree-day regression separates real savings from weather; the hourly solar forecast picks Green Hours; the Action Engine ranks actions; Ask Nidhi answers questions about your own home. Each replaces a manual or guessed step.

**Can Ask Nidhi make numbers up?** No. The server collects the household's own facts (its bill, slabs, plan, appliances, district sunshine) and an English answer from the AI is used only if every number in it is one of those facts and any action it suggests is in the catalogue; otherwise Nidhi uses its own reviewed answer for that topic. In Gujarati and Hindi it always uses the reviewed answers, because the model's wording there read like machine translation.

**What is Bill X-ray?** A bill split exactly as the DISCOM charges it: energy by slab, fuel surcharge, duty and the fixed charge (tests check the parts add up to the bill for every tariff), the slab your last units fall in, and a likely split by appliance, labelled as an estimate. Its "What if" recomputes the bill on the phone as you change the AC set-point, LEDs, solar kW, geyser or standby; the phone's maths matches the server's to the paisa.

**How do people see improvement over time?** My progress plots each month's units against the baseline from onboarding, with the change in percent and rupees and months in a row below the start. Bills can be typed or read from a photo.

**What is unverified?** The Torrent Power tariff (marked so on the methodology page), a native speaker's read of the Gujarati and Hindi, and the appliance split in Bill X-ray (an estimate, and labelled one).

**How is it tested?** 319 backend tests on SQLite and PostgreSQL, 48 app unit tests and 22 website unit tests (Vitest), 6 Playwright end-to-end flows, the app's types and a full web build, and a Docker smoke test, on every pull request. Edge cases are tested on purpose (slab boundaries, India-time midnight and week starts, leap days, rejected logs, bad numbers from the server, invented AI numbers), and regression tests guard past bugs (half-translated screens, a lost placeholder). Every new screen was also walked through in a browser at phone and desktop widths in English, Gujarati and Hindi. Each feature shipped as its own PR, merged only on green CI.

**What happens at scale?** Stateless API (JWT) behind Render, Postgres on Supabase, grouped SQL with a fixed number of queries per screen, and external data cached per district. An earlier Locust test on the free tier: 100 concurrent users, 0 failures, p95 400 ms. At state scale: Redis for leaderboards, daily rollups for analytics, a queue for alerts.

**What's next?** Smart-meter data in place of typed bills, WhatsApp alerts and sharing to WhatsApp groups, diet, waste and flights in the footprint, photo date and location checks, native-speaker review.

**Why should this win?** It's useful to a household on day one (a free plan without sign-up, then an app in their language), honest about every number, and gives GEDA the tools to run the programme: funnel, themes, communities, duels, campaigns, peak events and review.
