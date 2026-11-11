#!/usr/bin/env python3
"""Create the Nidhi build plan on GitHub: labels, milestones, 26 issues and one epic.

Run it yourself (it uses your own `gh` login):

    python3 scripts/create_github_issues.py            # dry run: prints what it would create
    python3 scripts/create_github_issues.py --apply    # creates everything on neevmodh/Nidhi-LiFE

Safe to run twice: labels are upserted, milestones and issues with the same title are reused.
The same plan is kept in the repo at docs/ROADMAP.md.
"""

import json
import subprocess
import sys

REPO = "neevmodh/Nidhi-LiFE"

LABELS = [
    ("backend", "0E8A16", "FastAPI, database, domain services"),
    ("mobile", "1D76DB", "Expo app for Android, iPhone and web"),
    ("geda-web", "5319E7", "Next.js landing page and GEDA console"),
    ("deploy", "FBCA04", "Render, Vercel, EAS builds, live data"),
    ("docs", "C5DEF5", "README, architecture, deck, video"),
    ("must", "B60205", "Required for the finale"),
    ("should", "D93F0B", "Strongly wanted if time allows"),
    ("stretch", "BFD4F2", "Nice to have"),
    ("user-action", "F9D0C4", "Only the project owner can do this"),
    ("epic", "000000", "Tracks the whole build"),
]

D1, D2, D3, FIN = "Day 1 · 11 Nov", "Day 2 · 12 Nov", "Day 3 · 13 Nov", "Finale · 14 Nov"
MILESTONES = [
    (D1, "2026-11-11T18:29:59Z", "Backend foundations and the Expo app scaffold"),
    (D2, "2026-11-12T18:29:59Z", "Citizen app: Act, Community, Solar, Me"),
    (D3, "2026-11-13T18:29:59Z", "GEDA console, deploy, deck and video"),
    (FIN, "2026-11-14T03:29:59Z", "Ready for the booth and the stage at IIT Gandhinagar"),
]


def body(goal, accept, files, tests):
    lines = ["## Goal", goal, "", "## Acceptance criteria", *[f"- [ ] {a}" for a in accept]]
    if files:
        lines += ["", "## Files", *[f"- `{f}`" for f in files]]
    if tests:
        lines += ["", "## Tests", *[f"- [ ] {t}" for t in tests]]
    lines += ["", "Part of the Nidhi build plan (see the epic and `docs/ROADMAP.md`)."]
    return "\n".join(lines)


