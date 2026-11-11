"""Reference data: Gujarat's districts and the green action catalogue.

Upserted on every start. There is no sample or synthetic data: every citizen,
reading and action in the database comes from a real person using the app.
Create the first GEDA administrator with `python -m app.create_admin`.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.i18n import tr
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

# Titles and descriptions live in locales/en.json
# (translated to Gujarati and Hindi alongside the rest of the app).
ACTIONS = [
    # code, category, theme (Mission LiFE), points, max_per_day
    ("ac_24", "energy", "energy", 15, 1),
    ("shift_heavy_load", "energy", "energy", 10, 2),
    ("geyser_off", "energy", "energy", 10, 1),
    ("standby_off", "energy", "energy", 5, 1),
    ("led_switch", "energy", "energy", 30, 1),
    ("solar_survey", "solar", "energy", 40, 1),
    ("pressure_cooker", "cooking", "energy", 10, 1),
    ("public_transport", "mobility", "energy", 20, 2),
    ("carpool", "mobility", "energy", 20, 2),
    ("cycle_walk", "mobility", "health", 20, 2),
    ("stairs", "health", "health", 5, 2),
    ("plant_tree", "nature", "health", 50, 1),
    ("save_water", "water", "water", 5, 1),
    ("cloth_bag", "waste", "plastic", 5, 1),
    ("reusable_bottle", "waste", "plastic", 5, 1),
    ("no_food_waste", "food", "food", 5, 1),
    ("millet_meal", "food", "food", 10, 1),
    ("segregate_waste", "waste", "waste", 5, 1),
    ("compost", "waste", "waste", 15, 1),
    ("ewaste_recycle", "ewaste", "ewaste", 40, 1),
    ("repair_not_replace", "ewaste", "ewaste", 30, 1),
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
    for code, category, theme, points, max_per_day in ACTIONS:
        title = tr("en", f"action.{code}.title")
        desc = tr("en", f"action.{code}.description", peak=factors.peak_label())
        typical = action_impact(code, _TypicalHousehold())
        action = existing_actions.get(code) or ActionType(code=code)
        action.title, action.description, action.category, action.theme = title, desc, category, theme
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
