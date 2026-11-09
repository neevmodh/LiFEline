"""Optional demo accounts with Gujarati names, for rehearsals and the booth.

Everything goes through the public API (sign-up, household, actions, society), so every
number shown is computed by the real engine from these invented INPUTS. Nothing is written
to the database directly. Every name carries "ડેમો" so demo people are never mistaken for
real ones, and one command removes them all (it signs in as each and deletes the account).

    cd backend
    export DEMO_PASSWORD='choose-a-password'          # you choose it; it is not stored
    uv run python tools/seed_demo.py --api http://127.0.0.1:8000            # dry run
    uv run python tools/seed_demo.py --api http://127.0.0.1:8000 --apply    # create
    uv run python tools/seed_demo.py --api http://127.0.0.1:8000 --remove   # delete all demo accounts
"""

import argparse
import os
import random
import sys

import httpx

DOMAIN = "example.com"
PREFIX = "demo-lifeline-"

FIRST = ["રમેશ", "સુરેશ", "મહેશ", "કિરણ", "જિગ્નેશ", "હિતેશ", "નીલા", "દિવ્યા", "પ્રિયા", "કાજલ", "ભાવિક", "ચિરાગ",
         "મિત્તલ", "જ્યોતિ", "અલ્પા", "રાજેશ", "અમિત", "પારુલ", "સ્નેહા", "વિપુલ", "હસમુખ", "ભરત", "રેખા", "હેતલ"]
LAST = ["પટેલ", "શાહ", "મહેતા", "દેસાઈ", "જોષી", "ત્રિવેદી", "પંચાલ", "ઠાકર", "વ્યાસ", "પરમાર", "સોલંકી", "ચૌહાણ"]
# (district name in the app, how many demo households, ward label)
PLACES = [("Ahmedabad", 8, "વોર્ડ 3"), ("Surat", 7, "વોર્ડ 5"), ("Vadodara", 6, "વોર્ડ 2"), ("Rajkot", 6, "વોર્ડ 4"),
          ("Gandhinagar", 5, "વોર્ડ 1"), ("Bhavnagar", 3, ""), ("Jamnagar", 3, ""), ("Anand", 2, "")]
COMMUTES = ["car", "two_wheeler", "bus", "metro", "cycle_walk"]
SOCIETY = "શાંતિ એપાર્ટમેન્ટ્સ (ડેમો)"


def plan(rng: random.Random, districts: dict[str, int]):
    people, n = [], 0
    for place, count, ward in PLACES:
        if place not in districts:
            continue
        for _ in range(count):
            n += 1
            first = rng.choice(FIRST)
            people.append({
                "email": f"{PREFIX}{n:02d}@{DOMAIN}",
                "name": f"{first}-ડેમો {rng.choice(LAST)}",
                "district_id": districts[place], "ward": ward or None,
                "household": {
                    "monthly_kwh": rng.choice([120, 160, 210, 260, 320, 400]), "members": rng.randint(2, 6),
                    "lpg_cylinders_per_month": rng.choice([0.5, 1, 1.5]), "commute_mode": rng.choice(COMMUTES),
                    "commute_km_per_day": rng.choice([0, 5, 8, 12, 20]), "home_type": rng.choice(["apartment", "independent"]),
                    "ac_count": rng.choice([0, 1, 1, 2]), "has_geyser": rng.random() < 0.5,
                    "has_washing_machine": rng.random() < 0.8, "has_ev": False, "has_solar": False,
                    "roof_area_sqm": rng.choice([None, 30, 45, 60]),
                },
                "actions": rng.randint(2, 7),
            })
    return people


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    password = os.environ.get("DEMO_PASSWORD", "")
    if len(password) < 8:
        print("Set DEMO_PASSWORD (8+ characters) in your shell first.")
        return 2
    http = httpx.Client(base_url=args.api.rstrip("/"), timeout=60)
    districts = {d["name"]: d["id"] for d in http.get("/api/districts").json()}
    people = plan(random.Random(26), districts)

    if args.remove:
        gone = 0
        for p in people:
            r = http.post("/api/auth/login", json={"email": p["email"], "password": password})
            if r.status_code == 200:
                d = http.request("DELETE", "/api/account", json={"password": password},
                                 headers={"Authorization": f"Bearer {r.json()['token']}"})
                gone += d.status_code in (200, 204)
        print(f"Removed {gone} demo accounts.")
        return 0

    print(f"{len(people)} demo households in {len({p['district_id'] for p in people})} districts, one society.")
    if not args.apply:
        print("Dry run. Add --apply to create them.")
        return 0

    actions = [a["code"] for a in http.get("/api/actions/types").json()]
    rng, society_code, made = random.Random(7), None, 0
    for i, p in enumerate(people):
        r = http.post("/api/auth/register", json={k: p[k] for k in ("email", "name", "district_id", "ward")} | {"password": password})
        if r.status_code != 201:
            print(f"  skip {p['email']}: {r.status_code} {r.text[:80]}")
            continue
        made += 1
        auth = {"Authorization": f"Bearer {r.json()['token']}"}
        http.put("/api/household", json=p["household"], headers=auth)
        # The first Ahmedabad household founds the society; the next five join it.
        if i == 0:
            society_code = http.post("/api/societies", json={"name": SOCIETY, "goal_kg_month": 150}, headers=auth).json().get("join_code")
        elif society_code and i <= 5:
            http.post("/api/societies/join", json={"code": society_code}, headers=auth)
        for code in rng.sample(actions, k=min(p["actions"], len(actions))):
            http.post("/api/actions", data={"action_code": code}, headers=auth)
    print(f"Created {made} demo accounts. Remove them with --remove.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