ISSUES = [
    # ---------------- Day 1 ----------------
    ("LiFE themes column and a ~20-action catalogue with sourced impact", ["backend", "must"], D1, body(
        "Tag every green action with one of the 7 official Mission LiFE themes (Meri LiFE, MoEFCC) and grow the catalogue from 12 to about 20 actions, so the app covers energy, water, single-use plastic, food, waste, e-waste and healthy lifestyle.",
        ["`action_types.theme` column with an Alembic migration",
         "About 20 actions; each kWh or CO2 figure cites a source in `services/factors.py`",
         "Actions without a defensible figure award points only and say \"impact not estimated\"",
         "Titles and descriptions in `app/locales/en.json` (gu/hi via #16)"],
        ["backend/app/models.py", "backend/app/seed.py", "backend/app/services/factors.py", "backend/migrations/versions/"],
        ["Every action has a theme from the 7", "Every CO2 figure has a source or is null", "Migration matches the models"])),
    ("Action Engine: services/engine.py + GET /api/engine/today", ["backend", "must"], D1, body(
        "Rank actions for each household, so \"Today's 3\" are the ones that matter most for this home right now, each with a plain reason. Rules and real data decide; nothing is guessed.",
        ["Score = personal rupee/CO2 impact x relevance (household fit, season and temperature, peak or green hour) x novelty (not done recently) / effort",
         "Each card returns a \"because ...\" reason built from the numbers used",
         "Pure function, no database access inside the scoring",
         "`GET /api/engine/today` returns the ranked list with today's top 3 marked"],
        ["backend/app/services/engine.py", "backend/app/routers/engine.py", "reuses services/plan.py, impact.py, green_hours.py, weather.py"],
        ["Hot day lifts AC actions", "Evening lifts load-shifting", "Recently done actions drop", "Actions that don't apply never appear"])),
    ("LiFE Score + \"homes like yours\": GET /api/me/score", ["backend", "must"], D1, body(
        "Give every citizen one number (0-100) and an Opower-style comparison with similar homes in their district, the nudge with the strongest evidence for cutting electricity use.",
        ["Published formula combining footprint vs peers, weekly consistency and verified share",
         "Peer group: same district, similar household size and AC count; shown only with 5 or more homes, else compared with the household's own baseline",
         "`GET /api/me/score` returns score, parts, peer comparison and group size",
         "Formula shown on the methodology page"],
        ["backend/app/services/score.py", "backend/app/routers/me.py"],
        ["Hand-computed score for a fixture household", "Peer group below 5 falls back to own baseline", "No other household's data is exposed"])),
    ("Impact Ledger: personal and community, estimated vs self-reported vs verified", ["backend", "must"], D1, body(
        "Show impact honestly: what the model estimates, what people reported, and what GEDA verified from photos are always kept apart.",
        ["`GET /api/me/ledger`: kWh, CO2 and rupees by theme and by status",
         "`GET /api/communities/{id}/ledger`: the same, summed for a community (hidden below 5 members)",
         "Estimated figures come from the plan; reported and verified from `action_logs.status`"],
        ["backend/app/routers/me.py", "backend/app/routers/societies.py"],
        ["Rejected actions count nowhere", "Verified and self-reported never mix", "Community ledger hidden below 5 members"])),
    ("Community kinds: society, college, school, office, ward", ["backend", "must"], D1, body(
        "Let colleges, schools and offices take part as well as housing societies, as Strava does with clubs.",
        ["`societies.kind` column with a migration; default `society`",
         "Create and join accept and return `kind`",
         "Leaderboard filters by kind within a district"],
        ["backend/app/models.py", "backend/app/routers/societies.py", "backend/app/schemas.py"],
        ["Existing societies migrate as `society`", "Invalid kind is rejected"])),
    ("Expo push tokens + sending through /api/internal/push/run", ["backend", "should"], D1, body(
        "Send the existing alerts (Green Hours, evening peak, bill reminder) to the phone app as well as the web.",
        ["Store Expo push tokens next to web-push subscriptions",
         "The scheduler sends to Expo tokens via the Expo push API, with the same daily cap and language",
         "Invalid tokens are removed"],
        ["backend/app/routers/push.py", "backend/app/services/push.py", "backend/app/models.py"],
        ["Expo send mocked: payload, cap of 2 a day, removal of dead tokens"])),
    ("Expo app scaffold: router, theme, API client, i18n, auth", ["mobile", "must"], D1, body(
        "Start the citizen app in `mobile/`: one codebase for Android, iPhone and web.",
        ["Expo SDK 58 with expo-router, TypeScript and TanStack Query",
         "Design tokens: GEDA navy, green and saffron, large readable numbers",
         "API client and types from `web/src/lib/api.ts`; token in expo-secure-store (localStorage on web)",
         "English, Gujarati, Hindi catalogues shared with the web app",
         "Sign in and sign up; role decides where you land"],
        ["mobile/"],
        ["`npx tsc --noEmit` clean", "`npx expo export -p web` builds"])),
    ("Onboarding with a bill photo -> baseline footprint", ["mobile", "must"], D1, body(
        "A two-minute start: household, location, lifestyle and a photo of the electricity bill give the baseline footprint.",
        ["Bill photo with expo-image-picker, read by `POST /api/bills/scan`; units and DISCOM prefilled",
         "Household questions with sensible defaults; district suggests the DISCOM",
         "Footprint preview updates as you answer",
         "Answers from a free check carry over"],
        ["mobile/app/(auth)/", "mobile/components/"],
        ["Onboarding completes on web and Android", "Footprint matches `POST /api/footprint/preview`"])),
    ("Home: LiFE Score, homes like yours, today's 3 actions, streak, Nidhi tree", ["mobile", "must"], D1, body(
        "One glance answers: how am I doing, how do I compare, what should I do today.",
        ["Score and peer comparison from #3",
         "Today's 3 actions from #2, each with its reason and a one-tap log",
         "Streak and the Nidhi tree growing with verified impact (visual only)",
         "Green Hours today or tomorrow"],
        ["mobile/app/(tabs)/index.tsx"],
        ["Renders with no data, with a new user, and with history", "No horizontal scroll at 390 px"])),
    # ---------------- Day 2 ----------------
    ("Act tab: engine cards, log with photo proof, challenges, points and badges", ["mobile", "must"], D2, body(
        "Turn intent into action, JouleBug-style: clear cards, quick logging, fair points.",
        ["All ranked actions by theme, with effort, rupees, CO2, points and proof rule",
         "Log instantly for 40% of points; add a photo for full points after review",
         "Daily statewide challenge at 2x points",
         "Points, level and badges update after logging"],
        ["mobile/app/(tabs)/act.tsx"],
        ["Duplicate photo is refused", "Daily limits respected", "Offline log is queued and sent later"])),
    ("Community tab: my community, weekly league, district, campaigns", ["mobile", "must"], D2, body(
        "Make saving social: your society or college, its goal and league position, your district, and active campaigns.",
        ["Join with a code or start a community (with kind)",
         "Goal progress, announcements and weekly league within the district (Duolingo-style)",
         "District standing and active GEDA campaigns",
         "Totals hidden below 5 households"],
        ["mobile/app/(tabs)/community.tsx"],
        ["Join, leave, and committee views", "Privacy floor of 5 respected"])),
    ("Head-to-head duels between communities: API and UI", ["backend", "mobile", "should"], D2, body(
        "Two societies or colleges compete for 30 days on a defensible metric.",
        ["`duels` table and endpoints: challenge, accept, standings",
         "Metric: CO2 avoided per member, counted only when 40% or more of members are active",
         "Duel card on the Community tab"],
        ["backend/app/routers/duels.py", "mobile/app/(tabs)/community.tsx"],
        ["Participation floor applied", "Only committees can start or accept a duel"])),
    ("Peak Hour Challenge events (campaign kind=\"peak\")", ["backend", "mobile", "should"], D2, body(
        "GEDA schedules evening peak events; citizens opt in and shift heavy loads, OhmConnect-style but without money.",
        ["Campaign `kind=\"peak\"` with a time window (reuse `routers/campaigns.py`)",
         "Counts `shift_heavy_load` logged for the event",
         "Shown on Home and Community while live; push reminder 30 minutes before"],
        ["backend/app/routers/campaigns.py", "mobile/"],
        ["Only actions inside the window count"])),
    ("Solar tab: advisor, subsidy, payback, how to apply, registered vendors", ["mobile", "must"], D2, body(
        "Take a citizen from \"is solar worth it?\" to the official application.",
        ["System size from roof and use, PVGIS yield for the district, DISCOM tariff savings",
         "PM Surya Ghar subsidy, net cost, payback and 25-year gain",
         "How to apply in Gujarat (national portal, DISCOM feasibility, net meter)",
         "Link to the government list of registered vendors"],
        ["mobile/app/(tabs)/solar.tsx", "reuses POST /api/solar/estimate"],
        ["Numbers match the API for a fixture roof"])),
    ("Me tab: Impact Ledger, badges, language, data export and delete", ["mobile", "must"], D2, body(
        "Your record and your data, in your hands.",
        ["Impact Ledger from #4: estimated vs reported vs verified, by theme",
         "Badges and level",
         "Language switch; download all my data; delete account and photos"],
        ["mobile/app/(tabs)/me.tsx"],
        ["Export downloads JSON", "Delete removes the account and signs out"])),
    ("Gujarati and Hindi for all new strings", ["mobile", "should"], D2, body(
        "Every new screen in Gujarati and Hindi, generated with Adaption and checked for placeholders.",
        ["Run `backend/tools/translate_with_adaption.py --missing --run`",
         "No broken `{placeholders}`",
         "Native-speaker check of the main screens (see #26)"],
        ["web/src/i18n/", "backend/app/locales/"],
        ["i18n tests pass"])),
    # ---------------- Day 3 ----------------
    ("GEDA console: funnel, themes, communities and duels, campaigns and peak events", ["geda-web", "backend", "must"], D3, body(
        "Give GEDA what it needs to run the programme across Gujarat.",
        ["`GET /api/admin/funnel`: registered, onboarded, active this week, verified",
         "`GET /api/admin/themes`: actions and impact by LiFE theme",
         "`GET /api/admin/communities`: communities by kind, top performers, duels",
         "Create and manage campaigns and peak events from the console",
         "District officers see only their district"],
        ["backend/app/routers/admin.py", "web/src/app/geda/"],
        ["Officer scoping enforced", "Console e2e test extended"])),
    ("Landing page: APK QR, open web app, GEDA sign-in; retire Next.js citizen pages", ["geda-web", "must"], D3, body(
        "One public front door: get the app, use it on the web, or sign in as GEDA.",
        ["QR code and link for the Android APK; button to open the web app",
         "GEDA sign-in link",
         "Remove the Next.js citizen pages now covered by the Expo app"],
        ["web/src/app/page.tsx", "web/src/app/(app)/", "web/src/app/join/"],
        ["Landing e2e test", "No dead links"])),
    ("Deploy: merge rebuild to main, Render API, Vercel console + Expo web, EAS APK", ["deploy", "must"], D3, body(
        "Everything live and installable before the finale.",
        ["Merge `rebuild` into `main`; retire the old `frontend/`",
         "Render API redeployed; migrations applied to Supabase",
         "Vercel: console and landing at nidhi-gujarat; Expo web on a second project",
         "Android APK from `eas build -p android --profile preview`, linked from the landing page",
         "CORS allows both web origins"],
        ["render.yaml", "web/vercel.json", "mobile/eas.json"],
        ["Health check ok", "APK installs and signs in", "Web app signs in"])),
    ("Tagged demo data for communities and duels, loaded live", ["deploy", "must"], D3, body(
        "Make maps, leagues and duels look alive for the finale, clearly marked as demo.",
        ["Extend `backend/tools/seed_demo.py`: community kinds, a college, active duels, a peak event",
         "Every demo name carries \"ડેમો\"; removable with `--remove`",
         "Loaded on the live database after deploy"],
        ["backend/tools/seed_demo.py"],
        ["Local run creates and removes everything cleanly"])),
    ("Full test pass + README with architecture diagram and DB schema", ["docs", "must"], D3, body(
        "Show the judges the engineering (40% of the score) and the architecture (30%).",
        ["Backend, mobile and console tests all green in CI",
         "README: what it does, architecture diagram, database schema, setup, limits",
         "Methodology page lists every factor and source"],
        ["README.md", "docs/"],
        ["CI green on main"])),
    ("10-slide deck, demo script and 2-3 minute video", ["docs", "must"], FIN, body(
        "Ready for the 5-minute stage pitch, 3-minute Q&A and the booth.",
        ["Deck: problem, solution, live demo flow, architecture, schema, tech stack, scalability, limits, roadmap",
         "Booth demo script and the Q&A bank updated",
         "2-3 minute video of the real app"],
        ["docs/"],
        [])),
    ("Stretch: AI weekly coach and Nidhi tree animation", ["backend", "mobile", "stretch"], FIN, body(
        "A weekly note written by AI from the citizen's own computed numbers, and a growing-tree animation.",
        ["`GET /api/coach/weekly` via the existing Groq key; numbers come only from the API; template fallback",
         "Labelled \"written by AI from your numbers\"",
         "Tree animation respects reduced motion"],
        ["backend/app/routers/coach.py", "mobile/components/"],
        ["Coach never states a number that is not in its input"])),
    # ---------------- user actions ----------------
    ("Create an Expo account and run npx eas login", ["user-action", "must"], D1, body(
        "Needed to build the Android APK in Expo's cloud. Only the owner should create the account and type the password.",
        ["Free account at expo.dev", "Run `npx eas login` in the terminal", "Tell Claude it is done"], [], [])),
    ("Rotate the exposed Supabase, Adaption and Groq keys", ["user-action", "must"], D1, body(
        "These were pasted in chat earlier. Rotate them and update Render and the local .env.",
        ["New Supabase database password and secret key", "New Adaption key (or delete it from Render)", "New Groq key", "Render and backend/.env updated"], [], [])),
    ("Test the APK on an Android phone + Gujarati review", ["user-action", "should"], D3, body(
        "A real phone and a native speaker catch what tests cannot.",
        ["Install the APK from the landing page QR", "Sign up, log an action with a photo, join a community", "A Gujarati speaker checks the main screens"], [], [])),
]

