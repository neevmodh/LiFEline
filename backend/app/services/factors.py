"""Emission factors, tariffs and assumptions, each with its source.

Every number the app uses to turn behaviour into kWh, kg CO2 or rupees lives
here, and `SOURCES` is served by GET /api/config so the app can show its
working on the "How we calculate" page. Update the value and its source
together.
"""

from dataclasses import dataclass

# --- Grid electricity -------------------------------------------------------

# kg CO2 per kWh: all-India weighted average, FY 2024-25.
GRID_KG_CO2_PER_KWH = 0.710
# Operating margin: the fossil plants that ramp up to meet extra (peak) demand.
GRID_OPERATING_MARGIN_KG_CO2_PER_KWH = 0.964

# --- Cooking ----------------------------------------------------------------

LPG_KG_PER_CYLINDER = 14.2
LPG_KG_CO2_PER_KG = 2.98  # IPCC 2006 default for LPG (63.1 t CO2/TJ at 47.3 TJ/Gg)
LPG_KG_CO2_PER_CYLINDER = round(LPG_KG_PER_CYLINDER * LPG_KG_CO2_PER_KG, 1)

# --- Transport --------------------------------------------------------------

# kg CO2 per km travelled by one commuter. India GHG Program (WRI India, TERI, CII), India
# Specific Road Transport Emission Factors (2015), values with the 10% real-world uplift:
# - car: petrol hatchback < 1400 cc (the most common Indian car class), driven alone;
# - two-wheeler: scooter < 110 cc (the most common class);
# - bus: city bus per passenger-km.
# Metro: Delhi Metro's yearly electricity (699 GWh) at the grid factor over its ~16 billion
# passenger-km, from the inputs of TERI's per-passenger emissions worksheet for Delhi.
COMMUTE_KG_CO2_PER_KM = {
    "car": 0.140,
    "two_wheeler": 0.0368,
    "bus": 0.0152,
    "metro": 0.031,
    "cycle_walk": 0.0,
}
COMMUTE_DAYS_PER_MONTH = 22

# --- Tariffs (GERC residential "RGP" schedules, effective 1 April 2026) ------------


@dataclass(frozen=True)
class Tariff:
    slabs: tuple[tuple[float, float], ...]  # (upper kWh bound of the slab, Rs/kWh)
    fixed_rs_per_month: float  # single-phase connection up to 2 kW
    fppas_rs_per_kwh: float  # fuel and power purchase adjustment, on every unit
    duty_share: float  # electricity duty on energy + fixed + FPPAS


_INF = float("inf")
_STATE_URBAN = ((50, 3.05), (100, 3.50), (250, 4.15), (_INF, 5.20))
_STATE_RURAL = ((50, 2.65), (100, 3.10), (250, 3.75), (_INF, 4.90))
STATE_FPPAS_RS_PER_KWH = 2.45

DISCOMS = {
    "dgvcl": "Dakshin Gujarat Vij Company (DGVCL)",
    "mgvcl": "Madhya Gujarat Vij Company (MGVCL)",
    "pgvcl": "Paschim Gujarat Vij Company (PGVCL)",
    "ugvcl": "Uttar Gujarat Vij Company (UGVCL)",
    "torrent": "Torrent Power (Ahmedabad, Gandhinagar, Surat)",
}

TARIFFS: dict[tuple[str, str], Tariff] = {}
for _code in ("dgvcl", "mgvcl", "pgvcl", "ugvcl"):
    TARIFFS[(_code, "urban")] = Tariff(_STATE_URBAN, 15, STATE_FPPAS_RS_PER_KWH, 0.15)
    TARIFFS[(_code, "rural")] = Tariff(_STATE_RURAL, 15, STATE_FPPAS_RS_PER_KWH, 0.075)
# Torrent Power serves only urban areas.
_TORRENT = Tariff(((50, 3.20), (200, 3.95), (_INF, 5.00)), 25, STATE_FPPAS_RS_PER_KWH, 0.15)
TARIFFS[("torrent", "urban")] = _TORRENT
TARIFFS[("torrent", "rural")] = _TORRENT

DEFAULT_DISCOM, DEFAULT_AREA = "ugvcl", "urban"

# --- Time of day (IST, 24h) -------------------------------------------------------

# Evening peak when the grid leans hardest on fossil plants, and the solar window.
PEAK_HOURS = (18, 22)
SOLAR_HOURS = (9, 17)


def peak_label() -> str:
    """Evening peak as people say it, e.g. "6-10 PM"."""
    return f"{PEAK_HOURS[0] - 12}-{PEAK_HOURS[1] - 12} PM"

# --- Rooftop solar --------------------------------------------------------------

DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP = 1550  # Gujarat average, used only if PVGIS is unreachable
SQM_PER_KWP = 10  # shadow-free roof area per kWp
BENCHMARK_COST_FIRST_2KW_RS_PER_KWP = 50_000
BENCHMARK_COST_ABOVE_2KW_RS_PER_KWP = 45_000
PANEL_LIFETIME_YEARS = 25
PANEL_DEGRADATION_PER_YEAR = 0.005
NET_METERING_EXPORT_RS_PER_KWH = 2.25  # surplus units bought by the DISCOM


def solar_cost_rs(kwp: float) -> float:
    """Gujarat benchmark cost of a residential rooftop system."""
    first = min(kwp, 2) * BENCHMARK_COST_FIRST_2KW_RS_PER_KWP
    rest = max(kwp - 2, 0) * BENCHMARK_COST_ABOVE_2KW_RS_PER_KWP
    return first + rest


def pm_surya_ghar_subsidy(kwp: float) -> float:
    """Central subsidy for residential rooftop solar: Rs 30k/kW for the first 2 kW,
    Rs 18k for the 3rd kW, capped at Rs 78k."""
    first = min(kwp, 2) * 30_000
    third = min(max(kwp - 2, 0), 1) * 18_000
    return min(first + third, 78_000)


# --- Action assumptions (used by services/impact.py) ------------------------------

AC_KWH_PER_DAY = 9.6  # 1.5-ton inverter AC, ~1.2 kW average draw for 8 hours
AC_SAVING_PER_DEGREE = 0.06  # BEE: each degree higher saves about 6%
AC_DEGREES_RAISED = 2  # from the common 22°C to the BEE default of 24°C
GEYSER_STANDBY_KWH_PER_DAY = 0.8  # standing loss of a storage geyser left on
STANDBY_KWH_PER_NIGHT = 0.3  # TV, set-top box, chargers: ~25 W for 12 hours
LED_WATTS_SAVED = 51  # 60 W incandescent replaced by a 9 W LED
LED_HOURS_PER_DAY = 4
LED_CREDIT_DAYS = 30  # one-off action credited with its first month of savings
HEAVY_LOAD_KWH = {"washing machine": 1.0, "geyser": 2.0, "EV charging": 7.0}
SHORT_TRIP_MAX_KM = 5  # walking or cycling replaces short trips only
PRESSURE_COOKER_LPG_SAVING = 0.25  # conservative share of daily cooking gas saved

CARPOOL_SHARE_SAVED = 0.5  # one more person in the car halves each person's share of the trip

# --- Mission LiFE themes -----------------------------------------------------------
# The seven themes of Mission LiFE (Ministry of Environment, Forest and Climate Change).
LIFE_THEMES = {
    "energy": "Save energy",
    "water": "Save water",
    "plastic": "Say no to single-use plastic",
    "food": "Adopt sustainable food systems",
    "waste": "Reduce waste",
    "ewaste": "Reduce e-waste",
    "health": "Adopt healthy lifestyles",
}

# Actions that earn points but show no CO2 or kWh figure: there is no defensible per-action
# measurement for them, so the app says "impact not estimated" instead of inventing one.
POINTS_ONLY_ACTIONS = frozenset({
    "cloth_bag", "reusable_bottle", "save_water", "plant_tree", "solar_survey", "no_food_waste",
    "millet_meal", "segregate_waste", "compost", "ewaste_recycle", "repair_not_replace", "stairs",
})

# --- Everyday equivalents for CO2 (dashboard) ----------------------------------------

TREE_KG_CO2_PER_YEAR = 22  # one mature tree's yearly uptake (European Environment Agency)

# --- Sources, served by GET /api/config -------------------------------------------

