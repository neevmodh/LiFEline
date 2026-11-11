# Nidhi roadmap

The build plan for the HackCult '26 finale (14 Nov 2026). The same items are tracked as GitHub issues, created by `scripts/create_github_issues.py`.

Nidhi turns Mission LiFE awareness into measurable action for Gujarat: a personal footprint, an Action Engine that picks what matters for each home, rewards and community, solar adoption, and a GEDA console for regional monitoring. Mobile app first (Expo: Android, iPhone, web), Next.js for the landing page and GEDA console, FastAPI + PostgreSQL behind both.

**Principles:** real data only (estimated, self-reported and verified impact kept apart); privacy floor of 5 households; Gujarati first-class.

| Borrowed from | Idea | In Nidhi |
|---|---|---|
| Opower | Neighbour comparison | Homes like yours |
| Meri LiFE (MoEFCC) | 7 LiFE themes | Every action tagged by theme |
| JouleBug | Action cards, team challenges | Action cards with reasons |
| Duolingo | Streaks, weekly leagues | Streaks + community leagues |
| Ant Forest | Points grow a tree | Nidhi tree (visual only) |
| Strava clubs | Clubs, head-to-head | Communities + duels |
| OhmConnect | Peak power hours | GEDA Peak Hour Challenge |
| Project Sunroof / PM Surya Ghar | Roof to subsidy | Solar Advisor + registered vendors |

## Day 1 · 11 Nov

### 1. LiFE themes column and a ~20-action catalogue with sourced impact
*Labels: backend, must*

#### Goal
Tag every green action with one of the 7 official Mission LiFE themes (Meri LiFE, MoEFCC) and grow the catalogue from 12 to about 20 actions, so the app covers energy, water, single-use plastic, food, waste, e-waste and healthy lifestyle.

