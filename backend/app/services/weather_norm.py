"""Weather-adjusted electricity savings.

A household that used less electricity in a cool month hasn't necessarily saved
anything, and one that used more in a heatwave may have done well. Utilities
handle this with degree-day regression, and so does Nidhi:

    monthly kWh = base load + slope × cooling degree days

The slope (kWh per degree day) is learned from the household's own bills when
it has at least three months with different weather. Until then it borrows the
slope learned from every household in its district (each household keeps its
own base load), then from the whole state. The saving for a month is how far
the bill came in under what the weather alone would have produced from the
household's starting point.

Pure functions, no I/O: everything is tested with plain numbers.
"""

from dataclasses import dataclass
from datetime import date

MIN_MONTHS = 3
MIN_CDD_SPREAD = 20.0  # degree days between the coolest and hottest month, or the slope is noise
ABOVE_EXPECTED_ALERT = 0.15  # flag a month 15% above what the weather explains


@dataclass(frozen=True)
class Point:
    month: date
    kwh: float
    cdd: float


@dataclass(frozen=True)
class Model:
    slope_kwh_per_cdd: float
    source: str  # household | district | state | none
    months_used: int


@dataclass(frozen=True)
class AdjustedMonth:
    month: date
    kwh: float
    cdd: float
    expected_kwh: float  # baseline consumption, adjusted for this month's weather
    saving_pct: float  # positive = used less than the weather explains
    above_expected: bool


def household_slope(points: list[Point]) -> float | None:
    """Least-squares slope of kWh on CDD, or None if there isn't enough weather variation."""
    if len(points) < MIN_MONTHS:
        return None
    cdds = [p.cdd for p in points]
    if max(cdds) - min(cdds) < MIN_CDD_SPREAD:
        return None
    mean_c = sum(cdds) / len(cdds)
    mean_k = sum(p.kwh for p in points) / len(points)
    var = sum((c - mean_c) ** 2 for c in cdds)
    cov = sum((p.cdd - mean_c) * (p.kwh - mean_k) for p in points)
    # Hotter weather never lowers consumption; a negative fit is noise from other changes.
    return max(cov / var, 0.0)


def pooled_slope(households: list[list[Point]]) -> tuple[float | None, int]:
    """One slope shared by many households, each with its own base load (within-household
    regression). Returns (slope, number of households that contributed)."""
    num = den = 0.0
    used = 0
    for points in households:
        if len(points) < 2:
            continue
        mean_c = sum(p.cdd for p in points) / len(points)
        mean_k = sum(p.kwh for p in points) / len(points)
        num += sum((p.cdd - mean_c) * (p.kwh - mean_k) for p in points)
        den += sum((p.cdd - mean_c) ** 2 for p in points)
        used += 1
    if used < MIN_MONTHS or den < MIN_CDD_SPREAD**2:
        return None, used
    return max(num / den, 0.0), used


def choose_model(own: list[Point], district: list[list[Point]], state: list[list[Point]]) -> Model:
    slope = household_slope(own)
    if slope is not None:
        return Model(round(slope, 3), "household", len(own))
    for source, group in (("district", district), ("state", state)):
        slope, used = pooled_slope(group)
        if slope is not None:
            return Model(round(slope, 3), source, used)
    return Model(0.0, "none", 0)


def adjust(points: list[Point], baseline: Point, model: Model) -> list[AdjustedMonth]:
    """Compare each month with the baseline month's consumption carried to that month's weather."""
    out = []
    for p in sorted(points, key=lambda p: p.month):
        expected = max(baseline.kwh + model.slope_kwh_per_cdd * (p.cdd - baseline.cdd), 1.0)
        saving = (expected - p.kwh) / expected * 100
        out.append(
            AdjustedMonth(
                month=p.month,
                kwh=p.kwh,
                cdd=p.cdd,
                expected_kwh=round(expected, 1),
                saving_pct=round(saving, 1),
                above_expected=p.kwh > expected * (1 + ABOVE_EXPECTED_ALERT),
            )
        )
    return out
