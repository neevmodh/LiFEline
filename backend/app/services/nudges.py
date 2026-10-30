"""Rule-based behavioural nudge engine.

Pure functions: given the time, the household profile and (optionally) the
local temperature, return contextual nudges ranked by priority. Keeping this
side-effect free makes every rule unit-testable.
"""

from dataclasses import dataclass, field
from datetime import datetime

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
    title: str
    body: str
    category: str  # peak_shift | efficiency | mobility | progress
    priority: int  # higher shows first
    action_code: str | None = None  # links to a loggable ActionType
    tags: list[str] = field(default_factory=list)


def _in_window(hour: int, window: tuple[int, int]) -> bool:
    start, end = window
    return start <= hour < end


def generate_nudges(ctx: NudgeContext) -> list[Nudge]:
    hour = ctx.now.hour
    peak_start, peak_end = factors.PEAK_HOURS
    nudges: list[Nudge] = []

    heavy_loads = [
        name
        for name, present in (
            ("washing machine", ctx.has_washing_machine),
            ("geyser", ctx.has_geyser),
            ("EV charging", ctx.has_ev),
        )
        if present
    ]

    if _in_window(hour, factors.PEAK_HOURS) and heavy_loads:
        nudges.append(
            Nudge(
                code="peak_defer",
                title="Peak grid hours right now",
                body=(
                    f"Demand on the grid peaks until {peak_end}:00. Hold off on "
                    f"{', '.join(heavy_loads)} until after {peak_end}:00 to cut load "
                    "when the grid relies most on fossil power."
                ),
                category="peak_shift",
                priority=100,
                action_code="shift_heavy_load",
                tags=["time-sensitive"],
            )
        )
    elif peak_start - 2 <= hour < peak_start and ctx.ac_count > 0:
        nudges.append(
            Nudge(
                code="pre_cool",
                title=f"Peak starts at {peak_start}:00 - pre-cool now",
                body="Run the AC now and raise it to 26°C during peak hours. "
                "Your home stays comfortable while peak demand drops.",
                category="peak_shift",
                priority=80,
                action_code="ac_24",
            )
        )

    if _in_window(hour, factors.SOLAR_HOURS) and heavy_loads:
        source = "your rooftop panels" if ctx.has_solar else "solar plants feeding the grid"
        nudges.append(
            Nudge(
                code="solar_window",
                title="Solar hours: best time for heavy loads",
                body=f"Between {factors.SOLAR_HOURS[0]}:00 and {factors.SOLAR_HOURS[1]}:00 "
                f"{source} supply the most clean power. Run the {heavy_loads[0]} now.",
                category="peak_shift",
                priority=60,
                action_code="shift_heavy_load",
            )
        )

    if ctx.ac_count > 0 and (ctx.temperature_c is None or ctx.temperature_c >= 30):
        temp_note = f"It's {ctx.temperature_c:.0f}°C outside. " if ctx.temperature_c is not None else ""
        nudges.append(
            Nudge(
                code="ac_setpoint",
                title="Set your AC to 24°C",
                body=f"{temp_note}Every degree higher saves about 6% of AC electricity. "
                "24°C is the BEE-recommended default.",
                category="efficiency",
                priority=70 if ctx.temperature_c and ctx.temperature_c >= 35 else 50,
                action_code="ac_24",
            )
        )

    if ctx.has_geyser and 5 <= hour < 10:
        nudges.append(
            Nudge(
                code="geyser_timer",
                title="Switch the geyser off after use",
                body="A geyser left on standby keeps reheating water. Switch it off "
                "right after your bath, or set it to 50°C.",
                category="efficiency",
                priority=55,
                action_code="geyser_off",
            )
        )

    if ctx.commute_mode == "car" and 0 < ctx.commute_km_per_day <= 10:
        nudges.append(
            Nudge(
                code="short_commute",
                title="Your commute is short enough to ditch the car",
                body=f"{ctx.commute_km_per_day:.0f} km a day by bus, metro or cycle avoids about "
                f"{ctx.commute_km_per_day * (factors.COMMUTE_KG_CO2_PER_KM['car'] - factors.COMMUTE_KG_CO2_PER_KM['bus']):.1f} "
                "kg CO2 every day.",
                category="mobility",
                priority=40,
                action_code="public_transport",
            )
        )

    if ctx.current_month_kwh is not None and ctx.baseline_kwh > 0:
        change = (ctx.current_month_kwh - ctx.baseline_kwh) / ctx.baseline_kwh * 100
        if change > 5:
            nudges.append(
                Nudge(
                    code="above_baseline",
                    title=f"You're {change:.0f}% above your baseline",
                    body="This month's usage is higher than when you started. "
                    "Check the AC set-point and switch appliances off at the plug.",
                    category="progress",
                    priority=90,
                )
            )
        elif change < -5:
            nudges.append(
                Nudge(
                    code="below_baseline",
                    title=f"{abs(change):.0f}% below your baseline - great work",
                    body="Keep it going. Your ward's leaderboard rank depends on it.",
                    category="progress",
                    priority=30,
                )
            )

    return sorted(nudges, key=lambda n: n.priority, reverse=True)
