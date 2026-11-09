"""Badges for real Mission LiFE milestones, derived from a citizen's own history.

Nothing is stored: each badge is recomputed from action logs and bill readings, so
it can't drift from the data and needs no migration when a rule changes.
"""

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class History:
    counted_by_code: dict[str, int]  # self-reported or verified actions per action code
    verified_by_code: dict[str, int]
    co2_avoided_kg: float
    action_days: set[date]  # IST days with at least one counted action
    bills: int  # monthly readings entered after onboarding


@dataclass(frozen=True)
class Badge:
    code: str
    earned: bool
    progress: float  # 0..1
    target: int


def longest_streak(days: set[date]) -> int:
    best = run = 0
    prev: date | None = None
    for d in sorted(days):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        best = max(best, run)
        prev = d
    return best


def _badge(code: str, value: float, target: int) -> Badge:
    return Badge(code=code, earned=value >= target, progress=round(min(value / target, 1.0), 2), target=target)


def badges_for(h: History) -> list[Badge]:
    return [
        _badge("first_step", sum(h.counted_by_code.values()), 1),
        _badge("peak_shifter", h.counted_by_code.get("shift_heavy_load", 0), 5),
        _badge("week_streak", longest_streak(h.action_days), 7),
        _badge("co2_10", h.co2_avoided_kg, 10),
        _badge("verified", sum(h.verified_by_code.values()), 1),
        _badge("tree_planter", h.verified_by_code.get("plant_tree", 0), 1),
        _badge("solar_step", h.counted_by_code.get("solar_survey", 0), 1),
        _badge("bill_tracker", h.bills, 3),
    ]
