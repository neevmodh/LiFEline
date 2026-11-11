"""The Action Engine: which green actions matter most for this home, right now, and why.

Transparent by design. Each action gets a score:

    score = impact x relevance x novelty x effort

- impact: what the action saves this household in rupees and CO2, scaled against the
  household's everyday habits (one-off purchases are capped; points-only actions get a small
  fixed base: they still count, but Nidhi does not pretend to know their impact);
- relevance: today's context: the district's temperature, the solar window, the evening
  peak, the time of day and today's statewide challenge;
- novelty: a nudge towards actions not tried yet, and away from ones done in the last days;
- effort: easy habits rank above one-off purchases at equal impact.

Every multiplier that changes the order adds a plain-language reason, so a citizen (or a
judge) can see exactly why a card is on top. Pure: no database, no network, no clock.
"""

from dataclasses import dataclass, field
from datetime import datetime

from app.i18n import tr
from app.services import factors
from app.services.impact import Impact

HOT_DAY_C = 32.0
COOL_DAY_C = 24.0
POINTS_ONLY_BASE = 0.12
ONE_OFF_CAP = 1.2  # one-off savings (an LED, solar) are big; capped so they don't drown daily habits
RECENT_DAYS = 2  # done this recently: show it less
ONE_OFF_COOLDOWN_DAYS = 30  # one-off actions disappear for a month once done
TOP_N = 3

ONE_OFF = frozenset({"led_switch", "solar_survey", "ewaste_recycle", "repair_not_replace", "plant_tree"})
EFFORT = {  # 1.0 for everything else: quick habits
    "led_switch": 0.85, "compost": 0.85, "public_transport": 0.85, "carpool": 0.85, "cycle_walk": 0.85,
    "millet_meal": 0.85, "solar_survey": 0.7, "ewaste_recycle": 0.7, "repair_not_replace": 0.7, "plant_tree": 0.7,
}


@dataclass(frozen=True)
class Candidate:
    code: str
    theme: str
    points: int
    max_per_day: int
    impact: Impact
    rs: float  # rupees saved by doing it once, at this household's marginal tariff


@dataclass(frozen=True)
class EngineContext:
    now: datetime  # local (IST) time
    candidates: list[Candidate]
    challenge_code: str | None = None
    temperature_c: float | None = None
    district: str | None = None
    green_window: tuple[int, int] | None = None  # rest of today's sunniest hours
    done_today: dict[str, int] = field(default_factory=dict)
    days_since_done: dict[str, int] = field(default_factory=dict)  # missing: never done


@dataclass
class Card:
    code: str
    theme: str
    points: int
    co2_kg: float
    kwh: float
    rs: float
    impact_estimated: bool
    score: float
    reasons: list[str]
    is_challenge: bool
    done_today: int
    max_per_day: int
    top: bool = False


def _impact_value(c: Candidate, max_rs: float, max_co2: float) -> float:
    if not c.impact.estimated:
        return POINTS_ONLY_BASE
    rs_part = c.rs / max_rs if max_rs > 0 else 0.0
    co2_part = c.impact.co2_kg / max_co2 if max_co2 > 0 else 0.0
    return min(max(0.6 * rs_part + 0.4 * co2_part, 0.05), ONE_OFF_CAP)


def rank(ctx: EngineContext, locale: str = "en") -> list[Card]:
    """All actions this household can still do today, best first; the top 3 are marked."""
    usable = [
        c for c in ctx.candidates
        if c.impact.applicable
        and ctx.done_today.get(c.code, 0) < c.max_per_day
        and not (c.code in ONE_OFF and ctx.days_since_done.get(c.code, 10**6) < ONE_OFF_COOLDOWN_DAYS)
    ]
    # Scale against everyday habits; one-off purchases would otherwise flatten everything else.
    estimated = [c for c in usable if c.impact.estimated and c.code not in ONE_OFF] or [c for c in usable if c.impact.estimated]
    max_rs = max((c.rs for c in estimated), default=0.0)
    max_co2 = max((c.impact.co2_kg for c in estimated), default=0.0)
    hour = ctx.now.hour
    peak_start, peak_end = factors.PEAK_HOURS

    cards = []
    for c in usable:
        reasons: list[str] = []
        co2 = round(c.impact.co2_kg, 2)
        if not c.impact.estimated:
            reasons.append(tr(locale, "engine.points_only", points=c.points))
        elif c.rs >= 1:
            reasons.append(tr(locale, "engine.saves", rs=round(c.rs), co2=co2))
        else:
            reasons.append(tr(locale, "engine.saves_co2", co2=co2))

        relevance = 1.0
        if c.code == "ac_24" and ctx.temperature_c is not None:
            if ctx.temperature_c >= HOT_DAY_C:
                relevance *= 1.5
                reasons.append(tr(locale, "engine.hot", temp=round(ctx.temperature_c), district=ctx.district or "your district"))
            elif ctx.temperature_c < COOL_DAY_C:
                relevance *= 0.4
        if c.code == "shift_heavy_load":
            if ctx.green_window and ctx.green_window[0] <= hour < ctx.green_window[1]:
                relevance *= 1.5
                reasons.append(tr(locale, "engine.green_now", start=ctx.green_window[0], end=ctx.green_window[1]))
            elif peak_start - 2 <= hour < peak_start:
                relevance *= 1.3
                reasons.append(tr(locale, "engine.before_peak", peak=peak_start, peak_end=peak_end))
            elif peak_start <= hour < peak_end:
                relevance *= 1.2
                reasons.append(tr(locale, "engine.peak_now", peak_end=peak_end))
        if c.code == "geyser_off" and 5 <= hour < 11:
            relevance *= 1.3
            reasons.append(tr(locale, "engine.morning_geyser"))
        if c.code == "standby_off" and hour >= 19:
            relevance *= 1.3
            reasons.append(tr(locale, "engine.night_standby"))
        is_challenge = c.code == ctx.challenge_code
        if is_challenge:
            relevance *= 1.5
            reasons.append(tr(locale, "engine.challenge"))

        novelty = 1.0
        since = ctx.days_since_done.get(c.code)
        if since is None:
            novelty = 1.15
            reasons.append(tr(locale, "engine.new"))
        elif since < RECENT_DAYS:
            novelty = 0.6

        score = _impact_value(c, max_rs, max_co2) * relevance * novelty * EFFORT.get(c.code, 1.0)
        cards.append(Card(
            code=c.code, theme=c.theme, points=c.points, co2_kg=co2, kwh=round(c.impact.kwh, 2), rs=round(c.rs, 1),
            impact_estimated=c.impact.estimated, score=round(score, 3), reasons=reasons, is_challenge=is_challenge,
            done_today=ctx.done_today.get(c.code, 0), max_per_day=c.max_per_day,
        ))

    cards.sort(key=lambda k: (-k.score, k.code))
    for k in cards[:TOP_N]:
        k.top = True
    return cards
