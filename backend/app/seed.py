"""Reference data (districts, action catalogue) and optional synthetic demo data.

Reference data is upserted on every start. Demo data is only created by
`python -m app.seed --demo` and is clearly synthetic: it exists so the admin
dashboard and leaderboards have something to show in a demo.
"""

import argparse
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.migrate import upgrade_to_head
from app.models import ActionLog, ActionStatus, ActionType, District, EnergyReading, Household, Role, User
from app.security import hash_password
from app.services.footprint import FootprintInput, monthly_footprint
from app.services.gamification import points_for
from app.timeutil import today_ist

# All 33 districts of Gujarat. lat/lon is an interior point of each district boundary
# (geoBoundaries IND ADM2, 2021). The last value is an approximate relative population,
# used only to spread synthetic demo citizens realistically.
DISTRICTS = [
    ("Ahmedabad", 22.7246, 72.3143, 72),
    ("Surat", 21.1889, 72.9513, 61),
    ("Amreli", 21.4257, 71.2758, 15),
    ("Anand", 22.4885, 72.7612, 21),
    ("Aravalli", 23.488, 73.4015, 10),
    ("Banaskantha", 24.2709, 72.17, 31),
    ("Bharuch", 21.8147, 72.9516, 16),
    ("Bhavnagar", 21.5694, 71.9111, 24),
    ("Botad", 22.0451, 71.6749, 7),
    ("Chhota Udaipur", 22.22, 73.7873, 11),
    ("Dahod", 22.9186, 74.1341, 21),
    ("Dang", 20.7808, 73.7125, 2),
    ("Devbhumi Dwarka", 22.1367, 69.4298, 8),
    ("Gandhinagar", 23.2803, 72.6667, 14),
    ("Gir Somnath", 20.9864, 70.6906, 12),
    ("Jamnagar", 22.3172, 70.1062, 14),
    ("Junagadh", 21.3407, 70.4192, 15),
    ("Kheda", 22.8561, 72.9981, 23),
    ("Kutch", 23.7099, 69.8224, 21),
    ("Mahisagar", 23.1875, 73.6591, 10),
    ("Mehsana", 23.567, 72.3598, 20),
    ("Morbi", 22.7939, 70.888, 10),
    ("Narmada", 21.7303, 73.6294, 6),
    ("Navsari", 20.8269, 73.0351, 13),
    ("Panchmahal", 22.6976, 73.6065, 16),
    ("Patan", 23.7714, 71.7869, 13),
    ("Porbandar", 21.6047, 69.8531, 6),
    ("Rajkot", 22.066, 71.0259, 31),
    ("Sabarkantha", 23.8702, 73.0157, 14),
    ("Surendranagar", 22.8294, 71.6101, 16),
    ("Tapi", 21.1876, 73.5557, 8),
    ("Vadodara", 22.3166, 73.3042, 42),
    ("Valsad", 20.4419, 73.1668, 17),
]

# code, title, description, category, points, co2_saved_kg, kwh_saved, max_per_day
ACTIONS = [
    ("ac_24", "AC at 24°C all day", "Kept the AC at 24°C or higher for the whole day.", "energy", 15, 1.0, 1.4, 1),
    ("shift_heavy_load", "Ran a heavy appliance off-peak",
     "Ran the washing machine, geyser or EV charger outside 6-10 PM peak hours.", "energy", 10, 0.3, 0.0, 2),
    ("geyser_off", "Geyser off after use", "Switched the geyser off right after use instead of leaving it on.",
     "energy", 10, 0.7, 1.0, 1),
    ("standby_off", "Switched off at the plug", "Turned TV, set-top box and chargers off at the wall overnight.",
     "energy", 5, 0.2, 0.3, 1),
    ("led_switch", "Replaced a bulb with LED", "Swapped an old incandescent or CFL bulb for an LED.",
     "energy", 30, 2.4, 3.3, 1),
    ("public_transport", "Bus or metro instead of car", "Took public transport for a trip you'd usually drive.",
     "mobility", 20, 1.4, 0.0, 2),
    ("cycle_walk", "Walked or cycled", "Walked or cycled for a short trip instead of using a vehicle.",
     "mobility", 20, 0.9, 0.0, 2),
    ("pressure_cooker", "Cooked with a pressure cooker", "Used a pressure cooker or lid to cut gas use.",
     "cooking", 10, 0.6, 0.0, 1),
    ("cloth_bag", "Said no to single-use plastic", "Carried a cloth bag or bottle instead of single-use plastic.",
     "waste", 5, 0.1, 0.0, 1),
    ("save_water", "Saved water", "Fixed a leak, reused RO waste water or took a bucket bath.", "water", 5, 0.1, 0.0, 1),
    ("plant_tree", "Planted a tree", "Planted and watered a sapling. Upload a photo for full points.",
     "nature", 50, 1.8, 0.0, 1),
    ("solar_survey", "Booked a rooftop solar survey", "Requested a site survey from a rooftop solar vendor.",
     "solar", 40, 0.0, 0.0, 1),
]