#### Acceptance criteria
- [ ] `action_types.theme` column with an Alembic migration
- [ ] About 20 actions; each kWh or CO2 figure cites a source in `services/factors.py`
- [ ] Actions without a defensible figure award points only and say "impact not estimated"
- [ ] Titles and descriptions in `app/locales/en.json` (gu/hi via #16)

#### Files
- `backend/app/models.py`
- `backend/app/seed.py`
- `backend/app/services/factors.py`
- `backend/migrations/versions/`

#### Tests
- [ ] Every action has a theme from the 7
- [ ] Every CO2 figure has a source or is null
- [ ] Migration matches the models

### 2. Action Engine: services/engine.py + GET /api/engine/today
*Labels: backend, must*

#### Goal
Rank actions for each household, so "Today's 3" are the ones that matter most for this home right now, each with a plain reason. Rules and real data decide; nothing is guessed.

#### Acceptance criteria
- [ ] Score = personal rupee/CO2 impact x relevance (household fit, season and temperature, peak or green hour) x novelty (not done recently) / effort
- [ ] Each card returns a "because ..." reason built from the numbers used
- [ ] Pure function, no database access inside the scoring
- [ ] `GET /api/engine/today` returns the ranked list with today's top 3 marked

#### Files
- `backend/app/services/engine.py`
- `backend/app/routers/engine.py`
- `reuses services/plan.py, impact.py, green_hours.py, weather.py`

#### Tests
- [ ] Hot day lifts AC actions
- [ ] Evening lifts load-shifting
- [ ] Recently done actions drop
- [ ] Actions that don't apply never appear

### 3. LiFE Score + "homes like yours": GET /api/me/score
*Labels: backend, must*

#### Goal
Give every citizen one number (0-100) and an Opower-style comparison with similar homes in their district, the nudge with the strongest evidence for cutting electricity use.

#### Acceptance criteria
- [ ] Published formula combining footprint vs peers, weekly consistency and verified share
- [ ] Peer group: same district, similar household size and AC count; shown only with 5 or more homes, else compared with the household's own baseline
- [ ] `GET /api/me/score` returns score, parts, peer comparison and group size
- [ ] Formula shown on the methodology page

#### Files
- `backend/app/services/score.py`
- `backend/app/routers/me.py`

#### Tests
- [ ] Hand-computed score for a fixture household
- [ ] Peer group below 5 falls back to own baseline
- [ ] No other household's data is exposed

### 4. Impact Ledger: personal and community, estimated vs self-reported vs verified
*Labels: backend, must*

#### Goal
Show impact honestly: what the model estimates, what people reported, and what GEDA verified from photos are always kept apart.

#### Acceptance criteria
- [ ] `GET /api/me/ledger`: kWh, CO2 and rupees by theme and by status
- [ ] `GET /api/communities/{id}/ledger`: the same, summed for a community (hidden below 5 members)
- [ ] Estimated figures come from the plan; reported and verified from `action_logs.status`

#### Files
- `backend/app/routers/me.py`
- `backend/app/routers/societies.py`

#### Tests
- [ ] Rejected actions count nowhere
- [ ] Verified and self-reported never mix
- [ ] Community ledger hidden below 5 members

### 5. Community kinds: society, college, school, office, ward
*Labels: backend, must*

#### Goal
Let colleges, schools and offices take part as well as housing societies, as Strava does with clubs.

#### Acceptance criteria
- [ ] `societies.kind` column with a migration; default `society`
- [ ] Create and join accept and return `kind`
- [ ] Leaderboard filters by kind within a district

#### Files
- `backend/app/models.py`
- `backend/app/routers/societies.py`
- `backend/app/schemas.py`

#### Tests
- [ ] Existing societies migrate as `society`
- [ ] Invalid kind is rejected

### 6. Expo push tokens + sending through /api/internal/push/run
*Labels: backend, should*

#### Goal
Send the existing alerts (Green Hours, evening peak, bill reminder) to the phone app as well as the web.

#### Acceptance criteria
- [ ] Store Expo push tokens next to web-push subscriptions
- [ ] The scheduler sends to Expo tokens via the Expo push API, with the same daily cap and language
- [ ] Invalid tokens are removed

#### Files
- `backend/app/routers/push.py`
- `backend/app/services/push.py`
- `backend/app/models.py`

#### Tests
- [ ] Expo send mocked: payload, cap of 2 a day, removal of dead tokens

### 7. Expo app scaffold: router, theme, API client, i18n, auth
*Labels: mobile, must*

#### Goal
Start the citizen app in `mobile/`: one codebase for Android, iPhone and web.

#### Acceptance criteria
- [ ] Expo SDK 58 with expo-router, TypeScript and TanStack Query
- [ ] Design tokens: GEDA navy, green and saffron, large readable numbers
- [ ] API client and types from `web/src/lib/api.ts`; token in expo-secure-store (localStorage on web)
- [ ] English, Gujarati, Hindi catalogues shared with the web app
- [ ] Sign in and sign up; role decides where you land

#### Files
- `mobile/`

#### Tests
- [ ] `npx tsc --noEmit` clean
- [ ] `npx expo export -p web` builds

### 8. Onboarding with a bill photo -> baseline footprint
*Labels: mobile, must*

#### Goal
A two-minute start: household, location, lifestyle and a photo of the electricity bill give the baseline footprint.

#### Acceptance criteria
- [ ] Bill photo with expo-image-picker, read by `POST /api/bills/scan`; units and DISCOM prefilled
- [ ] Household questions with sensible defaults; district suggests the DISCOM
- [ ] Footprint preview updates as you answer
- [ ] Answers from a free check carry over

#### Files
- `mobile/app/(auth)/`
- `mobile/components/`

#### Tests
- [ ] Onboarding completes on web and Android
- [ ] Footprint matches `POST /api/footprint/preview`

### 9. Home: LiFE Score, homes like yours, today's 3 actions, streak, Nidhi tree
*Labels: mobile, must*

#### Goal
One glance answers: how am I doing, how do I compare, what should I do today.

#### Acceptance criteria
- [ ] Score and peer comparison from #3
- [ ] Today's 3 actions from #2, each with its reason and a one-tap log
- [ ] Streak and the Nidhi tree growing with verified impact (visual only)
- [ ] Green Hours today or tomorrow

#### Files
- `mobile/app/(tabs)/index.tsx`

#### Tests
- [ ] Renders with no data, with a new user, and with history
- [ ] No horizontal scroll at 390 px

### 24. Create an Expo account and run npx eas login
*Labels: user-action, must*

#### Goal
Needed to build the Android APK in Expo's cloud. Only the owner should create the account and type the password.

#### Acceptance criteria
- [ ] Free account at expo.dev
- [ ] Run `npx eas login` in the terminal
- [ ] Tell Claude it is done

### 25. Rotate the exposed Supabase, Adaption and Groq keys
*Labels: user-action, must*

#### Goal
These were pasted in chat earlier. Rotate them and update Render and the local .env.

#### Acceptance criteria
- [ ] New Supabase database password and secret key
- [ ] New Adaption key (or delete it from Render)
- [ ] New Groq key
- [ ] Render and backend/.env updated

## Day 2 · 12 Nov

### 10. Act tab: engine cards, log with photo proof, challenges, points and badges
*Labels: mobile, must*

#### Goal
Turn intent into action, JouleBug-style: clear cards, quick logging, fair points.

#### Acceptance criteria
- [ ] All ranked actions by theme, with effort, rupees, CO2, points and proof rule
- [ ] Log instantly for 40% of points; add a photo for full points after review
- [ ] Daily statewide challenge at 2x points
- [ ] Points, level and badges update after logging

#### Files
- `mobile/app/(tabs)/act.tsx`

#### Tests
- [ ] Duplicate photo is refused
- [ ] Daily limits respected
- [ ] Offline log is queued and sent later

### 11. Community tab: my community, weekly league, district, campaigns
*Labels: mobile, must*

#### Goal
Make saving social: your society or college, its goal and league position, your district, and active campaigns.

#### Acceptance criteria
- [ ] Join with a code or start a community (with kind)
- [ ] Goal progress, announcements and weekly league within the district (Duolingo-style)
- [ ] District standing and active GEDA campaigns
- [ ] Totals hidden below 5 households

#### Files
- `mobile/app/(tabs)/community.tsx`

#### Tests
- [ ] Join, leave, and committee views
- [ ] Privacy floor of 5 respected

### 12. Head-to-head duels between communities: API and UI
*Labels: backend, mobile, should*

#### Goal
Two societies or colleges compete for 30 days on a defensible metric.

#### Acceptance criteria
- [ ] `duels` table and endpoints: challenge, accept, standings
- [ ] Metric: CO2 avoided per member, counted only when 40% or more of members are active
- [ ] Duel card on the Community tab

#### Files
- `backend/app/routers/duels.py`
- `mobile/app/(tabs)/community.tsx`

#### Tests
- [ ] Participation floor applied
- [ ] Only committees can start or accept a duel

### 13. Peak Hour Challenge events (campaign kind="peak")
*Labels: backend, mobile, should*

#### Goal
GEDA schedules evening peak events; citizens opt in and shift heavy loads, OhmConnect-style but without money.

#### Acceptance criteria
- [ ] Campaign `kind="peak"` with a time window (reuse `routers/campaigns.py`)
- [ ] Counts `shift_heavy_load` logged for the event
- [ ] Shown on Home and Community while live; push reminder 30 minutes before

#### Files
- `backend/app/routers/campaigns.py`
- `mobile/`

#### Tests
- [ ] Only actions inside the window count

### 14. Solar tab: advisor, subsidy, payback, how to apply, registered vendors
*Labels: mobile, must*

#### Goal
Take a citizen from "is solar worth it?" to the official application.

#### Acceptance criteria
- [ ] System size from roof and use, PVGIS yield for the district, DISCOM tariff savings
- [ ] PM Surya Ghar subsidy, net cost, payback and 25-year gain
- [ ] How to apply in Gujarat (national portal, DISCOM feasibility, net meter)
- [ ] Link to the government list of registered vendors

#### Files
- `mobile/app/(tabs)/solar.tsx`
- `reuses POST /api/solar/estimate`

#### Tests
- [ ] Numbers match the API for a fixture roof

### 15. Me tab: Impact Ledger, badges, language, data export and delete
*Labels: mobile, must*

#### Goal
Your record and your data, in your hands.

#### Acceptance criteria
- [ ] Impact Ledger from #4: estimated vs reported vs verified, by theme
- [ ] Badges and level
- [ ] Language switch; download all my data; delete account and photos

#### Files
- `mobile/app/(tabs)/me.tsx`

#### Tests
- [ ] Export downloads JSON
- [ ] Delete removes the account and signs out

### 16. Gujarati and Hindi for all new strings
*Labels: mobile, should*

#### Goal
Every new screen in Gujarati and Hindi, generated with Adaption and checked for placeholders.

#### Acceptance criteria
- [ ] Run `backend/tools/translate_with_adaption.py --missing --run`
- [ ] No broken `{placeholders}`
- [ ] Native-speaker check of the main screens (see #26)

#### Files
- `web/src/i18n/`
- `backend/app/locales/`

#### Tests
- [ ] i18n tests pass

## Day 3 · 13 Nov

### 17. GEDA console: funnel, themes, communities and duels, campaigns and peak events
*Labels: geda-web, backend, must*

#### Goal
Give GEDA what it needs to run the programme across Gujarat.

#### Acceptance criteria
- [ ] `GET /api/admin/funnel`: registered, onboarded, active this week, verified
- [ ] `GET /api/admin/themes`: actions and impact by LiFE theme
- [ ] `GET /api/admin/communities`: communities by kind, top performers, duels
- [ ] Create and manage campaigns and peak events from the console
- [ ] District officers see only their district

#### Files
- `backend/app/routers/admin.py`
- `web/src/app/geda/`

#### Tests
- [ ] Officer scoping enforced
- [ ] Console e2e test extended

### 18. Landing page: APK QR, open web app, GEDA sign-in; retire Next.js citizen pages
*Labels: geda-web, must*

#### Goal
One public front door: get the app, use it on the web, or sign in as GEDA.

#### Acceptance criteria
- [ ] QR code and link for the Android APK; button to open the web app
- [ ] GEDA sign-in link
- [ ] Remove the Next.js citizen pages now covered by the Expo app

#### Files
- `web/src/app/page.tsx`
- `web/src/app/(app)/`
- `web/src/app/join/`

#### Tests
- [ ] Landing e2e test
- [ ] No dead links

### 19. Deploy: merge rebuild to main, Render API, Vercel console + Expo web, EAS APK
*Labels: deploy, must*

#### Goal
Everything live and installable before the finale.

#### Acceptance criteria
- [ ] Merge `rebuild` into `main`; retire the old `frontend/`
- [ ] Render API redeployed; migrations applied to Supabase
- [ ] Vercel: console and landing at nidhi-gujarat; Expo web on a second project
- [ ] Android APK from `eas build -p android --profile preview`, linked from the landing page
- [ ] CORS allows both web origins

#### Files
- `render.yaml`
- `web/vercel.json`
- `mobile/eas.json`

#### Tests
- [ ] Health check ok
- [ ] APK installs and signs in
- [ ] Web app signs in

### 20. Tagged demo data for communities and duels, loaded live
*Labels: deploy, must*

#### Goal
Make maps, leagues and duels look alive for the finale, clearly marked as demo.

#### Acceptance criteria
- [ ] Extend `backend/tools/seed_demo.py`: community kinds, a college, active duels, a peak event
- [ ] Every demo name carries "ડેમો"; removable with `--remove`
- [ ] Loaded on the live database after deploy

#### Files
- `backend/tools/seed_demo.py`

#### Tests
- [ ] Local run creates and removes everything cleanly

### 21. Full test pass + README with architecture diagram and DB schema
*Labels: docs, must*

#### Goal
Show the judges the engineering (40% of the score) and the architecture (30%).

#### Acceptance criteria
- [ ] Backend, mobile and console tests all green in CI
- [ ] README: what it does, architecture diagram, database schema, setup, limits
- [ ] Methodology page lists every factor and source

#### Files
- `README.md`
- `docs/`

#### Tests
- [ ] CI green on main

### 26. Test the APK on an Android phone + Gujarati review
*Labels: user-action, should*

#### Goal
A real phone and a native speaker catch what tests cannot.

#### Acceptance criteria
- [ ] Install the APK from the landing page QR
- [ ] Sign up, log an action with a photo, join a community
- [ ] A Gujarati speaker checks the main screens

## Finale · 14 Nov

### 22. 10-slide deck, demo script and 2-3 minute video
*Labels: docs, must*

#### Goal
Ready for the 5-minute stage pitch, 3-minute Q&A and the booth.

#### Acceptance criteria
- [ ] Deck: problem, solution, live demo flow, architecture, schema, tech stack, scalability, limits, roadmap
- [ ] Booth demo script and the Q&A bank updated
- [ ] 2-3 minute video of the real app

#### Files
- `docs/`

### 23. Stretch: AI weekly coach and Nidhi tree animation
*Labels: backend, mobile, stretch*

#### Goal
A weekly note written by AI from the citizen's own computed numbers, and a growing-tree animation.

#### Acceptance criteria
- [ ] `GET /api/coach/weekly` via the existing Groq key; numbers come only from the API; template fallback
- [ ] Labelled "written by AI from your numbers"
- [ ] Tree animation respects reduced motion

#### Files
- `backend/app/routers/coach.py`
- `mobile/components/`

#### Tests
- [ ] Coach never states a number that is not in its input
