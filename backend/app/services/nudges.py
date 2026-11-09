"""Rule-based behavioural nudge engine.

Pure functions: given the time, the household profile and (optionally) the
local temperature, return contextual nudges ranked by priority. Keeping this
side-effect free makes every rule unit-testable.
"""

from dataclasses import dataclass, field
from datetime import datetime

from app.i18n import tr
from app.services import factors


@dataclass(frozen=True)
class NudgeContext:
    now: datetime  # local (IST) time
    ac_count: int
    has_geyser: bool
    has_washing_machine: bool
    has_ev: bool
    has_solar: bool
    commute_mode: str
    commute_km_per_day: float
    baseline_kwh: float
    current_month_kwh: float | None = None
    temperature_c: float | None = None


@dataclass(frozen=True)
class Nudge:
    code: str
    category: str  # peak_shift | efficiency | mobility | progress
    priority: int  # higher shows first
    action_code: str | None = None  # links to a loggable ActionType
    tags: list[str] = field(default_factory=list)
    params: dict[str, object] = field(default_factory=dict)
    body_variant: str = "body"  # which catalogue entry holds the body text
    # Appliance keys shown in the text, translated at render time.
    appliances: list[str] = field(default_factory=list)

    def render(self, locale: str = "en") -> tuple[str, str]:
        params = dict(self.params)
        if self.appliances:
            names = [tr(locale, f"appliance.{a}") for a in self.appliances]
            params["loads"], params["load"] = ", ".join(names), names[0]
        prefix = f"nudge.{self.code}"
        return tr(locale, f"{prefix}.title", **params), tr(locale, f"{prefix}.{self.body_variant}", **params)

    @property
    def title(self) -> str:
        return self.render()[0]

    @property
    def body(self) -> str:
        return self.render()[1]


def _in_window(hour: int, window: tuple[int, int]) -> bool:
    start, end = window
    return start <= hour < end


def generate_nudges(ctx: NudgeContext) -> list[Nudge]:
    hour = ctx.now.hour
    peak_start, peak_end = factors.PEAK_HOURS
    solar_start, solar_end = factors.SOLAR_HOURS
    nudges: list[Nudge] = []

    heavy_loads = [
        key
        for key, present in (
            ("washing_machine", ctx.has_washing_machine),
            ("geyser", ctx.has_geyser),
            ("ev", ctx.has_ev),
        )
        if present
    ]

    if _in_window(hour, factors.PEAK_HOURS) and heavy_loads:
        nudges.append(
            Nudge(
                code="peak_defer",
                category="peak_shift",
                priority=100,
                action_code="shift_heavy_load",
                tags=["time-sensitive"],
                params={"peak_end": peak_end},
                appliances=heavy_loads,
            )
        )
    elif peak_start - 2 <= hour < peak_start and ctx.ac_count > 0:
        nudges.append(
            Nudge(code="pre_cool", category="peak_shift", priority=80, action_code="ac_24",
                  params={"peak_start": peak_start})
        )

    night = hour >= peak_end or hour < 6
    if night and heavy_loads:
        nudges.append(
            Nudge(
                code="off_peak_now",
                category="peak_shift",
                priority=45,
                action_code="shift_heavy_load",
                params={"solar_start": solar_start, "solar_end": solar_end},
                appliances=heavy_loads,
            )
        )

    if night:
        nudges.append(Nudge(code="standby_bedtime", category="efficiency", priority=35, action_code="standby_off"))

    if _in_window(hour, factors.SOLAR_HOURS) and heavy_loads:
        nudges.append(
            Nudge(
                code="solar_window",
                category="peak_shift",
                priority=60,
                action_code="shift_heavy_load",
                params={"solar_start": solar_start, "solar_end": solar_end},
                body_variant="body_own" if ctx.has_solar else "body_grid",
                appliances=heavy_loads,
            )
        )

    if ctx.ac_count > 0 and (ctx.temperature_c is None or ctx.temperature_c >= 30):
        has_temp = ctx.temperature_c is not None
        nudges.append(
            Nudge(
                code="ac_setpoint",
                category="efficiency",
                priority=70 if ctx.temperature_c and ctx.temperature_c >= 35 else 50,
                action_code="ac_24",
                params={"temp": f"{ctx.temperature_c:.0f}"} if has_temp else {},
                body_variant="body_temp" if has_temp else "body",
            )
        )

    if ctx.has_geyser and 5 <= hour < 10:
        nudges.append(Nudge(code="geyser_timer", category="efficiency", priority=55, action_code="geyser_off"))

    if ctx.commute_mode == "car" and 0 < ctx.commute_km_per_day <= 10:
        saving = ctx.commute_km_per_day * (
            factors.COMMUTE_KG_CO2_PER_KM["car"] - factors.COMMUTE_KG_CO2_PER_KM["bus"]
        )
        nudges.append(
            Nudge(
                code="short_commute",
                category="mobility",
                priority=40,
                action_code="public_transport",
                params={"km": f"{ctx.commute_km_per_day:.0f}", "kg": f"{saving:.1f}"},
            )
        )

    if ctx.current_month_kwh is not None and ctx.baseline_kwh > 0:
        change = (ctx.current_month_kwh - ctx.baseline_kwh) / ctx.baseline_kwh * 100
        if change > 5:
            nudges.append(
                Nudge(code="above_baseline", category="progress", priority=90, params={"pct": f"{change:.0f}"})
            )
        elif change < -5:
            nudges.append(
                Nudge(code="below_baseline", category="progress", priority=30, params={"pct": f"{abs(change):.0f}"})
            )

    return sorted(nudges, key=lambda n: n.priority, reverse=True)
