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
| ✅ **Honest points** | Log an action instantly for 40% of its points; add a photo that GEDA verifies for the full 100%. Each photo is fingerprinted, so the same picture (even resized) can't back two claims, and an AI pre-screens photos for reviewers. |
| 🌡️ **Real savings, not weather** | A cooler month isn't a saving. LiFEline fits each household's bills against observed heat (cooling degree days from the Open-Meteo archive) and shows how far a bill came in under what the weather alone predicts, and flags months well above it. |
| 🧮 **Savings for your home** | Every action's saving is worked out from your household: "bus instead of car" uses your commute distance, the AC set-point uses how many ACs you have, and actions that don't fit your home are switched off. Bills use your own DISCOM's GERC tariff. |
| ☀️ **Solar with real numbers** | Rooftop sizing from satellite solar data for your district (PVGIS), net-metered savings, the PM Surya Ghar subsidy, payback, and 25-year gain. |
| 🗺️ **A state view for GEDA** | An interactive map of all 33 districts with real boundaries. Click any district to see its engagement, falling (or rising) household consumption, leading wards, and its rooftop solar pipeline, including the subsidy it needs. |

## Try it in 2 minutes

You need Python 3.11+ with [uv](https://docs.astral.sh/uv/) and Node 20+.

```bash
# Terminal 1: API (creates the database, the 33 districts and the action catalogue)
cd backend && uv sync && uv run uvicorn app.main:app --port 8000

# Once, in another terminal: create a GEDA administrator (prompts for a password)
cd backend && uv run python -m app.create_admin --email you@example.com --name "Your Name"

# Terminal 2: web app
cd frontend && npm install && npm run dev
```

Open **http://localhost:3000/register**, sign up as a citizen and scan your electricity bill. Sign in with the admin account to see the GEDA view.

There is **no sample or synthetic data**. Every citizen, reading and action comes from a real person using the app, and every factor and tariff is listed with its source on the app's **How we calculate** page (`/methodology`).

## Tour

### For citizens

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/onboarding-bill-scan.png" alt="Onboarding with a scanned electricity bill">
      <p><b>Snap your bill.</b> A two-month bill of 540 units becomes 266 kWh per month, and the footprint updates live as you answer.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/dashboard.png" alt="Citizen dashboard">
      <p><b>Your dashboard.</b> Footprint, streak, district rank, today's statewide challenge and the nudges that matter right now.</p>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <img src="docs/screenshots/community.png" alt="Community leaderboards and district goals map">
      <p><b>Community.</b> Ward, district and state leaderboards, plus every district's progress towards its monthly goal on a real map.</p>
    </td>
    <td valign="top">
      <img src="docs/screenshots/solar.png" alt="Rooftop solar calculator">
      <p><b>Rooftop solar.</b> System size from your roof and usage, live solar yield for your district, subsidy, net cost and payback.</p>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <img src="docs/screenshots/actions.png" alt="Green actions catalogue">
      <p><b>Green actions.</b> Twelve everyday actions across energy, travel, cooking, waste, water, nature and solar. Add a photo for full points.</p>
    </td>
    <td valign="top" align="center">
      <img src="docs/screenshots/mobile-dashboard.png" alt="Dashboard on a phone" width="300">
      <p><b>Works on a phone</b>, with a bottom tab bar and the camera for bill scans.</p>
    </td>
  </tr>
</table>

### For GEDA

<img src="docs/screenshots/admin-explorer-light.png" alt="District explorer showing untapped rooftop solar by district, with Ahmedabad's details" width="920">

**District explorer.** Colour all 33 districts by CO₂ avoided, participation, CO₂ per citizen, average footprint or untapped rooftop solar. Clicking a district shows:
- its engagement and how many heavy loads moved out of peak hours
- whether average household electricity use is falling
- its leading wards
- its rooftop solar pipeline: suitable roofs, kW, clean power, CO₂, and the PM Surya Ghar subsidy it would need

The rest of the page has weekly trends, impact by action type, a district table (including districts not reached yet) and the photo-proof review queue.

<details>
<summary>Dark mode</summary>
<img src="docs/screenshots/admin-explorer-dark.png" alt="District explorer in dark mode" width="920">
</details>

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| **Web app** | [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript | Typed, fast client navigation, one codebase for phone and desktop |
| **Styling** | Tailwind CSS v4, Geist font | Theme tokens with light and dark mode |
| **Charts** | Recharts 3 | Accessible SVG charts with tooltips |
| **Maps** | Leaflet 1.9 + react-leaflet 5, Esri canvas tiles | Real district boundaries, with labels drawn above the colours |
| **On-device OCR** | Tesseract.js 7 | Reads bills without uploading them when there's no AI key |
| **API** | [FastAPI](https://fastapi.tiangolo.com), Python 3.12, Pydantic v2 | Typed request and response models, automatic OpenAPI docs at `/docs` |
| **Database** | PostgreSQL 16 (SQLite for local dev), SQLAlchemy 2, Alembic | Versioned migrations; the same code runs on both databases |
| **Auth & security** | JWT (PyJWT), bcrypt, per-IP/email rate limits | Stateless, so it scales horizontally |
| **AI bill reading** | Groq (Qwen 3.8 vision, strict JSON schema) or Claude (structured output) | About 1 s per bill; output validated against a schema, never scraped from free text |
| **Open data** | PVGIS (solar yield), Open-Meteo (weather), geoBoundaries (districts) | Real inputs, with timeouts and offline fallbacks |
| **Testing** | pytest (50), Vitest (6), Playwright (3 end-to-end) | Backend tested on SQLite **and** PostgreSQL |
| **Delivery** | GitHub Actions, Docker Compose, uv | CI runs every suite plus a Docker smoke test on every push |

## Project structure

```
LiFEline/
├── backend/                      FastAPI service
│   ├── app/
│   │   ├── routers/              auth · household · actions · engage · admin
│   │   ├── services/             footprint · nudges · solar · gamification · bill_scan
│   │   │                         weather · stats · factors (every assumption in one file)
│   │   ├── models.py             SQLAlchemy models
│   │   ├── schemas.py            Pydantic request/response models
│   │   ├── seed.py               33 districts (with their DISCOM) and the action catalogue
│   │   └── create_admin.py       Create a GEDA administrator
│   ├── migrations/               Alembic migrations
│   └── tests/                    pytest suite
├── frontend/                     Next.js app
│   ├── src/app/                  landing · login/register · (citizen)/… · admin
│   ├── src/components/           UI kit, Gujarat map, charts, bill scanner, district explorer
│   ├── src/lib/                  typed API client, auth, bill text parser
│   ├── public/geo/               Gujarat district boundaries (GeoJSON)
│   ├── e2e/                      Playwright tests
│   └── scripts/                  README screenshot capture
├── docs/screenshots/
├── docker-compose.yml            PostgreSQL + API + web
└── .github/workflows/ci.yml
```

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

## Setup in detail

### Local development

The [Try it](#try-it-in-2-minutes) commands are all you need. A few more details:

- The API creates the schema with Alembic migrations on first start and loads the 33 districts and the action catalogue.
- Interactive API docs: http://localhost:8000/docs
- Copy `backend/.env.example` to `backend/.env` to change settings (below). To turn on AI bill reading, set `GROQ_API_KEY` there.

### With Docker (PostgreSQL)

```bash
docker compose up --build --wait
docker compose exec api python -m app.create_admin --email you@example.com --name "Your Name"
```

### Deployed (Vercel + Render + Supabase)

- **Web app on Vercel:** import the repository, set the root directory to `frontend` and `NEXT_PUBLIC_API_URL` to the Render URL. Region Mumbai (`frontend/vercel.json`).
- **API on Render:** New → Blueprint picks up `render.yaml` (Docker, Singapore, health check on `/api/health`, migrations on start). Fill in the secret values in Render's dashboard; `CORS_ORIGINS` is the Vercel URL as a JSON list.
- **Database and photo storage on Supabase**, as below.

Every push to `main` redeploys both.

### With Supabase

LiFEline runs on [Supabase](https://supabase.com) Postgres and Storage with no code changes:

1. Create a project, and a **private** Storage bucket called `proofs`.
2. In `backend/.env` set:
   - `DATABASE_URL`: the **transaction pooler** string (port 6543), with the `postgresql+psycopg://` prefix. LiFEline turns off prepared statements for it automatically.
   - `MIGRATION_DATABASE_URL`: the **session pooler** string (same host, port 5432), used for migrations. (The direct connection is IPv6-only, which many networks lack.)
   - `STORAGE_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the `sb_secret_…` key; server-side only).
   - Or run `python3 scripts/set_supabase_secrets.py` to enter the password and key with hidden input (passwords are URL-encoded for you).
3. Start the API. Migrations turn on **Row Level Security** for every table with no policies, so Supabase's public REST API (anon and authenticated keys) can't read or write anything; only the API's own database role can.

The API container migrates and loads reference data once, then starts two Uvicorn workers.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./lifeline.db` | Any SQLAlchemy URL, for example `postgresql+psycopg://user:pass@host/db` |
| `JWT_SECRET` | dev-only value | **Set a long random secret in production** |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed web origins |
| `GROQ_API_KEY` | none | Enables AI bill reading with Groq (used first if set) |
| `GROQ_MODEL` | `qwen/qwen3.8-27b` | Groq vision model |
| `ANTHROPIC_API_KEY` | none | Enables AI bill reading with Claude instead |
| `ENABLE_EXTERNAL_APIS` | `true` | Set to `false` to run fully offline (PVGIS and Open-Meteo fall back to defaults) |
| `AUTO_MIGRATE` | `true` | Migrate on startup; Docker sets this to `false` and migrates before the workers start |
| `UPLOAD_DIR` | `uploads` | Where proof photos are stored when `STORAGE_BACKEND=local` |
| `STORAGE_BACKEND` | `local` | `supabase` keeps proof photos in a private Supabase Storage bucket |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | none, none, `proofs` | Supabase Storage (service key stays on the server) |
| `MIGRATION_DATABASE_URL` | none | Direct database connection for migrations when `DATABASE_URL` is a pooler |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Read by uvicorn. Behind a reverse proxy or hosting platform, set this to the proxy's address (or `*` if the API is only reachable through it) so rate limits see each user's real IP rather than the proxy's |
| `NEXT_PUBLIC_API_URL` (web) | `http://localhost:8000` | API address for the web app |

### Screenshots

The images in this README come from the running app: `cd frontend && npm run screenshots` with a citizen and an admin account (see the script header).

## Tests

| Suite | Command | Covers |
|---|---|---|
| Backend (108 tests) | `cd backend && uv run pytest` | Translations and the Adaption pipeline's safety checks, footprint, per-DISCOM bills, personalised action impact, weather-adjusted savings model and climate cache, nudge, solar and points rules; duplicate and fake photo rejection; ward normalisation; AI screening; every API flow; rate limits; migrations match the models |
| Backend on PostgreSQL | `TEST_DATABASE_URL=postgresql+psycopg://… uv run pytest` | The same suite against Postgres |
| Frontend unit (7 tests) | `cd frontend && npm test` | Bill text parser on realistic OCR output, plus an accuracy test on **254 Adaption-generated Gujarat bills** (every DISCOM, Gujarati labels, OCR noise, readings-only bills; each verified against its own text). On-device reader: units **100%**, billing days 95%, amount 92% (was 7% / 91% / 13% before tuning). |
| End-to-end (3 journeys) | `cd frontend && npm run e2e` | Sign-up → bill scan (real OCR) → actions with photo proof → reused photo rejected → leaderboards and goals map → solar → profile; admin district explorer (33 districts, metric switching, tooltips) and proof review; phone layouts. No sample data: users are created through the app. |
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
| `GET /api/admin/reviews`, `POST /api/admin/reviews/{id}` | Proof review, with the AI pre-screen verdict |
| `GET /api/config` | Peak and solar hours, DISCOMs, and every factor with its source |
| `GET /api/insights/weather` | Weather-adjusted savings for each month, and how the weather model was learned |

## Languages

The citizen app runs in **English, Gujarati (ગુજરાતી) and Hindi (हिन्दी)**, switchable from the header. GEDA's admin view stays in English.

- English is the source: `frontend/src/i18n/en.json` (UI) and `backend/app/locales/en.json` (action names, nudges, reasons, which the API returns in the language of the request's `Accept-Language`).
- Gujarati and Hindi are generated with [Adaption](https://adaptionlabs.ai)'s dataset translation API by `backend/tools/translate_with_adaption.py`: every string becomes a dataset row, Adaption translates the dataset, and the script maps rows back by id, recognises the language by its script, and keeps a translation only if its `{placeholders}` match the English. `translations.meta.json` records the Adaption dataset ids and whether a native speaker has reviewed the result.
- Any missing or rejected string falls back to English, so a partial translation never breaks a screen.

```bash
cd backend
uv run --with adaption python tools/translate_with_adaption.py           # cost estimate only
uv run --with adaption python tools/translate_with_adaption.py --run     # translate (needs ADAPTION_API_KEY in .env)
```

## Data sources and assumptions

Every figure lives in `backend/app/services/factors.py` with its source, and the app serves the same list at `GET /api/config` and on its **How we calculate** page, so the documentation can't drift from the code.

| Value | Figure | Source |
|---|---|---|
| Grid emission factor | 0.710 kg CO₂/kWh; peak-hour operating margin 0.964 | CEA CO₂ Baseline Database v21.0, FY 2024-25 |
| LPG | 42.3 kg CO₂ per 14.2 kg cylinder | IPCC 2006 default for LPG |
| Tariffs | State DISCOMs urban ₹3.05 / 3.50 / 4.15 / 5.20 and rural ₹2.65 / 3.10 / 3.75 / 4.90 per unit (0-50 / 51-100 / 101-250 / 250+), Torrent Power ₹3.20 / 3.95 / 5.00; fixed charge; FPPAS ₹2.45/unit; duty 15% urban, 7.5% rural | GERC tariff schedules effective 1 April 2026 |
| Peak / solar windows | 18:00–22:00 / 09:00–17:00 IST | Gujarat evening peak and solar window |
| Solar yield | Live from PVGIS; fallback 1,550 kWh/kWp/yr | EU JRC PVGIS 5.2 |
| Solar cost | ₹50,000/kW up to 2 kW, ₹45,000/kW above | Government of Gujarat benchmark cost |
| Solar subsidy | ₹30k/kW up to 2 kW + ₹18k for the 3rd kW, cap ₹78k | PM Surya Ghar: Muft Bijli Yojana |
| AC set-point saving | 6% per °C | BEE |
| District boundaries | All 33 districts, simplified (128 KB) | [geoBoundaries](https://www.geoboundaries.org) gbOpen IND ADM2 (2021; source: Local Government Directory via Pathways Data), **ODbL 1.0**. Attribution shown on the map. |
| Base map tiles | Esri World Light/Dark Gray Canvas | © Esri, HERE, Garmin, OpenStreetMap contributors. Production should use a licensed or self-hosted tile service. |

**Weather adjustment** (`services/weather_norm.py`): monthly kWh = base load + slope × cooling degree days (daily mean temperature above 24°C, summed over the month, from the [Open-Meteo historical archive](https://open-meteo.com/en/docs/historical-weather-api) for the household's district). The slope is a least-squares fit on the household's own bills once it has three months with at least 20 degree days of difference. Until then it uses a within-household pooled fit across its district, then the state. Negative fits are clipped to zero. Completed months of weather are cached in the `climate_months` table.

Action savings are computed for each household in `services/impact.py` from these figures and the household's own answers. The few household-independent actions (plastic, water, a sapling's first year) use fixed, documented estimates.

## Scalability

- **Stateless API.** JWT auth, no server sessions. Scale horizontally behind a load balancer; the Docker image runs multiple Uvicorn workers.
- **Aggregations are grouped SQL queries**, not per-row loops; the admin overview is a fixed number of queries no matter how many districts there are.
- **Next steps at scale:**
  - Redis sorted sets for real-time leaderboards
  - a Redis-backed rate limiter (the current one is per process)
  - materialised daily rollups for admin analytics
  - a task queue for scheduled push nudges

## Limitations

- Footprint covers household electricity, cooking gas and commute. Diet, waste and flights are not modelled yet.
- Nudges are rule-based and pulled when the app opens. They are not push notifications.
- A person approves every proof; the AI only pre-screens. Commute emission factors per passenger-km are approximate.
- Fixed charges assume a single-phase connection up to 2 kW; the sanctioned load isn't read from the bill yet.
- Map tiles come from Esri's public canvas service; a production deployment should use its own tile licence or server.

## Roadmap

1. Read the sanctioned load from the bill too, for exact fixed charges.
2. Push and WhatsApp nudges at peak-hour start, using each user's chosen times.
3. Smart-meter / DISCOM API integration for verified monthly consumption, removing manual readings.
4. EXIF date and location checks on photo proof, alongside the AI pre-screen and duplicate check.
5. A one-tap site-survey request to GEDA-empanelled rooftop installers.
6. Gujarati and Hindi interfaces.

---

<div align="center">

Built for **HackCult '26** · Mission LiFE · Gujarat Energy Development Agency<br/>
District boundaries © geoBoundaries (ODbL) · Solar data © EU JRC PVGIS · Weather by Open-Meteo · Base map © Esri

</div>