EPIC_TITLE = "Epic: Nidhi, Mission LiFE Citizen Sustainability Platform"
EPIC_INTRO = """Nidhi turns Mission LiFE awareness into measurable action for Gujarat: a personal footprint, an Action Engine that picks what matters for each home, rewards and community, solar adoption, and a GEDA console for regional monitoring. Mobile app first (Expo: Android, iPhone, web), Next.js for the landing page and GEDA console, FastAPI + PostgreSQL behind both.

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

## Tasks
"""


def gh(*args, capture=True):
    r = subprocess.run(["gh", *args], capture_output=capture, text=True)
    if r.returncode != 0:
        raise SystemExit(f"gh {' '.join(args[:3])} failed: {r.stderr.strip()}")
    return r.stdout


def main() -> int:
    apply = "--apply" in sys.argv
    print(f"{'Creating' if apply else 'Dry run for'} {len(LABELS)} labels, {len(MILESTONES)} milestones, {len(ISSUES)} issues and 1 epic on {REPO}\n")
    if not apply:
        for i, (title, labels, ms, _) in enumerate(ISSUES, 1):
            print(f"{i:2}. [{ms}] {title}  ({', '.join(labels)})")
        print("\nNothing created. Run with --apply to create them.")
        return 0

    for name, color, desc in LABELS:
        gh("label", "create", name, "--repo", REPO, "--color", color, "--description", desc, "--force")
    print("labels ok")

    existing_ms = {m["title"] for m in json.loads(gh("api", f"repos/{REPO}/milestones?state=all&per_page=100"))}
    for title, due, desc in MILESTONES:
        if title not in existing_ms:
            gh("api", f"repos/{REPO}/milestones", "-f", f"title={title}", "-f", f"due_on={due}", "-f", f"description={desc}")
    print("milestones ok")

    existing = {i["title"]: i["number"] for i in json.loads(gh("issue", "list", "--repo", REPO, "--state", "all", "--limit", "300", "--json", "title,number"))}
    numbers = []
    for title, labels, ms, text in ISSUES:
        if title in existing:
            numbers.append(existing[title])
            continue
        url = gh("issue", "create", "--repo", REPO, "--title", title, "--body", text, "--label", ",".join(labels), "--milestone", ms).strip()
        numbers.append(int(url.rsplit("/", 1)[1]))
        print(f"  #{numbers[-1]} {title}")

    tasks = "\n".join(f"- [ ] #{n} {t}" for n, (t, *_rest) in zip(numbers, ISSUES))
    epic_body = EPIC_INTRO + tasks
    if EPIC_TITLE in existing:
        gh("issue", "edit", str(existing[EPIC_TITLE]), "--repo", REPO, "--body", epic_body)
        epic = existing[EPIC_TITLE]
    else:
        url = gh("issue", "create", "--repo", REPO, "--title", EPIC_TITLE, "--body", epic_body, "--label", "epic", "--milestone", FIN).strip()
        epic = int(url.rsplit("/", 1)[1])
    print(f"\nEpic: https://github.com/{REPO}/issues/{epic}")
    print(f"Issues: #{numbers[0]} to #{numbers[-1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
