"""The LiFE Score (0-100) and the "homes like yours" comparison.

The comparison follows Opower's home energy reports, the best-tested nudge for cutting household
electricity: show a home its use next to similar homes nearby, and next to the efficient ones.

Score, published on the methodology page:
- Efficiency, up to 50: this month's units against the median of similar homes (or against the
  household's own baseline when fewer than 5 similar homes exist). Using the same as the peers
  scores 25; half as much scores 50; 1.5 times as much scores 0.
- Consistency, up to 30: days with at least one green action in the last 14; 10 days scores 30.
- Verified, up to 20: actions backed by an approved photo in the last 30 days; 4 scores 20.
Pure functions; the router supplies the numbers.
"""

from dataclasses import dataclass
from statistics import median

MIN_PEERS = 5
CONSISTENCY_DAYS_FOR_FULL = 10
VERIFIED_FOR_FULL = 4


@dataclass(frozen=True)
class PeerComparison:
    scope: str  # "district" | "state" | "own_baseline"
    group_size: int  # 0 for own_baseline
    my_kwh: float
    typical_kwh: float  # median of similar homes, or own baseline
    efficient_kwh: float | None  # 20th percentile of similar homes
    ratio: float  # my / typical


@dataclass(frozen=True)
class LifeScore:
    score: int
    efficiency: float
    consistency: float
    verified: float
    comparison: PeerComparison


def _p20(values: list[float]) -> float:
    s = sorted(values)
    return s[max(int(len(s) * 0.2) - 1, 0)] if len(s) > 1 else s[0]


def compare(my_kwh: float, baseline_kwh: float, district_peers: list[float], state_peers: list[float]) -> PeerComparison:
    for scope, peers in (("district", district_peers), ("state", state_peers)):
        if len(peers) >= MIN_PEERS:
            typical = median(peers)
            return PeerComparison(scope, len(peers), my_kwh, round(typical, 1), round(_p20(peers), 1),
                                  round(my_kwh / typical, 3) if typical else 1.0)
    return PeerComparison("own_baseline", 0, my_kwh, baseline_kwh, None,
                          round(my_kwh / baseline_kwh, 3) if baseline_kwh else 1.0)


def life_score(comparison: PeerComparison, active_days_14: int, verified_30: int) -> LifeScore:
    efficiency = 50 * min(max(1.5 - comparison.ratio, 0.0), 1.0)
    consistency = 30 * min(active_days_14 / CONSISTENCY_DAYS_FOR_FULL, 1.0)
    verified = 20 * min(verified_30 / VERIFIED_FOR_FULL, 1.0)
    total = round(efficiency + consistency + verified)
    return LifeScore(total, round(efficiency, 1), round(consistency, 1), round(verified, 1), comparison)
