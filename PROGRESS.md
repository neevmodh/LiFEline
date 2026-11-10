# Nidhi: progress log

This is the working record for the HackCult '26 submission: what's built, how it was verified, what went wrong and how it was fixed, and what's left. For the product overview and setup, see [README.md](README.md).

| | |
|---|---|
| **Problem statement** | HC26-GEDA01, Development of an Interactive "Mission LiFE" Citizen Engagement Application (GEDA) |
| **Track** | Track 1: Green Energy & Sustainability |
| **Phase 1 deadline** | 4 November 2026, 6:30 PM IST (submitted 2 Nov) |
| **Finale** | **14 November 2026, IIT Gandhinagar**: booth demo 10:45–1:15, stage pitch 3:00–5:00 |
| **Repository** | https://github.com/neevmodh/Nidhi-LiFE (public) |
| **Status (8 Nov 2026)** | Shortlisted for the finale (team Beyond Logic). Finale build: real data only, Supabase-ready, AI proof screening |

## Finale build (8 Nov 2026)

The finale asks for a live demo with dynamic inputs rather than dummy data, so:

- **No sample data anywhere.** The synthetic citizens and one-click demo logins are gone. `python -m app.create_admin` creates GEDA administrators; tests, CI and e2e create real users through the app.
- **Sourced figures.** CEA v21 grid factor and operating margin, GERC tariffs per DISCOM (urban and rural, with fixed charge, FPPAS and duty), Gujarat solar benchmark cost. Served at `GET /api/config` and shown on the **How we calculate** page.
- **Personalised savings.** `services/impact.py` computes each action's kWh and CO₂ for the household; actions that don't apply are refused with a reason. Impact is stored per log.
- **No duplicates.** Proof photos are decoded (fake files rejected), fingerprinted with a perceptual hash, and refused if the same photo, even resized or re-compressed, already backs a claim. Ward spellings are normalised.
- **AI pre-screening** of proof photos for the review queue; a person still decides.
- **Supabase-ready.** Pooler support, a separate migration URL, private Storage bucket for proofs, and Row Level Security on every table.

## Submission checklist

- [x] Public GitHub repository with all commits made during the hackathon window
- [x] README with architecture and database diagrams, setup instructions and screenshots
- [x] Working prototype (runs locally in 2 minutes)
- [x] Pitch deck: PDF, at most 10 slides (problem, architecture, database schema, tech stack, scalability, limitations, roadmap)
- [x] Demo video: 2–3 minutes, unlisted YouTube or Loom, showing real features
- [ ] Optional: a live deployed link so judges can try it without installing

Judging weights, for prioritising: technical execution and code quality 40%, architecture and scalability 30%, UI/UX 20%, innovation and problem fit 10%.

## What's built

