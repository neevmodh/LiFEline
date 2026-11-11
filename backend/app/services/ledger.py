"""Impact Ledger: what the model estimates, what people reported, and what GEDA verified.

The buckets never mix. "estimated" is a month of each household's plan; the others come
from logged actions by their review status, and rejected actions count nowhere.
"""

from dataclasses import dataclass
from typing import Literal, get_args

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ActionLog, ActionStatus, ActionType, User
from app.services import factors
from app.services.plan import build_plan
from app.services.stats import period_start

Status = Literal["estimated", "self_reported", "pending", "verified"]
STATUSES: tuple[Status, ...] = get_args(Status)
ESTIMATED: Status = "estimated"


@dataclass
class Figures:
    kwh: float = 0.0
    co2_kg: float = 0.0
    rs: float = 0.0
    actions: int = 0

    def add(self, other: "Figures") -> None:
        self.kwh += other.kwh
        self.co2_kg += other.co2_kg
        self.rs += other.rs
        self.actions += other.actions

    def rounded(self) -> dict:
        return {"kwh": round(self.kwh, 2), "co2_kg": round(self.co2_kg, 2), "rs": round(self.rs, 1), "actions": self.actions}


def _by_status() -> dict[str, Figures]:
    return {s: Figures() for s in STATUSES}


@dataclass
class Ledger:
    by_status: dict[str, Figures]
    by_theme: dict[str, dict[str, Figures]]

    @classmethod
    def empty(cls) -> "Ledger":
        return cls(by_status=_by_status(), by_theme={t: _by_status() for t in factors.LIFE_THEMES})

    def add(self, theme: str, status: str, figures: Figures) -> None:
        if status not in STATUSES:
            return
        self.by_status[status].add(figures)
        self.by_theme.setdefault(theme, _by_status())[status].add(figures)

    def rounded(self) -> dict:
        return {
            "by_status": {s: f.rounded() for s, f in self.by_status.items()},
            "by_theme": {t: {s: f.rounded() for s, f in fs.items()} for t, fs in self.by_theme.items()},
        }


def ledger_for(db: Session, users: list[User], period: str) -> Ledger:
    """Summed over these users. Rupees for logged kWh use each household's own marginal slab rate."""
    themes = dict(db.execute(select(ActionType.code, ActionType.theme)).all())
    ledger = Ledger.empty()
    rate: dict[int, float] = {}
    for u in users:
        if u.household is None:
            continue
        plan = build_plan(u.household)
        rate[u.id] = plan.marginal_rs_per_kwh
        for i in plan.items:
            if i.kind == "habit":  # solar is an investment; the plan's monthly total leaves it out too
                ledger.add(themes.get(i.action_code, "energy"), ESTIMATED, Figures(i.kwh_month, i.co2_month_kg, i.rs_month))

    q = (
        select(ActionLog.user_id, ActionType.theme, ActionLog.status,
               func.sum(ActionLog.kwh_saved), func.sum(ActionLog.co2_saved_kg), func.count(ActionLog.id))
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(ActionLog.user_id.in_([u.id for u in users]), ActionLog.status != ActionStatus.rejected)
        .group_by(ActionLog.user_id, ActionType.theme, ActionLog.status)
    )
    if (start := period_start(period)) is not None:
        q = q.where(ActionLog.created_at >= start)
    for uid, theme, st, kwh, co2, n in db.execute(q).all():
        kwh, co2 = float(kwh or 0), float(co2 or 0)
        ledger.add(theme, st.value, Figures(kwh, co2, kwh * rate.get(uid, 0.0), int(n)))
    return ledger
