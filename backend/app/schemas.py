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

CommuteMode = Literal["car", "two_wheeler", "bus", "metro", "cycle_walk"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth -------------------------------------------------------------------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=120)
    district_id: int
    ward: str | None = Field(default=None, max_length=80)

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


class ProfileUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    district_id: int | None = None
    ward: str | None = Field(default=None, max_length=80)


class TokenOut(BaseModel):
    token: str
    user: UserOut


class DistrictOut(ORM):
    id: int
    name: str
    lat: float
    lon: float


# --- footprint & household --------------------------------------------------

class FootprintIn(BaseModel):
    monthly_kwh: float = Field(ge=0, le=10_000)
    members: int = Field(ge=1, le=30)
    lpg_cylinders_per_month: float = Field(ge=0, le=10)
    commute_mode: CommuteMode
    commute_km_per_day: float = Field(ge=0, le=500)


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
    co2_saved_kg: float
    kwh_saved: float
    max_per_day: int


class ActionLogOut(BaseModel):
    id: int
    action: ActionTypeOut
    status: str
    points_awarded: int
    co2_saved_kg: float
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


class ReviewDecisionIn(BaseModel):
    approve: bool