### Citizens
- [x] Sign-up with district and ward
- [x] 3-step onboarding with a live CO₂ footprint (electricity, cooking gas, commute)
- [x] **Snap your bill**: AI reads units, billing days and amount (Groq, about 1 s), converting two-month bills to monthly. Falls back to on-device OCR (Tesseract.js) when there's no key or the AI is busy.
- [x] Dashboard: footprint, CO₂ avoided, streak, district rank, level and points, monthly electricity trend against the baseline
- [x] Contextual nudges: peak hours (6–10 PM), solar hours, pre-cooling, AC set-point using live temperature, geyser, commute, night-time tips, and progress against the baseline
- [x] 12 green actions across 7 categories; a daily cap per action; one statewide daily challenge at 2× points
- [x] Photo proof: 40% of points instantly without a photo, 100% once an admin verifies it
- [x] Leaderboards by ward, district and Gujarat; district goals (10% of participants' combined baseline) on a map
- [x] Rooftop solar calculator: PVGIS yield for the district, net-metered savings, PM Surya Ghar subsidy, payback, 25-year gain
- [x] Profile page to edit account details and household answers
- [x] Light and dark mode; works on phones (bottom tab bar, camera for bill scans)

### GEDA (state administrators)
- [x] Statewide KPIs: citizens, active this week, CO₂ avoided, kWh saved, rooftop solar potential
- [x] **District explorer**: real boundaries for all 33 districts, coloured by CO₂ avoided, participation, CO₂ per citizen, average footprint or untapped solar
- [x] District panel: engagement, peak-hour load shifts, household consumption trend, weekly CO₂, leading wards, solar pipeline (suitable roofs, kW, generation, CO₂, subsidy needed, survey requests)
- [x] Weekly CO₂ and active-citizen charts, impact by action type, sortable district table, districts not reached yet
- [x] Photo-proof review queue (approve or reject)

### Platform
- [x] FastAPI + SQLAlchemy 2 + Pydantic v2; PostgreSQL in Docker, SQLite for local dev
- [x] Alembic migrations, with a test that models and migrations match
- [x] JWT auth with bcrypt; rate limits on login (per IP and email), sign-up and bill scans
- [x] Every emission factor and tariff assumption in one file (`backend/app/services/factors.py`)
- [x] External APIs (PVGIS, Open-Meteo, Groq) have timeouts and fallbacks, so they never block the user
- [x] Docker Compose (PostgreSQL + API + web) with health checks
- [x] GitHub Actions: backend tests on SQLite **and** PostgreSQL, frontend checks, end-to-end tests, Docker smoke test

## Verification

| Check | Result |
|---|---|
| Backend tests (pytest) | **50 passed** on SQLite and on PostgreSQL |
| Frontend unit tests (Vitest) | **6 passed** (bill text parser) |
| End-to-end (Playwright, 3 journeys) | **3 passed**: citizen journey with a real OCR bill scan, phone layouts, admin explorer and proof review |
| Lint and types | ESLint and TypeScript clean |
| CI on GitHub | All 4 jobs green on the latest commit |
| Live AI bill scan (Groq) | Test bill read correctly in about 1.1 s: 540 units over 61 days → 266 kWh/month, ₹4,215.50, distributor identified, no personal details returned |
| Map | 33 districts render in light and dark; exactly one tooltip on hover, none over the sea |
| README on GitHub | All 17 images load; renders correctly |

Code size: about 3,400 lines of Python (app and tests) and 3,700 lines of TypeScript.

## Timeline

| Commit | When (IST) | What |
|---|---|---|
| `4cc5f12` | 30 Oct 23:29 | Backend API: footprint, nudges, actions, leaderboards, solar, admin |
| `79f0823` | 30 Oct 23:45 | Web app: onboarding, dashboard, actions, community, solar, admin |
| `1394f17` | 30 Oct 23:51 | Migrations, rate limiting, AI bill scan, ward leaderboard, profile edits |
| `471a5fc` | 31 Oct 00:09 | Bill scanning UI, profile page, end-to-end tests, CI |
| `cc07247` | 31 Oct 09:37 | Renamed to Nidhi; first push to GitHub |
| `757dbea` | 31 Oct 09:39 | CI fix: generate Next.js route types before type checking |
| `73beb1f` | 31 Oct 09:44 | Fix: multi-worker startup race on a fresh database |
| `d2c07ee` | 31 Oct 09:47 | CI badge |
| `cc6a0e9` | 31 Oct 09:54 | Groq vision for bill reading, with on-device fallback |
| `73fa30e` | 31 Oct 09:58 | One-click demo login |
| `1d5244e` | 31 Oct 10:16 | Real map of Gujarat: district explorer and community goals map |
| `8d7f8bf` … `c035f0a` | 31 Oct 10:27–10:28 | Screenshot script, screenshots and README rewrite (5 commits) |

## Problems found and fixed

These came up during testing; each fix is covered by a test or by CI.

| Problem | How it was found | Fix |
|---|---|---|
| Solar payback too optimistic (2.4 years) | Sanity-checking results | Savings now compare slab-based bills with and without solar (net metering) and include panel degradation; payback is 3–4 years |
| Times shown 5½ hours off | Browser test | API returns timestamps explicitly in UTC |
| Sign-out went to the login page instead of home | Browser test | Fixed a redirect race in the app shell |
| District goals unreachable (bars near 0%) | Screenshot review | Goal is now 10% of participants' combined baseline |
| Empty nudge list at night | Screenshot review | Added off-peak and standby tips |
| Weather lookups delayed nudges by up to 6 s | Screenshot review | Weather capped at 2.5 s, cached 30 minutes |
| Type check failed on a fresh checkout | First CI run | `typecheck` runs `next typegen` first |
| **Docker: one worker crashed on first start** (both workers inserted the same reference data) | First Docker CI run | Migrations and reference data run once before the workers start; reproduced locally on PostgreSQL |
| CARTO map tiles started requiring an API key (watermarked map) | Screenshot review | Switched to Esri canvas tiles after checking they render without watermarks |
| Tooltips left stuck on the map after selecting a district | Browser test | The map layer updates in place instead of being rebuilt |
| Admin weekly chart had two y-axes | Chart guideline review | Split into two single-axis charts |

## Configuration notes

- **Groq API key:** stored only in `backend/.env`, which git ignores. Every push was checked to make sure no key went to GitHub. Tests and CI never use it. Free tier: about 3 bill scans per minute; beyond that the app reads bills on the device. **Rotate the key after the hackathon**, since it was shared in a chat.
- **Admins:** `uv run python -m app.create_admin --email … --name …` (password prompted, or `LIFELINE_ADMIN_PASSWORD`).
- **Map tiles:** Esri's public canvas service; production should use a licensed or self-hosted tile service.
- **Assumptions to verify before judging:** the grid emission factor (0.71 kg/kWh) and the illustrative Gujarat tariff slabs in `factors.py`.

## Known limitations

- The footprint covers electricity, cooking gas and commute only (no diet, waste or flights).
- Nudges show when the app is opened; there are no push notifications yet.
- A person approves every proof; the AI only pre-screens.
- Fixed charges assume a single-phase connection up to 2 kW.
- Rate limits are per process; multiple replicas would need Redis.

## Next steps

1. Set up Supabase (database, private `proofs` bucket) and point the API at it.
2. Get real people to sign up before the 14th so the GEDA map shows real activity.
3. Retake the README screenshots from real data (`npm run screenshots`); the current ones date from the synthetic data.
4. Rehearse the booth demo with live inputs and the 5-minute stage pitch.
5. Rotate the Groq key after judging.
