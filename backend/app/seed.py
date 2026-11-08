"""Reference data: Gujarat's districts and the green action catalogue.

Upserted on every start. There is no sample or synthetic data: every citizen,
reading and action in the database comes from a real person using the app.
Create the first GEDA administrator with `python -m app.create_admin`.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.migrate import upgrade_to_head
from app.models import ActionType, District
from app.services import factors
from app.services.impact import action_impact

# All 33 districts of Gujarat. lat/lon is an interior point of each district boundary
# (geoBoundaries IND ADM2, 2021). The last value is the DISCOM suggested at onboarding:
# the state company for the region, or Torrent Power for the Ahmedabad, Gandhinagar
# and Surat cities it serves. Households can change it (rural parts of those districts
# are served by UGVCL or DGVCL).
DISTRICTS = [
    ("Ahmedabad", 22.7246, 72.3143, "torrent"),
    ("Surat", 21.1889, 72.9513, "torrent"),
    ("Amreli", 21.4257, 71.2758, "pgvcl"),
    ("Anand", 22.4885, 72.7612, "mgvcl"),
    ("Aravalli", 23.488, 73.4015, "ugvcl"),
    ("Banaskantha", 24.2709, 72.17, "ugvcl"),
    ("Bharuch", 21.8147, 72.9516, "dgvcl"),
    ("Bhavnagar", 21.5694, 71.9111, "pgvcl"),
    ("Botad", 22.0451, 71.6749, "pgvcl"),
    ("Chhota Udaipur", 22.22, 73.7873, "mgvcl"),
    ("Dahod", 22.9186, 74.1341, "mgvcl"),
    ("Dang", 20.7808, 73.7125, "dgvcl"),
    ("Devbhumi Dwarka", 22.1367, 69.4298, "pgvcl"),
    ("Gandhinagar", 23.2803, 72.6667, "torrent"),
    ("Gir Somnath", 20.9864, 70.6906, "pgvcl"),
    ("Jamnagar", 22.3172, 70.1062, "pgvcl"),
    ("Junagadh", 21.3407, 70.4192, "pgvcl"),
    ("Kheda", 22.8561, 72.9981, "mgvcl"),
    ("Kutch", 23.7099, 69.8224, "pgvcl"),
    ("Mahisagar", 23.1875, 73.6591, "mgvcl"),
    ("Mehsana", 23.567, 72.3598, "ugvcl"),
    ("Morbi", 22.7939, 70.888, "pgvcl"),
    ("Narmada", 21.7303, 73.6294, "dgvcl"),
    ("Navsari", 20.8269, 73.0351, "dgvcl"),
    ("Panchmahal", 22.6976, 73.6065, "mgvcl"),
    ("Patan", 23.7714, 71.7869, "ugvcl"),
    ("Porbandar", 21.6047, 69.8531, "pgvcl"),
    ("Rajkot", 22.066, 71.0259, "pgvcl"),
    ("Sabarkantha", 23.8702, 73.0157, "ugvcl"),
    ("Surendranagar", 22.8294, 71.6101, "pgvcl"),
    ("Tapi", 21.1876, 73.5557, "dgvcl"),
    ("Vadodara", 22.3166, 73.3042, "mgvcl"),
    ("Valsad", 20.4419, 73.1668, "dgvcl"),
]

PEAK = f"{factors.PEAK_HOURS[0] - 12}-{factors.PEAK_HOURS[1] - 12} PM"

# code, title, description, category, points, max_per_day
ACTIONS = [
    ("ac_24", "AC at 24°C all day", "Kept the AC at 24°C or higher for the whole day.", "energy", 15, 1),
    ("shift_heavy_load", "Ran a heavy appliance off-peak",
     f"Ran the washing machine, geyser or EV charger outside {PEAK} peak hours.", "energy", 10, 2),
    ("geyser_off", "Geyser off after use", "Switched the geyser off right after use instead of leaving it on.",
     "energy", 10, 1),
    ("standby_off", "Switched off at the plug", "Turned TV, set-top box and chargers off at the wall overnight.",
     "energy", 5, 1),
    ("led_switch", "Replaced a bulb with LED", "Swapped an old incandescent or CFL bulb for an LED.", "energy", 30, 1),
    ("public_transport", "Bus or metro instead of car", "Took public transport for a trip you'd usually drive.",
     "mobility", 20, 2),
    ("cycle_walk", "Walked or cycled", "Walked or cycled for a short trip instead of using a vehicle.", "mobility", 20, 2),
    ("pressure_cooker", "Cooked with a pressure cooker", "Used a pressure cooker or lid to cut gas use.", "cooking", 10, 1),
    ("cloth_bag", "Said no to single-use plastic", "Carried a cloth bag or bottle instead of single-use plastic.",
     "waste", 5, 1),
    ("save_water", "Saved water", "Fixed a leak, reused RO waste water or took a bucket bath.", "water", 5, 1),
    ("plant_tree", "Planted a tree", "Planted and watered a sapling. Upload a photo for full points.", "nature", 50, 1),
    ("solar_survey", "Booked a rooftop solar survey", "Requested a site survey from a rooftop solar vendor.", "solar", 40, 1),
]


@dataclass(frozen=True)
class _TypicalHousehold:
    """Reference household for the catalogue's "typical" figures; each user sees their own."""

    ac_count: int = 1
    has_geyser: bool = True
    has_washing_machine: bool = True
    has_ev: bool = False
    commute_mode: str = "two_wheeler"
    commute_km_per_day: float = 10
    lpg_cylinders_per_month: float = 1


def seed_reference(db: Session) -> None:
    existing = {d.name: d for d in db.scalars(select(District))}
    for name, lat, lon, _ in DISTRICTS:
        district = existing.get(name) or District(name=name)
        district.lat, district.lon = lat, lon
        db.add(district)

    existing_actions = {a.code: a for a in db.scalars(select(ActionType))}
    for code, title, desc, category, points, max_per_day in ACTIONS:
        typical = action_impact(code, _TypicalHousehold())
        action = existing_actions.get(code) or ActionType(code=code)
        action.title, action.description, action.category = title, desc, category
        action.points, action.co2_saved_kg, action.kwh_saved, action.max_per_day = (
            points, typical.co2_kg, typical.kwh, max_per_day
        )
        db.add(action)
    db.commit()


def suggested_discom(district_name: str | None) -> str:
    return next((d for name, _, _, d in DISTRICTS if name == district_name), factors.DEFAULT_DISCOM)


def main() -> None:
    upgrade_to_head()
    with SessionLocal() as db:
        seed_reference(db)


if __name__ == "__main__":
    main()
