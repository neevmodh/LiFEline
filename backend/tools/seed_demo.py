"""Optional demo accounts with Gujarati names in all 33 districts, for rehearsals and the booth.

Every number shown is computed by the real engine (sign-up, household, bills, actions and
societies all go through the app's own API code) from these invented INPUTS. Every name carries
"ડેમો" so demo people are never mistaken for real ones, and --remove deletes them all.

    cd backend
    export DEMO_PASSWORD='choose-a-password'            # you choose it; it is not stored
    uv run python tools/seed_demo.py --in-process                  # dry run: counts only
    uv run python tools/seed_demo.py --in-process --apply          # create, into the database in backend/.env
    uv run python tools/seed_demo.py --in-process --remove         # delete every demo account

--in-process runs the app inside this script (no web server, no sign-up rate limit) against whatever
DATABASE_URL points at, and spreads demo actions over the last 8 weeks so trend charts have history.
--api URL talks to a running server instead (slower: sign-ups are limited to 50 an hour, and
actions all carry today's date).
"""

import argparse
import os
import random
import sys
from datetime import datetime, timedelta, timezone

DOMAIN = "example.com"
PREFIX = "demo-lifeline-"

FIRST = ["રમેશ", "સુરેશ", "મહેશ", "કિરણ", "જિગ્નેશ", "હિતેશ", "નીલા", "દિવ્યા", "પ્રિયા", "કાજલ", "ભાવિક", "ચિરાગ",
         "મિત્તલ", "જ્યોતિ", "અલ્પા", "રાજેશ", "અમિત", "પારુલ", "સ્નેહા", "વિપુલ", "હસમુખ", "ભરત", "રેખા", "હેતલ",
         "ધવલ", "નિલેશ", "પ્રકાશ", "દીપક", "મનીષા", "સોનલ", "જિજ્ઞા", "તુષાર", "યોગેશ", "કૃપા", "ઉર્વશી", "વંદના"]
LAST = ["પટેલ", "શાહ", "મહેતા", "દેસાઈ", "જોષી", "ત્રિવેદી", "પંચાલ", "ઠાકર", "વ્યાસ", "પરમાર", "સોલંકી", "ચૌહાણ",
        "રાઠોડ", "વાઘેલા", "ઝાલા", "જાડેજા", "ભટ્ટ", "અમીન", "ગોહિલ", "મકવાણા"]
# Households per district; any district not listed gets 6, enough for its ward list to show.
SIZE = {"Ahmedabad": 24, "Surat": 22, "Vadodara": 16, "Rajkot": 16, "Gandhinagar": 12, "Bhavnagar": 10, "Jamnagar": 10,
        "Junagadh": 8, "Anand": 8, "Mehsana": 8, "Kutch": 8, "Bharuch": 8}
DEFAULT_SIZE = 6
# Societies: (district, name). Members come from that district's demo households.
SOCIETIES = [("Ahmedabad", "શાંતિ એપાર્ટમેન્ટ્સ (ડેમો)"), ("Surat", "સાગર રેસિડેન્સી (ડેમો)"),
             ("Vadodara", "નર્મદા હાઇટ્સ (ડેમો)"), ("Rajkot", "સૌરાષ્ટ્ર સોસાયટી (ડેમો)"),
             ("Gandhinagar", "સેક્ટર 7 રહેવાસી મંડળ (ડેમો)"), ("Bhavnagar", "ગોહિલવાડ પાર્ક (ડેમો)")]
COMMUTES = ["car", "two_wheeler", "bus", "metro", "cycle_walk"]
# Relative electricity use by calendar month in Gujarat: the hot months cost more to cool.
SEASON = {1: 0.86, 2: 0.88, 3: 1.0, 4: 1.14, 5: 1.22, 6: 1.16, 7: 1.0, 8: 0.96, 9: 1.0, 10: 1.02, 11: 0.92, 12: 0.86}
HISTORY_MONTHS = 6
ACTION_ROUNDS = 3
WEEKS_BACK = 8


def plan(rng: random.Random, districts: dict[str, int]):
    people = []
    for name, did in sorted(districts.items()):
        count = SIZE.get(name, DEFAULT_SIZE)
        for i in range(count):
            first = rng.choice(FIRST)
            # Big districts get two wards, each with 5 or more households.
            ward = "વોર્ડ 1" if count < 10 or i < count // 2 else "વોર્ડ 2"
            people.append({
                "email": f"{PREFIX}{len(people) + 1:03d}@{DOMAIN}",
                "name": f"{first}-ડેમો {rng.choice(LAST)}",
                "district": name, "district_id": did, "ward": ward,
                "household": {
                    "monthly_kwh": rng.choice([110, 140, 170, 210, 260, 320, 400, 480]), "members": rng.randint(2, 6),
                    "lpg_cylinders_per_month": rng.choice([0.5, 1, 1, 1.5]), "commute_mode": rng.choice(COMMUTES),
                    "commute_km_per_day": rng.choice([0, 4, 8, 12, 20]), "home_type": rng.choice(["apartment", "independent"]),
                    "ac_count": rng.choice([0, 1, 1, 2, 3]), "has_geyser": rng.random() < 0.5,
                    "has_washing_machine": rng.random() < 0.8, "has_ev": rng.random() < 0.04, "has_solar": False,
                    "roof_area_sqm": rng.choice([None, 30, 45, 60, 90]),
                },
            })
    return people


