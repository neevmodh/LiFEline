# Judge Q&A

Short, honest answers. Numbers are from the repo and the live app.

**What problem does it solve?** Mission LiFE asks citizens to change habits, but most people never see what their own habits cost or save. LiFEline reads a bill, shows the household's footprint, and gives a plan ranked by rupees saved at their DISCOM's tariff.

**Is the data real?** Yes. Tariffs, emission factors and commute factors are cited in `factors.py` and on the methodology page. Weather and solar come from Open-Meteo and PVGIS, boundaries from geoBoundaries, installers from the government's registered list. Nothing is seeded.

**Why are the maps and leaderboards empty?** There are no invented users. They fill as real people sign up. At the booth, sign-ups on judges' phones appear on the map within seconds.

**How accurate is bill reading?** On-device OCR got the units right on 254 of 254 generated test bills across every DISCOM. A vision model reads real photos in about a second when online. Generated bills are a test of the parser, not proof for every real bill; users confirm the numbers.

**How do you stop fake points?** Logging gives 40% of points. A photo approved by GEDA earns the rest. Perceptual hashing blocks the same picture (even resized) backing two claims, an AI pre-screen flags unrelated photos, and a person decides.

**Is it private?** Every table has row-level security, photos are in a private bucket, group totals hide below 5 households, public views show first names only, and users can download or delete all their data.

**What did you actually build for GEDA?** A statewide map of all 33 districts, district explorer, solar what-if, proof review queue, CSV reports, campaigns, district officer / reviewer / auditor roles, and booth mode.

**What are campaigns?** Time-boxed challenges with a shared target, run by GEDA or a society committee. Progress counts real logged actions in scope; participants get a certificate.

**Why Open-Meteo instead of OpenWeather?** Free with no key, and it provides the hourly solar radiation and historical archive that Green Hours and the savings regression need.

**What AI and data science is in it, and why?** Degree-day regression (weather-adjusted savings), a hourly solar forecast (Green Hours), vision/OCR bill reading, and AI pre-screening of proof photos. Each replaces a manual or guessed step. A person makes every approval.

**What is unverified?** The Torrent Power tariff (marked so on the methodology page) and the Gujarati/Hindi wording, which needs a native-speaker review.

**What happens at scale?** Stateless API behind Render, Postgres on Supabase, aggregate queries indexed by user and date. We measured p50/p95 with a Locust test; the free Render plan sleeps, so a scheduled job keeps it warm and a paid plan is the upgrade.

**What's next?** Smart-meter data in place of manual readings, WhatsApp alerts, diet/waste/flights, EXIF checks on photos, native-speaker review.

**Why should this win?** It is useful to a citizen on day one (free plan, no sign-up), honest about every number, and gives GEDA the tools to run the programme: map, review queue, campaigns, roles.
