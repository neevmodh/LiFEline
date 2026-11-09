import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)

from app.timeutil import as_utc

# SQLite drops tzinfo; timestamps are stored in UTC, so re-attach it before serialising.
UtcDatetime = Annotated[datetime, AfterValidator(as_utc)]

MAX_PASSWORD_BYTES = 72

Discom = Literal["dgvcl", "mgvcl", "pgvcl", "ugvcl", "torrent"]
CommuteMode = Literal["car", "two_wheeler", "bus", "metro", "cycle_walk"]


def normalise_ward(value: str | None) -> str | None:
    """One spelling per ward, so "ward-3", "3", "Ward 03" and "WARD 3" share a leaderboard."""
    if value is None:
        return None
    text = " ".join(value.replace("_", " ").split())
    if not text:
        return None
    m = re.fullmatch(r"(?:ward)?\s*(?:no\.?|number|#)?\s*[-:.]?\s*0*(\d+)", text, flags=re.IGNORECASE)
    if m:
        return f"Ward {int(m.group(1))}"
    return text.title() if text.islower() or text.isupper() else text


Ward = Annotated[str | None, AfterValidator(normalise_ward)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth -------------------------------------------------------------------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=120)
    district_id: int
    ward: Ward = Field(default=None, max_length=80)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, v: str) -> str:
        # bcrypt only accepts 72 bytes; non-ASCII characters take several bytes each.
        if len(v.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    email: str
    name: str
    role: str
    district_id: int | None
    ward: str | None
    onboarded: bool = False
    society_id: int | None = None
    society_role: str | None = None  # member | committee


class ProfileUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    district_id: int | None = None
    ward: Ward = Field(default=None, max_length=80)


class TokenOut(BaseModel):
    token: str
    user: UserOut


class DistrictOut(ORM):
    id: int
    name: str
    lat: float
    lon: float
    suggested_discom: str = "ugvcl"  # the distribution company most of the district is served by


# --- footprint & household --------------------------------------------------

class FootprintIn(BaseModel):
    monthly_kwh: float = Field(ge=0, le=10_000)
    members: int = Field(ge=1, le=30)
    lpg_cylinders_per_month: float = Field(ge=0, le=10)
    commute_mode: CommuteMode
    commute_km_per_day: float = Field(ge=0, le=500)


class FootprintPreviewIn(FootprintIn):
    # Optional so the live preview can show the bill for the household's own tariff.
    discom: Discom = "ugvcl"
    area: Literal["urban", "rural"] = "urban"


class FootprintOut(BaseModel):
    electricity_kg: float
    cooking_kg: float
    commute_kg: float
    total_kg: float
    per_capita_kg: float
    monthly_bill_rs: float


class HouseholdIn(FootprintIn):
    home_type: Literal["apartment", "independent", "row_house"] = "apartment"
    ac_count: int = Field(ge=0, le=20)
    has_geyser: bool
    has_washing_machine: bool
    has_ev: bool
    has_solar: bool
    roof_area_sqm: float | None = Field(default=None, ge=0, le=5000)
    discom: Discom = "ugvcl"
    area: Literal["urban", "rural"] = "urban"


class HouseholdOut(ORM):
    members: int
    home_type: str
    monthly_kwh: float
    lpg_cylinders_per_month: float
    commute_mode: str
    commute_km_per_day: float
    ac_count: int
    has_geyser: bool
    has_washing_machine: bool
    has_ev: bool
    has_solar: bool
    roof_area_sqm: float | None
    discom: str
    area: str
    baseline_kg_co2_month: float


class OnboardingOut(BaseModel):
    household: HouseholdOut
    footprint: FootprintOut


class ReadingIn(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM")
    kwh: float = Field(ge=0, le=10_000)


class ReadingOut(BaseModel):
    month: str
    kwh: float
    kg_co2: float
    bill_rs: float
    change_vs_baseline_pct: float


# --- actions & gamification -------------------------------------------------

class ActionTypeOut(ORM):
    id: int
    code: str
    title: str
    description: str
    category: str
    points: int
    co2_saved_kg: float  # for this user's household when signed in, otherwise a typical household
    kwh_saved: float
    max_per_day: int
    applicable: bool = True
    not_applicable_reason: str | None = None


class ActionLogOut(BaseModel):
    id: int
    action: ActionTypeOut
    status: str
    points_awarded: int
    co2_saved_kg: float
    kwh_saved: float
    is_daily_challenge: bool
    note: str | None
    has_proof: bool
    created_at: UtcDatetime


class DailyChallengeOut(BaseModel):
    date: date
    action: ActionTypeOut
    completed: bool
    multiplier: int


class NudgeOut(BaseModel):
    code: str
    title: str
    body: str
    category: str
    priority: int
    action_code: str | None
    tags: list[str]


class NudgesOut(BaseModel):
    temperature_c: float | None
    generated_at: datetime
    nudges: list[NudgeOut]


class LevelOut(BaseModel):
    level: int
    title: str
    points: int
    next_level_at: int


class TrendPoint(BaseModel):
    month: str
    kwh: float
    kg_co2: float


class DashboardOut(BaseModel):
    user: UserOut
    footprint: FootprintOut
    level: LevelOut
    streak_days: int
    actions_logged: int
    co2_saved_kg: float
    kwh_saved: float
    district_rank: int | None
    district_participants: int
    trend: list[TrendPoint]
    daily_challenge: DailyChallengeOut


# --- leaderboards -----------------------------------------------------------

Period = Literal["week", "month", "all"]


class UserRankOut(BaseModel):
    rank: int
    user_id: int
    name: str
    district: str | None
    ward: str | None
    points: int
    co2_saved_kg: float
    is_me: bool


class DistrictRankOut(BaseModel):
    rank: int
    district_id: int
    district: str
    participants: int
    co2_saved_kg: float
    co2_saved_per_participant_kg: float
    monthly_goal_kg: float
    goal_progress_pct: float


# --- solar ------------------------------------------------------------------

class SolarIn(BaseModel):
    roof_area_sqm: float = Field(gt=0, le=5000)
    monthly_kwh: float = Field(gt=0, le=10_000)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    district_id: int | None = None
    discom: Discom = "ugvcl"
    area: Literal["urban", "rural"] = "urban"


class SolarOut(BaseModel):
    recommended_kwp: float
    limited_by: str
    specific_yield_kwh_per_kwp: float
    yield_source: str
    annual_generation_kwh: float
    annual_savings_rs: float
    gross_cost_rs: float
    subsidy_rs: float
    net_cost_rs: float
    payback_years: float | None
    annual_co2_avoided_kg: float
    lifetime_savings_rs: float


# --- bill scan --------------------------------------------------------------

class BillScanOut(BaseModel):
    units_kwh: float | None
    billing_days: int | None
    billing_period_end: str | None
    bill_amount_rs: float | None
    distributor: str | None
    confidence: Literal["high", "medium", "low"]
    monthly_kwh: float | None
    provider: Literal["groq", "anthropic"]


# --- admin ------------------------------------------------------------------

class DistrictStatOut(BaseModel):
    district_id: int
    district: str
    lat: float
    lon: float
    citizens: int
    active_7d: int
    actions_30d: int
    participation_pct: float | None
    co2_saved_30d_kg: float
    co2_per_citizen_30d_kg: float | None
    avg_baseline_kg: float | None
    solar_potential_kwp: float


class CategoryStatOut(BaseModel):
    category: str
    actions: int
    co2_saved_kg: float


class WeeklyPointOut(BaseModel):
    week_start: date
    actions: int
    co2_saved_kg: float
    active_citizens: int


class AdminOverviewOut(BaseModel):
    citizens: int
    onboarded: int
    active_7d: int
    actions_total: int
    co2_saved_total_kg: float
    co2_verified_total_kg: float  # the part backed by an admin-approved photo
    kwh_saved_total: float
    pending_reviews: int
    districts: list[DistrictStatOut]
    categories: list[CategoryStatOut]
    weekly: list[WeeklyPointOut]


class SolarPotentialOut(BaseModel):
    suitable_households: int = 0
    installed_households: int = 0
    potential_kwp: float = 0.0
    annual_generation_kwh: float = 0.0
    annual_co2_avoided_t: float = 0.0
    subsidy_pipeline_rs: float = 0.0


class ConsumptionPointOut(BaseModel):
    month: str
    avg_kwh: float
    households: int


class WardStatOut(BaseModel):
    ward: str
    citizens: int
    co2_saved_30d_kg: float


class DistrictDetailOut(BaseModel):
    district_id: int
    district: str
    citizens: int
    onboarded: int
    active_7d: int
    participation_pct: float | None
    actions_30d: int
    co2_saved_30d_kg: float
    kwh_saved_30d: float
    peak_shifts_30d: int
    avg_baseline_kg: float | None
    consumption: list[ConsumptionPointOut]
    categories: list["CategoryStatOut"]
    weekly: list["WeeklyPointOut"]
    top_wards: list[WardStatOut]
    solar: SolarPotentialOut
    solar_survey_requests: int


class ReviewItemOut(BaseModel):
    id: int
    user_name: str
    district: str | None
    action_title: str
    note: str | None
    created_at: UtcDatetime
    ai_verdict: str | None = None  # likely | unlikely | unsure; None if not screened
    ai_confidence: float | None = None
    ai_reason: str | None = None


class ReviewDecisionIn(BaseModel):
    approve: bool


# --- methodology ----------------------------------------------------------------

class SourceOut(BaseModel):
    topic: str
    value: str
    source: str
    url: str | None


class DiscomOut(BaseModel):
    code: str
    name: str


class ConfigOut(BaseModel):
    peak_hours: tuple[int, int]
    solar_hours: tuple[int, int]
    sqm_per_kwp: float
    grid_kg_co2_per_kwh: float
    car_kg_co2_per_km: float
    tree_kg_co2_per_year: float
    discoms: list[DiscomOut]
    sources: list[SourceOut]


# --- weather-adjusted savings ----------------------------------------------------

class WeatherModelOut(BaseModel):
    slope_kwh_per_cdd: float  # extra kWh per cooling degree day
    source: Literal["household", "district", "state", "none"]
    months_used: int  # household: months of bills; district/state: households pooled


class AdjustedMonthOut(BaseModel):
    month: str
    kwh: float
    cooling_degree_days: float
    expected_kwh: float
    saving_pct: float
    above_expected: bool


class WeatherInsightOut(BaseModel):
    available: bool
    reason: str | None = None
    baseline_month: str | None = None
    baseline_kwh: float | None = None
    baseline_cdd: float | None = None
    model: WeatherModelOut | None = None
    months: list[AdjustedMonthOut] = []


# --- green hours -------------------------------------------------------------------

class GreenWindowOut(BaseModel):
    date: date
    start_hour: int
    end_hour: int
    avg_radiation_w_m2: float
    sky: Literal["sunny", "partly_cloudy", "cloudy"]


class GreenHoursOut(BaseModel):
    today: GreenWindowOut | None = None
    tomorrow: GreenWindowOut | None = None
    peak_hours: tuple[int, int]
    district: str | None = None


# --- live booth feed ----------------------------------------------------------------

class ActivityOut(BaseModel):
    kind: Literal["joined", "action", "proof"]
    at: UtcDatetime
    first_name: str
    district: str | None
    action_title: str | None = None
    co2_saved_kg: float | None = None


# --- solar what-if ----------------------------------------------------------------

class ScenarioRateOut(BaseModel):
    capacity_mw: float
    annual_co2_avoided_t: float
    annual_bill_savings_rs: float
    subsidy_needed_rs: float


class SolarScenarioOut(BaseModel):
    district: str
    adoption_pct: float
    registered_homes: int  # registered, no solar yet, roof area given
    suitable_homes: int  # roof big enough for at least 0.5 kW
    adopting_homes: float  # suitable homes × adoption share (a rate, so it can be fractional)
    capacity_mw: float
    annual_generation_mwh: float
    annual_co2_avoided_t: float
    annual_bill_savings_rs: float
    subsidy_needed_rs: float  # PM Surya Ghar central subsidy
    household_investment_rs: float  # after subsidy
    payback_years: float | None
    yield_source: Literal["pvgis", "default"]
    per_1000_homes: ScenarioRateOut


# --- footprint over time --------------------------------------------------------------

class FootprintMonthOut(BaseModel):
    month: str
    electricity_kg: float  # from that month's bill
    cooking_kg: float
    commute_kg: float
    total_kg: float
    avoided_kg: float  # CO2 avoided by green actions logged that month (self-reported + verified)
    actions: int


class FootprintHistoryOut(BaseModel):
    baseline_kg: float
    months: list[FootprintMonthOut]


class BadgeOut(BaseModel):
    code: str
    earned: bool
    progress: float
    target: int


# --- appliance upgrade ---------------------------------------------------------------

class ApplianceIn(BaseModel):
    """Annual units as printed on each appliance's BEE star label."""

    appliance: Literal["ac", "refrigerator", "geyser", "fan", "tv", "other"]
    old_kwh_per_year: float = Field(gt=0, le=20_000)
    new_kwh_per_year: float = Field(gt=0, le=20_000)
    new_price_rs: float | None = Field(default=None, ge=0, le=1_000_000)


class ApplianceOut(BaseModel):
    kwh_saved_per_year: float
    rs_saved_per_year: float  # at the household's own tariff, from its monthly use
    co2_saved_kg_per_year: float
    payback_years: float | None
    ten_year_savings_rs: float


# --- personal savings plan -------------------------------------------------------------

class PlanItemOut(BaseModel):
    code: str
    kind: Literal["habit", "investment"]
    effort: Literal["easy", "medium", "investment"]
    title: str
    why: str
    kwh_month: float
    rs_month: float
    co2_month_kg: float
    action_code: str | None
    logged_today: bool


class PlanOut(BaseModel):
    bill_rs: float
    marginal_rs_per_kwh: float  # what one more or fewer unit costs this household right now
    items: list[PlanItemOut]
    total_rs_month: float  # all habit steps together; solar is separate
    total_co2_month_kg: float
    slab_note: str | None
    slab_rs_month: float | None


# --- societies and committees ----------------------------------------------------------

class SocietyCreateIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    goal_kg_month: float | None = Field(default=None, gt=0, le=1_000_000)


class SocietyJoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=10)


class SocietyGoalIn(BaseModel):
    goal_kg_month: float | None = Field(default=None, gt=0, le=1_000_000)


class AnnouncementIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class AnnouncementOut(BaseModel):
    id: int
    text: str
    author: str  # first name
    created_at: UtcDatetime


class SocietyMemberOut(BaseModel):
    user_id: int
    first_name: str
    role: str
    actions_this_month: int


class SocietyOut(BaseModel):
    id: int
    name: str
    district: str
    role: str  # my role: member | committee
    member_count: int
    join_code: str | None  # committee only
    stats_visible: bool  # false until enough members that no household stands out
    min_group_size: int
    co2_avoided_kg: float | None
    actions: int | None
    goal_kg_month: float | None
    goal_progress_pct: float | None
    rank: int | None  # among societies in the district (only ranked societies)
    announcements: list[AnnouncementOut]
    members: list[SocietyMemberOut] | None  # committee only


class SocietyRankOut(BaseModel):
    rank: int
    society_id: int
    name: str
    district: str
    members: int
    co2_per_member_kg: float
    is_mine: bool
