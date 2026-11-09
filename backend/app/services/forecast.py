"""Mid-month bill forecast.

The citizen reads their meter part-way through the month; we project the month's units by
assuming the rest of the month looks like the days so far, then price it with the DISCOM's
own slabs. It is a straight-line projection, and the response says so.
"""

import calendar
from dataclasses import dataclass

from app.services import factors
from app.services.footprint import electricity_bill_rs


@dataclass(frozen=True)
class Forecast:
    day: int
    days_in_month: int
    used_kwh: float
    projected_kwh: float
    projected_bill_rs: float
    daily_kwh: float
    next_slab_kwh: float | None  # where the next, dearer slab starts, if the projection will cross it
    kwh_to_next_slab: float | None  # units still to use before that (negative: already crossed)
    daily_budget_kwh: float | None  # daily units that keep the month inside the current slab
    bill_if_budget_rs: float | None


def forecast(used_kwh: float, day: int, year: int, month: int, discom: str, area: str) -> Forecast:
    days = calendar.monthrange(year, month)[1]
    day = max(1, min(day, days))
    daily = used_kwh / day
    projected = round(daily * days, 1)
    bill = electricity_bill_rs(projected, discom, area)

    tariff = factors.TARIFFS.get((discom, area)) or factors.TARIFFS[(factors.DEFAULT_DISCOM, factors.DEFAULT_AREA)]
    boundary = next((upper for upper, _ in tariff.slabs if projected <= upper and upper != float("inf")), None)
    nxt = to_next = budget = budget_bill = None
    # Warn when the projection sits in or just past a slab edge that the household can still stay under.
    prev_edges = [u for u, _ in tariff.slabs if u != float("inf") and u < projected]
    if prev_edges and used_kwh <= prev_edges[-1] and day < days:
        edge = prev_edges[-1]
        nxt, to_next = float(edge), round(edge - used_kwh, 1)
        budget = round((edge - used_kwh) / (days - day), 2)
        budget_bill = electricity_bill_rs(edge, discom, area)
    elif boundary is not None and projected > boundary * 0.9 and day < days and used_kwh <= boundary:
        nxt, to_next = float(boundary), round(boundary - used_kwh, 1)
        budget = round((boundary - used_kwh) / (days - day), 2)
        budget_bill = electricity_bill_rs(boundary, discom, area)
    return Forecast(day, days, used_kwh, projected, bill, round(daily, 2), nxt, to_next, budget, budget_bill)
