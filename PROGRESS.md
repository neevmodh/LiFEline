# LiFEline: progress log

This is the working record for the HackCult '26 submission: what's built, how it was verified, what went wrong and how it was fixed, and what's left. For the product overview and setup, see [README.md](README.md).

| | |
|---|---|
| **Problem statement** | HC26-GEDA01, Development of an Interactive "Mission LiFE" Citizen Engagement Application (GEDA) |
| **Track** | Track 1: Green Energy & Sustainability |
| **Deadline** | **4 November 2026, 6:30 PM IST** |
| **Repository** | https://github.com/neevmodh/LiFEline (public) |
| **Status (31 Oct 2026)** | App complete and tested; CI green; deck and video still to do |

## Submission checklist

- [x] Public GitHub repository with all commits made during the hackathon window
- [x] README with architecture and database diagrams, setup instructions and screenshots
- [x] Working prototype (runs locally in 2 minutes; one-click demo logins)
- [ ] Pitch deck: PDF, at most 10 slides (problem, architecture, database schema, tech stack, scalability, limitations, roadmap)
- [ ] Demo video: 2–3 minutes, unlisted YouTube or Loom, showing real features
- [ ] Optional: a live deployed link so judges can try it without installing

Judging weights, for prioritising: technical execution and code quality 40%, architecture and scalability 30%, UI/UX 20%, innovation and problem fit 10%.

## What's built

### Citizens
- [x] Sign-up with district and ward; one-click demo login
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
| `cc07247` | 31 Oct 09:37 | Renamed to LiFEline; first push to GitHub |
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
- **Demo data:** `uv run python -m app.seed --demo` creates 360 synthetic citizens across all 33 districts. Logins use password `demo1234`: `citizen1@lifeline.demo` and `admin@lifeline.demo`.
- **Map tiles:** Esri's public canvas service, fine for a demo; production should use a licensed or self-hosted tile service.
- **Assumptions to verify before judging:** the grid emission factor (0.71 kg/kWh) and the illustrative Gujarat tariff slabs in `factors.py`.

## Known limitations

- The footprint covers electricity, cooking gas and commute only (no diet, waste or flights).
- Nudges show when the app is opened; there are no push notifications yet.
- Proof review is manual.
- Tariffs are illustrative rather than fetched per DISCOM.
- Rate limits are per process; multiple replicas would need Redis.

## Next steps

1. **Pitch deck** (10 slides): problem → solution → live demo screens → architecture → database schema → tech stack → scalability → limitations → roadmap → impact. Use `docs/screenshots/`.
2. **Demo video** (2–3 min): one-click citizen login → scan a bill → nudges and the daily challenge → log an action with a photo → community map → solar → GEDA explorer (switch metrics, open a district, approve a proof).
3. Optional: deploy (for example Railway or Render) and add the link to the README.
4. Rotate the Groq key after judging.
