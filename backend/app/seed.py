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

from app.db import Base, SessionLocal, engine
from app.models import ActionLog, ActionStatus, ActionType, District, EnergyReading, Household, Role, User
from app.security import hash_password
from app.services.footprint import FootprintInput, monthly_footprint
from app.services.gamification import points_for
from app.timeutil import today_ist

DISTRICTS = [
    ("Ahmedabad", 23.0225, 72.5714, 20000),
    ("Surat", 21.1702, 72.8311, 18000),
    ("Vadodara", 22.3072, 73.1812, 12000),
    ("Rajkot", 22.3039, 70.8022, 10000),
    ("Gandhinagar", 23.2156, 72.6369, 6000),
    ("Bhavnagar", 21.7645, 72.1519, 6000),
    ("Jamnagar", 22.4707, 70.0577, 5000),
    ("Junagadh", 21.5222, 70.4579, 4000),
    ("Anand", 22.5645, 72.9289, 4000),
    ("Kutch", 23.2420, 69.6669, 4000),
    ("Mehsana", 23.5880, 72.3693, 4000),
    ("Bharuch", 21.7051, 72.9959, 3500),
    ("Navsari", 20.9467, 72.9520, 3000),
    ("Valsad", 20.5992, 72.9342, 3000),
    ("Patan", 23.8493, 72.1266, 2500),
    ("Banaskantha", 24.1722, 72.4383, 2500),
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
    for name, lat, lon, goal in DISTRICTS:
        district = existing.get(name) or District(name=name)
        district.lat, district.lon, district.monthly_goal_kg = lat, lon, goal
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


def seed_demo(db: Session, citizens: int = 120, seed: int = 26) -> None:
    rng = random.Random(seed)
    if db.scalar(select(User).where(User.email == "admin@ecosetu.demo")):
        print("Demo data already present, skipping.")
        return

    db.add(User(email="admin@ecosetu.demo", name="GEDA Admin", role=Role.admin,
                password_hash=hash_password(DEMO_PASSWORD)))

    districts = db.scalars(select(District)).all()
    weights = [d.monthly_goal_kg for d in districts]  # bigger cities get more citizens
    actions = db.scalars(select(ActionType)).all()
    now = datetime.now(timezone.utc)
    this_month = today_ist().replace(day=1)
    pw_hash = hash_password(DEMO_PASSWORD)

    for i in range(citizens):
        district = rng.choices(districts, weights=weights)[0]
        user = User(
            email=f"citizen{i + 1}@ecosetu.demo",
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

        for _ in range(int(engagement * 60)):
            action = rng.choice(actions)
            created = now - timedelta(days=rng.triangular(0, 56, 0))  # skewed towards recent weeks
            status = rng.choices([ActionStatus.self_reported, ActionStatus.verified, ActionStatus.pending],
                                 weights=[70, 25, 5])[0]
            db.add(ActionLog(
                user_id=user.id, action_type_id=action.id, status=status,
                points_awarded=points_for(action.points, status, False),
                co2_saved_kg=0.0 if status == ActionStatus.pending else action.co2_saved_kg,
                note="Demo entry" if status == ActionStatus.pending else None,
                created_at=created,
            ))
    db.commit()
    print(f"Seeded {citizens} demo citizens. Admin: admin@ecosetu.demo / {DEMO_PASSWORD}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="also create synthetic demo users and activity")
    args = parser.parse_args()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_reference(db)
        if args.demo:
            seed_demo(db)


if __name__ == "__main__":
    main()