def months_back(today, n):
    y, m = today.year, today.month
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out[::-1]


def main() -> int:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--in-process", action="store_true")
    mode.add_argument("--api")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    password = os.environ.get("DEMO_PASSWORD", "")
    if len(password) < 8:
        print("Set DEMO_PASSWORD (8+ characters) in your shell first.")
        return 2

    db_factory = None
    limiters = ()
    if args.in_process:
        sys.path.insert(0, os.getcwd())
        from fastapi.testclient import TestClient  # noqa: PLC0415

        from app import ratelimit  # noqa: PLC0415
        from app.db import SessionLocal  # noqa: PLC0415
        from app.main import app  # noqa: PLC0415

        limiters = (ratelimit.login_limiter, ratelimit.register_limiter)
        db_factory = SessionLocal
        http = TestClient(app).__enter__()
    else:
        import httpx  # noqa: PLC0415

        http = httpx.Client(base_url=args.api.rstrip("/"), timeout=60)

    districts = {d["name"]: d["id"] for d in http.get("/api/districts").json()}
    people = plan(random.Random(26), districts)
    print(f"{len(people)} demo households across {len(districts)} districts, {len(SOCIETIES)} societies.")

    if args.remove:
        gone = 0
        for p in people:
            for lim in limiters:
                lim.reset()
            r = http.post("/api/auth/login", json={"email": p["email"], "password": password})
            if r.status_code == 200:
                d = http.request("DELETE", "/api/account", json={"password": password},
                                 headers={"Authorization": f"Bearer {r.json()['token']}"})
                gone += d.status_code in (200, 204)
        print(f"Removed {gone} demo accounts.")
        return 0
    if not args.apply:
        print("Dry run. Add --apply to create them.")
        return 0
    if db_factory is None:
        print("Note: over --api every action is dated today; use --in-process for an 8-week history.")

    from datetime import date  # noqa: PLC0415

    today = date.today()
    months = months_back(today, HISTORY_MONTHS)
    actions = [a["code"] for a in http.get("/api/actions/types").json()]
    rng = random.Random(7)
    founders: dict[str, str | None] = {}
    joined: dict[str, int] = {}
    made = 0
    for p in people:
        for lim in limiters:  # in-process there is no one to protect from, so sign-ups are not limited
            lim.reset()
        r = http.post("/api/auth/register", json={"email": p["email"], "name": p["name"], "district_id": p["district_id"],
                                                 "ward": p["ward"], "password": password})
        if r.status_code != 201:
            print(f"  skip {p['email']}: {r.status_code} {r.text[:80]}")
            continue
        made += 1
        uid = r.json().get("user", {}).get("id")
        auth = {"Authorization": f"Bearer {r.json()['token']}"}
        http.put("/api/household", json=p["household"], headers=auth)

        # A bill history that follows the seasons, ending in the current month.
        base = p["household"]["monthly_kwh"]
        for ym in months:
            kwh = round(base * SEASON[int(ym[5:])] * rng.uniform(0.92, 1.08))
            http.post("/api/readings", json={"month": ym, "kwh": kwh}, headers=auth)

        # Societies: the first household in a society's district founds it, the next few join.
        for dist, sname in SOCIETIES:
            if p["district"] != dist:
                continue
            if dist not in founders:
                founders[dist] = http.post("/api/societies", json={"name": sname, "goal_kg_month": 150},
                                           headers=auth).json().get("join_code")
                joined[dist] = 1
            elif founders[dist] and joined[dist] < 8:
                http.post("/api/societies/join", json={"code": founders[dist]}, headers=auth)
                joined[dist] += 1

        # Green actions: several rounds, each backdated to a random day so the history is spread out.
        for _ in range(ACTION_ROUNDS):
            batch = rng.sample(actions, k=rng.randint(3, min(9, len(actions))))
            for code in batch:
                http.post("/api/actions", data={"action_code": code}, headers=auth)
            if db_factory is not None and uid is not None:
                from sqlalchemy import select  # noqa: PLC0415

                from app.models import ActionLog  # noqa: PLC0415

                with db_factory() as db:
                    fresh = db.scalars(select(ActionLog).where(ActionLog.user_id == uid,
                                                               ActionLog.created_at >= datetime.now(timezone.utc) - timedelta(hours=1))).all()
                    for log in fresh:
                        log.created_at = datetime.now(timezone.utc) - timedelta(days=rng.randint(1, WEEKS_BACK * 7),
                                                                                hours=rng.randint(0, 20))
                    db.commit()
        if made % 25 == 0:
            print(f"  {made} of {len(people)}...")
    print(f"Created {made} demo accounts. Remove them with --remove.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