def seed_reference(db: Session) -> None:
    existing = {d.name: d for d in db.scalars(select(District))}
    for name, lat, lon, _ in DISTRICTS:
        district = existing.get(name) or District(name=name)
        district.lat, district.lon = lat, lon
        db.add(district)

    existing_actions = {a.code: a for a in db.scalars(select(ActionType))}
    for code, title, desc, category, points, co2, kwh, max_per_day in ACTIONS:
        action = existing_actions.get(code) or ActionType(code=code)
        action.title, action.description, action.category = title, desc, category
        action.points, action.co2_saved_kg, action.kwh_saved, action.max_per_day = points, co2, kwh, max_per_day
        db.add(action)
    db.commit()


FIRST_NAMES = ["Aarav", "Diya", "Kabir", "Isha", "Vihaan", "Ananya", "Arjun", "Meera", "Rohan", "Priya",
               "Dev", "Kavya", "Yash", "Riya", "Nirav", "Hetal", "Jay", "Krupa", "Parth", "Dhruvi"]
LAST_NAMES = ["Patel", "Shah", "Desai", "Mehta", "Joshi", "Trivedi", "Parmar", "Chauhan", "Solanki", "Rana"]
DEMO_PASSWORD = "demo1234"


def seed_demo(db: Session, citizens: int = 360, seed: int = 26) -> None:
    rng = random.Random(seed)
    if db.scalar(select(User).where(User.email == "admin@lifeline.demo")):
        print("Demo data already present, skipping.")
        return

    db.add(User(email="admin@lifeline.demo", name="GEDA Admin", role=Role.admin,
                password_hash=hash_password(DEMO_PASSWORD)))

    districts = db.scalars(select(District)).all()
    population = {name: weight for name, _, _, weight in DISTRICTS}
    weights = [population.get(d.name, 1) for d in districts]  # bigger cities get more citizens
    actions = db.scalars(select(ActionType)).all()
    now = datetime.now(timezone.utc)
    this_month = today_ist().replace(day=1)
    pw_hash = hash_password(DEMO_PASSWORD)

    for i in range(citizens):
        district = rng.choices(districts, weights=weights)[0]
        user = User(
            email=f"citizen{i + 1}@lifeline.demo",
            name=f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
            password_hash=pw_hash,
            district_id=district.id,
            ward=f"Ward {rng.randint(1, 12)}",
            created_at=now - timedelta(days=rng.randint(10, 90)),
        )
        db.add(user)
        db.flush()

        kwh = rng.randint(120, 450)
        mode = rng.choice(["car", "two_wheeler", "two_wheeler", "bus", "metro", "cycle_walk"])
        fp = monthly_footprint(FootprintInput(kwh, rng.randint(2, 6), rng.choice([0.5, 1, 1.5]), mode,
                                              rng.randint(2, 30)))
        db.add(Household(
            user_id=user.id, members=rng.randint(2, 6), home_type=rng.choice(["apartment", "independent"]),
            monthly_kwh=kwh, lpg_cylinders_per_month=1, commute_mode=mode, commute_km_per_day=10,
            ac_count=rng.randint(0, 3), has_geyser=rng.random() < 0.6, has_washing_machine=True,
            has_ev=rng.random() < 0.08, has_solar=rng.random() < 0.1, roof_area_sqm=rng.choice([None, 30, 50, 80]),
            baseline_kg_co2_month=fp.total_kg,
        ))

        # Engaged users trend downwards over six months.
        engagement = rng.random()
        for m in range(5, -1, -1):
            month = (this_month - timedelta(days=30 * m)).replace(day=1)
            drift = 1 - engagement * 0.04 * (5 - m)
            db.add(EnergyReading(user_id=user.id, month=month, kwh=round(kwh * drift * rng.uniform(0.92, 1.08)),
                                 source="manual"))

        # About a third of citizens drift away after a while, as in any real engagement app.
        last_active_days_ago = rng.uniform(8, 40) if rng.random() < 0.35 else 0
        for _ in range(int(engagement * 60)):
            action = rng.choice(actions)
            created = now - timedelta(days=last_active_days_ago + rng.triangular(0, 50, 0))
            status = rng.choices([ActionStatus.self_reported, ActionStatus.verified],
                                 weights=[75, 25])[0]
            db.add(ActionLog(
                user_id=user.id, action_type_id=action.id, status=status,
                points_awarded=points_for(action.points, status, False),
                co2_saved_kg=0.0 if status == ActionStatus.pending else action.co2_saved_kg,
                note="Demo entry" if status == ActionStatus.pending else None,
                created_at=created,
            ))
    db.commit()
    print(f"Seeded {citizens} demo citizens. Admin: admin@lifeline.demo / {DEMO_PASSWORD}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="also create synthetic demo users and activity")
    args = parser.parse_args()
    upgrade_to_head()
    with SessionLocal() as db:
        seed_reference(db)
        if args.demo:
            seed_demo(db)


if __name__ == "__main__":
    main()
