"""Impact Ledger: what the model estimates, what people reported, and what GEDA verified.

The buckets never mix. "estimated" is a month of the household's plan (habit steps only,
like the plan's own total). The others come from logged actions by their review status;
rejected actions count nowhere. Pure functions, no I/O.
"""

from dataclasses import dataclass

from app.services import factors

STATUSES = ("estimated", "self_reported", "pending", "verified")


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


@dataclass(frozen=True)
class Entry:
    theme: str
    status: str  # one of STATUSES
    figures: Figures


@dataclass
class Ledger:
    by_status: dict[str, Figures]
    by_theme: dict[str, dict[str, Figures]]

    @classmethod
    def empty(cls) -> "Ledger":
        return cls(
            by_status={s: Figures() for s in STATUSES},
            by_theme={t: {s: Figures() for s in STATUSES} for t in factors.LIFE_THEMES},
        )

    def add(self, entry: Entry) -> None:
        if entry.status not in STATUSES:
            return  # rejected, or anything else not in the ledger
        self.by_status[entry.status].add(entry.figures)
        self.by_theme.setdefault(entry.theme, {s: Figures() for s in STATUSES})[entry.status].add(entry.figures)