SOURCES = [
    {
        "topic": "Grid emission factor",
        "value": f"{GRID_KG_CO2_PER_KWH} kg CO₂/kWh (peak-hour margin {GRID_OPERATING_MARGIN_KG_CO2_PER_KWH})",
        "source": "Central Electricity Authority, CO₂ Baseline Database for the Indian Power Sector, v21.0 "
        "(FY 2024-25 weighted average and operating margin)",
        "url": "https://cea.nic.in/cdm-co2-baseline-database/",
    },
    {
        "topic": "Cooking gas",
        "value": f"{LPG_KG_CO2_PER_CYLINDER} kg CO₂ per 14.2 kg cylinder",
        "source": "IPCC 2006 Guidelines, Vol. 2, default emission factor for LPG",
        "url": "https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html",
    },
    {
        "topic": "Commute",
        "value": ", ".join(f"{k.replace('_', ' ')} {v}" for k, v in COMMUTE_KG_CO2_PER_KM.items())
        + " kg CO₂ per passenger-km",
        "source": "India GHG Program, India Specific Road Transport Emission Factors (2015), with uplift: "
        "petrol hatchback < 1400 cc, scooter < 110 cc, city bus per passenger-km. Metro derived from Delhi Metro "
        "energy use and ridership (TERI worksheet inputs).",
        "url": "https://indiaghgp.org/sites/default/files/Road%20Transport%20Technical%20Paper.pdf",
    },
    {
        "topic": "Electricity tariffs",
        "value": "State DISCOMs urban ₹3.05/3.50/4.15/5.20 and rural ₹2.65/3.10/3.75/4.90 per unit "
        f"(0-50/51-100/101-250/250+); FPPAS ₹{STATE_FPPAS_RS_PER_KWH}/unit; duty 15% urban, 7.5% rural. "
        "Torrent Power ₹3.20/3.95/5.00 (0-50/51-200/200+) is from published summaries and is being checked "
        "against the GERC schedule",
        "source": "GERC tariff schedules for DGVCL, MGVCL, PGVCL, UGVCL and Torrent Power, effective 1 April 2026",
        "url": "https://gercin.org/tariff_schedule",
    },
    {
        "topic": "Actions without a figure",
        "value": f"{len(POINTS_ONLY_ACTIONS)} actions (plastic, water, food, waste, e-waste, trees, stairs) earn points "
        "but show no CO₂",
        "source": "No defensible per-action measurement exists for them, so Nidhi does not invent one. Electricity, "
        "cooking and travel are calculated from each household's own data",
        "url": None,
    },
    {
        "topic": "Mission LiFE themes",
        "value": ", ".join(LIFE_THEMES.values()),
        "source": "Mission LiFE, Ministry of Environment, Forest and Climate Change, Government of India",
        "url": "https://missionlife-moefcc.nic.in/",
    },
    {
        "topic": "Everyday equivalents",
        "value": f"1 km by car = {COMMUTE_KG_CO2_PER_KM['car']} kg CO₂; one mature tree takes up {TREE_KG_CO2_PER_YEAR} kg CO₂ a year",
        "source": "Commute factor above; European Environment Agency (tree uptake)",
        "url": "https://www.eea.europa.eu/",
    },
    {
        "topic": "Observed weather",
        "value": "Daily mean temperature per district; cooling degree days above 24°C",
        "source": "Open-Meteo historical weather archive (ERA5 reanalysis)",
        "url": "https://open-meteo.com/en/docs/historical-weather-api",
    },
    {
        "topic": "Peak and solar hours",
        "value": f"Peak {PEAK_HOURS[0]}:00-{PEAK_HOURS[1]}:00, solar {SOLAR_HOURS[0]}:00-{SOLAR_HOURS[1]}:00",
        "source": "Evening demand peak and solar generation window of the Gujarat grid",
        "url": None,
    },
    {
        "topic": "AC set-point",
        "value": f"{AC_SAVING_PER_DEGREE:.0%} per °C, 24°C default",
        "source": "Bureau of Energy Efficiency, default AC temperature guidelines",
        "url": "https://beeindia.gov.in/",
    },
    {
        "topic": "Rooftop solar cost",
        "value": f"₹{BENCHMARK_COST_FIRST_2KW_RS_PER_KWP:,}/kW up to 2 kW, ₹{BENCHMARK_COST_ABOVE_2KW_RS_PER_KWP:,}/kW above",
        "source": "Government of Gujarat benchmark cost for residential rooftop solar",
        "url": "https://suryagujarat.guvnl.in/",
    },
    {
        "topic": "Rooftop solar subsidy",
        "value": "₹30,000/kW for 2 kW, ₹18,000 for the 3rd kW, up to ₹78,000",
        "source": "PM Surya Ghar: Muft Bijli Yojana",
        "url": "https://pmsuryaghar.gov.in/",
    },
    {
        "topic": "Solar yield",
        "value": f"Location-specific from PVGIS; {DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP} kWh/kWp/year if unavailable",
        "source": "EU Joint Research Centre, PVGIS 5.2",
        "url": "https://re.jrc.ec.europa.eu/pvg_tools/en/",
    },
    {
        "topic": "Roof area",
        "value": f"{SQM_PER_KWP} m² of shadow-free roof per kW",
        "source": "MNRE rooftop solar guidelines",
        "url": "https://mnre.gov.in/",
    },
    {
        "topic": "Surplus solar export",
        "value": f"₹{NET_METERING_EXPORT_RS_PER_KWH}/unit",
        "source": "GERC net metering regulations, residential surplus purchase rate",
        "url": "https://gercin.org/",
    },
]
