<div align="center">

# 🌱 LiFEline

### Small daily choices, measured. Gujarat's Mission LiFE companion.

[![CI](https://github.com/neevmodh/LiFEline/actions/workflows/ci.yml/badge.svg)](https://github.com/neevmodh/LiFEline/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-59%20passing-1f7a4d)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)

**HackCult '26** · Track 1: Green Energy & Sustainability · Problem statement **HC26-GEDA01**<br/>
Built for the **Gujarat Energy Development Agency (GEDA)**

<img src="docs/screenshots/admin-overview.png" alt="GEDA's regional overview: statewide totals and an interactive map of all 33 districts of Gujarat" width="920">

</div>

## Why LiFEline

India's **Mission LiFE** asks every household to live more sustainably. Most people agree, but they still can't answer three simple questions:

1. **What is my footprint?** A bill says *540 units*. It doesn't say that's about 380 kg of CO₂, or what to change first.
2. **What should I do right now?** Running the washing machine at 7 PM, when grid demand peaks, is not the same as running it at noon, when solar power is plentiful. Nobody tells you which hour you're in.
3. **Is solar worth it for me?** How big a system fits my roof, what subsidy do I get, and when does it pay back?

GEDA has the same blind spot at state scale: which districts are engaged, where the savings come from, and where rooftop solar would pay off.

**LiFEline answers these questions for citizens and for the state, in one app.**

## LiFEline at a glance

| | |
|---|---|
| 📸 **Snap your bill** | Photograph the electricity bill. AI reads the units, billing days and amount in about a second, and converts two-month bills to monthly figures. No AI key, or the AI is busy? It reads the bill on the phone instead, and the photo never leaves the device. |
| ⚡ **Nudges at the right moment** | Tips tied to the grid's peak and solar hours, today's temperature in your district, your appliances, and this month's usage against your baseline. |
| 🏆 **Act together** | One daily challenge for all of Gujarat (2× points), streaks and levels, and leaderboards for your ward, district and state. |
| ✅ **Honest points** | Log an action instantly for 40% of its points; add a photo that GEDA verifies for the full 100%. Logging stays easy and the leaderboard stays fair. |
| ☀️ **Solar with real numbers** | Rooftop sizing from satellite solar data for your district (PVGIS), net-metered savings, the PM Surya Ghar subsidy, payback, and 25-year gain. |
| 🗺️ **A state view for GEDA** | An interactive map of all 33 districts with real boundaries. Click any district to see its engagement, falling (or rising) household consumption, leading wards, and its rooftop solar pipeline, including the subsidy it needs. |

## Try it in 2 minutes

You need Python 3.11+ with [uv](https://docs.astral.sh/uv/) and Node 20+.

```bash
# Terminal 1: API with demo data (360 citizens across all 33 districts)
cd backend && uv sync && uv run python -m app.seed --demo && uv run uvicorn app.main:app --port 8000

# Terminal 2: web app
cd frontend && npm install && npm run dev
```

Open **http://localhost:3000/login** and click **Try as a citizen** or **Try as GEDA admin**. No typing needed.

<img src="docs/screenshots/login.png" alt="Login page with one-click demo buttons" width="560">

## How it maps to the problem statement

| Expected feature | What LiFEline does |
|---|---|
| **Personalised footprint tracker** | 3-step onboarding with a live footprint preview (electricity, cooking gas, commute). Monthly bill readings are tracked against the baseline. |
| **Snap your bill** | Photograph the electricity bill and the units fill in automatically. Two-month bills are converted to monthly figures. A vision model reads it in about a second (Groq, or Claude, whichever key is configured). Without a key, or if the AI is busy, OCR runs on the device and the photo never leaves the phone. |
| **Behavioural nudges & micro-tasks** | A rule engine that uses grid time-of-day windows, the household's appliances, live temperature (Open-Meteo) and month-to-date usage. Each nudge links to an action the user can log in one tap. |
| **Gamification & social impact** | Points, levels and streaks. One daily challenge statewide (2× points). Citizen leaderboards by ward, district or state. District goals set at 10% of participants' combined baseline. |
| **Verified green actions** | Self-reported actions earn 40% of points instantly. Uploading a photo that an admin approves earns 100%. This keeps logging easy while making the leaderboard hard to game. |
| **Actionable resource hub** | Rooftop solar sizing from **PVGIS** irradiance data, with net-metered bill savings, **PM Surya Ghar** subsidy, net cost, payback and 25-year gain. |
| **State administrators** (target beneficiaries) | A **district explorer**: an interactive map of all 33 districts using real boundaries, coloured by CO₂ avoided, participation, CO₂ per citizen, average footprint or untapped rooftop solar. Clicking a district shows its engagement, peak-hour load shifts, household electricity trend, leading wards and solar pipeline (suitable roofs, kW, generation, CO₂, PM Surya Ghar subsidy needed). Also: weekly trends, impact by category, a sortable district table, the districts not reached yet, and a proof review queue. |
| **Community map** | Citizens see every district's progress towards its monthly goal on the same map, with their own district outlined. |

## Architecture

```mermaid
flowchart LR
    subgraph Client
        W["Next.js 16 web app<br/>(React 19, Tailwind, Recharts)"]
    end
    subgraph API["FastAPI service"]
        R["Routers<br/>auth · footprint · actions<br/>engage · admin"]
        S["Domain services (pure)<br/>footprint · nudges · solar<br/>gamification · stats"]
        R --> S
    end
    DB[("PostgreSQL<br/>(SQLite in dev)")]
    FS[("Proof image store<br/>local volume → S3")]
    PV["PVGIS API<br/>solar yield"]
    OM["Open-Meteo API<br/>temperature"]
    CL["Groq or Claude API<br/>bill reading (optional)"]
    OCR["Tesseract.js<br/>on-device OCR fallback"]

    W -- "REST + JWT" --> R
    W -. "503: no AI / busy" .-> OCR
    S -. "structured output" .-> CL
    R --> DB
    R --> FS
    S -. "cached, timeout + fallback" .-> PV
    S -. "30-min cache, timeout + fallback" .-> OM
```

**Design choices**

- **Domain logic is pure and unit-tested.** Footprint maths, the nudge rule engine, solar sizing and points rules have no I/O. Routers only load data, call them and shape responses.
- **All emission factors and tariff assumptions live in one file** (`backend/app/services/factors.py`), so every number can be checked and changed in one place.
- **External APIs never block the user.** PVGIS and Open-Meteo calls have tight timeouts and fall back to Gujarat averages; weather is cached for 30 minutes per location.
- **Timezone-correct.** Timestamps are stored in UTC; "today", streaks and daily caps use IST day boundaries.
- **Abuse limits.**
  - Login rate limit per IP and email, so one attacker can't lock out other users; sign-up and bill-scan limits too.
  - Per-action daily caps and image-only uploads of at most 5 MB.
  - Points are calculated on the server, and leaderboards count only self-reported or verified actions.
- **Versioned schema.** Alembic migrations, applied before the API workers start. A test fails if the models and migrations drift apart.
- **Privacy-first bill reading.** Only consumption figures are extracted; bill photos are never stored, and without an AI key they're read entirely in the browser.

## Database schema

```mermaid
erDiagram
    DISTRICTS ||--o{ USERS : "home of"
    USERS ||--o| HOUSEHOLDS : "describes"
    USERS ||--o{ ENERGY_READINGS : "logs monthly"
    USERS ||--o{ ACTION_LOGS : "performs"
    ACTION_TYPES ||--o{ ACTION_LOGS : "instance of"

    DISTRICTS { int id PK
        string name UK
        float lat
        float lon }
    USERS { int id PK
        string email UK
        string name
        string password_hash
        enum role "citizen | admin"
        int district_id FK
        string ward
        datetime created_at }
    HOUSEHOLDS { int user_id PK, FK
        int members
        float monthly_kwh
        float lpg_cylinders_per_month
        string commute_mode
        float commute_km_per_day
        int ac_count
        bool has_geyser
        bool has_ev
        bool has_solar
        float roof_area_sqm
        float baseline_kg_co2_month }
    ENERGY_READINGS { int id PK
        int user_id FK
        date month "unique per user"
        float kwh
        string source }
    ACTION_TYPES { int id PK
        string code UK
        string title
        string category
        int points
        float co2_saved_kg
        float kwh_saved
        int max_per_day }
    ACTION_LOGS { int id PK
        int user_id FK
        int action_type_id FK
        enum status "self_reported | pending | verified | rejected"
        int points_awarded
        float co2_saved_kg
        bool is_daily_challenge
        string proof_path
        datetime created_at
        datetime reviewed_at }
```

Indexes: `action_logs(user_id, created_at)` serves dashboards, streaks and daily caps; `action_logs(status)` serves the review queue.

## Running it

### Quick start (no Docker)

Requirements: Python 3.11+ with [uv](https://docs.astral.sh/uv/), Node 20+.

```bash
# 1. API on :8000, with SQLite and synthetic demo data
cd backend
uv sync
uv run python -m app.seed --demo
uv run uvicorn app.main:app --reload --port 8000

# 2. Web app on :3000 (in a second terminal)
cd frontend
npm install
npm run dev
```

To enable AI bill reading, put `GROQ_API_KEY=...` (or `ANTHROPIC_API_KEY=...`) in `backend/.env`; see `.env.example`. Without a key, bills are read on the device.

Open http://localhost:3000. Demo logins (password `demo1234`):

- `citizen1@lifeline.demo` – citizen with six months of history
- `admin@lifeline.demo` – GEDA admin dashboard

Or register a new account to go through onboarding. Interactive API docs: http://localhost:8000/docs

### With Docker (PostgreSQL)

```bash
docker compose up --build
docker compose exec api python -m app.seed --demo   # optional demo data
```

### Tests

| Suite | Command | Covers |
|---|---|---|
| Backend (49 tests) | `cd backend && uv run pytest` | Footprint, tariff, nudge, solar and points rules; every API flow; rate limits; AI provider error handling; migrations match the models |
| Backend on PostgreSQL | `TEST_DATABASE_URL=postgresql+psycopg://… uv run pytest` | The same suite against Postgres |
| Frontend unit | `cd frontend && npm test` | Bill text parser on realistic OCR output |
| End-to-end | `cd frontend && npm run e2e` | Sign-up → bill scan (real OCR) → actions → leaderboards → solar → profile; admin review; phone layouts |
| Static checks | `npm run lint && npm run typecheck` | ESLint and TypeScript |

GitHub Actions (`.github/workflows/ci.yml`) runs all of these on every push, plus a Docker Compose build and smoke test against PostgreSQL.

## API overview

| Method & path | Purpose |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | JWT auth |
| `POST /api/footprint/preview` | Live footprint calculation (no auth, used by onboarding) |
| `PUT /api/household`, `GET /api/household` | Onboarding answers and baseline |
| `GET/POST /api/readings` | Monthly bill readings vs baseline |
| `POST /api/bills/scan` | Read units from a bill photo (503 when AI isn't configured, so the client reads on-device) |
| `PATCH /api/auth/me` | Update name, district, ward |
| `GET /api/dashboard` | Footprint, points, level, streak, rank, trend, today's challenge |
| `GET /api/nudges` | Contextual nudges for right now |
| `GET /api/actions/types`, `GET /api/actions/today`, `POST /api/actions`, `GET /api/actions/mine` | Action catalogue, daily challenge, logging with optional photo proof |
| `GET /api/leaderboard/users?scope=ward\|district\|state`, `GET /api/leaderboard/districts` | Citizen and district standings |
| `POST /api/solar/estimate` | Rooftop solar sizing, cost, subsidy and payback |
| `GET /api/admin/overview` | Statewide totals plus per-district metrics for the map |
| `GET /api/admin/districts/{id}` | District drill-down: engagement, consumption trend, wards, solar pipeline |
| `GET /api/admin/reviews`, `POST /api/admin/reviews/{id}` | Proof review |

## Data sources and assumptions

These are approximate defaults, all in `factors.py`. Check them against current publications before production use.

| Value | Default | Source |
|---|---|---|
| Grid emission factor | 0.71 kg CO₂/kWh | CEA CO₂ Baseline Database (weighted average, approx.) |
| LPG | 42.3 kg CO₂ per 14.2 kg cylinder | ~2.98 kg CO₂/kg LPG |
| Residential tariff | Slabs ₹3.05–5.20/kWh + ₹2.85 FPPPA | Illustrative Gujarat DISCOM values |
| Peak / solar windows | 18:00–22:00 / 09:00–17:00 IST | Typical ToD windows |
| Solar yield | Live from PVGIS; fallback 1,550 kWh/kWp/yr | EU JRC PVGIS |
| Solar cost / subsidy | ₹60,000/kWp; ₹30k/kW up to 2 kW + ₹18k for the 3rd kW, cap ₹78k | PM Surya Ghar Muft Bijli Yojana |
| AC set-point saving | ~6% per °C | BEE guidance |
| District boundaries | All 33 districts, simplified (128 KB) | [geoBoundaries](https://www.geoboundaries.org) gbOpen IND ADM2 (2021; source: Local Government Directory via Pathways Data), **ODbL 1.0**. Attribution shown on the map. |
| Base map tiles | Esri World Light/Dark Gray Canvas | © Esri, HERE, Garmin, OpenStreetMap contributors. Fine for a demo; production should use a licensed or self-hosted tile service. |

Action savings (for example "Geyser off after use" ≈ 1 kWh) are conservative per-instance estimates.

## Scalability

- **Stateless API.** JWT auth, no server sessions. Scale horizontally behind a load balancer; the Docker image runs multiple Uvicorn workers.
- **Aggregations are grouped SQL queries**, not per-row loops; the admin overview is a fixed number of queries no matter how many districts there are.
- **Next steps at scale:**
  - Redis sorted sets for real-time leaderboards
  - a Redis-backed rate limiter (the current one is per process)
  - materialised daily rollups for admin analytics
  - S3 or object storage with signed URLs for proof images
  - a task queue for scheduled push nudges

## Limitations

- Footprint covers household electricity, cooking gas and commute. Diet, waste and flights are not modelled yet.
- Nudges are rule-based and pulled when the app opens. They are not push notifications.
- Proof review is manual. Tariffs are illustrative rather than pulled from each DISCOM.
- The demo data from `--demo` is synthetic: 360 citizens across all 33 districts.
- Map tiles come from Esri's public canvas service; a production deployment should use its own tile licence or server.

## Roadmap

1. Read the tariff category and sanctioned load from the bill too, for exact per-DISCOM bill estimates.
2. Push and WhatsApp nudges at peak-hour start, using each user's chosen times.
3. Smart-meter / DISCOM API integration for verified monthly consumption, removing manual readings.
4. Auto-verification of photo proof (image classification plus EXIF date and location checks), keeping admins for edge cases.
5. A vendor directory with GEDA-empanelled rooftop installers and a one-tap site-survey request.
6. Gujarati and Hindi interfaces.
