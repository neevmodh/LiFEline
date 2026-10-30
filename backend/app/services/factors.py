"""Emission factors and tariff assumptions.

Every constant lives here so the numbers are auditable in one place. Values are
approximate defaults for Gujarat and should be checked against the latest
published sources before production use (see README "Data sources").
"""

# kg CO2 per kWh of grid electricity (CEA CO2 Baseline Database, weighted average, approx.)
GRID_KG_CO2_PER_KWH = 0.71

# kg CO2 per 14.2 kg domestic LPG cylinder (~2.98 kg CO2 per kg LPG)
LPG_KG_CO2_PER_CYLINDER = 42.3

# kg CO2 per passenger-km by commute mode (approximate)
COMMUTE_KG_CO2_PER_KM = {
    "car": 0.17,
    "two_wheeler": 0.05,
    "bus": 0.03,
    "metro": 0.02,
    "cycle_walk": 0.0,
}

COMMUTE_DAYS_PER_MONTH = 22

# Residential energy slabs (Rs/kWh), illustrative Gujarat DISCOM values.
TARIFF_SLABS: list[tuple[float, float]] = [
    (50, 3.05),
    (100, 3.50),
    (250, 4.15),
    (float("inf"), 5.20),
]
# Fuel & power purchase price adjustment, charged on every unit (Rs/kWh, illustrative).
FPPPA_PER_KWH = 2.85

# Grid time-of-day windows (24h clock, IST). Peak hours carry the highest grid
# stress and emissions; solar hours are when rooftop and utility solar peaks.
PEAK_HOURS = (18, 22)
SOLAR_HOURS = (9, 17)

# Rooftop solar
DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP = 1550  # Gujarat annual average, used if PVGIS is unavailable
SQM_PER_KWP = 10  # shadow-free roof area per kWp
COST_PER_KWP_RS = 60_000
PANEL_LIFETIME_YEARS = 25
PANEL_DEGRADATION_PER_YEAR = 0.005
NET_METERING_EXPORT_RS_PER_KWH = 2.25  # credit for surplus units exported to the grid (illustrative)


def pm_surya_ghar_subsidy(kwp: float) -> float:
    """Central subsidy for residential rooftop solar: Rs 30k/kW for the first 2 kW,
    Rs 18k for the 3rd kW, capped at Rs 78k."""
    first = min(kwp, 2) * 30_000
    third = min(max(kwp - 2, 0), 1) * 18_000
    return min(first + third, 78_000)
