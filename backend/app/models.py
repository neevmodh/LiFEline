import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    citizen = "citizen"
    admin = "admin"  # GEDA state team: every district
    officer = "officer"  # GEDA district officer: their own district (users.district_id)
    reviewer = "reviewer"  # GEDA proof reviewer: the review queue only (their district if one is set)
    auditor = "auditor"  # GEDA read-only analyst: every dashboard, can't approve or change anything


class ActionStatus(str, enum.Enum):
    self_reported = "self_reported"  # instant, partial points
    pending = "pending"  # proof uploaded, awaiting review
    verified = "verified"  # full points
    rejected = "rejected"


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.citizen)
    district_id: Mapped[int | None] = mapped_column(ForeignKey("districts.id"), index=True)
    ward: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    district: Mapped[District | None] = relationship()
    household: Mapped["Household | None"] = relationship(back_populates="user", uselist=False)
    society_member: Mapped["SocietyMember | None"] = relationship(uselist=False)


class Household(Base):
    """Onboarding answers plus the computed baseline footprint."""

    __tablename__ = "households"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    members: Mapped[int] = mapped_column(Integer, default=4)
    home_type: Mapped[str] = mapped_column(String(20), default="apartment")
    monthly_kwh: Mapped[float] = mapped_column(Float)
    lpg_cylinders_per_month: Mapped[float] = mapped_column(Float, default=1)
    commute_mode: Mapped[str] = mapped_column(String(20), default="two_wheeler")
    commute_km_per_day: Mapped[float] = mapped_column(Float, default=10)
    ac_count: Mapped[int] = mapped_column(Integer, default=0)
    has_geyser: Mapped[bool] = mapped_column(Boolean, default=False)
    has_washing_machine: Mapped[bool] = mapped_column(Boolean, default=True)
    has_ev: Mapped[bool] = mapped_column(Boolean, default=False)
    has_solar: Mapped[bool] = mapped_column(Boolean, default=False)
    roof_area_sqm: Mapped[float | None] = mapped_column(Float)
    # Electricity distribution company and tariff area, for real bill amounts.
    discom: Mapped[str] = mapped_column(String(20), default="ugvcl", server_default="ugvcl")
    area: Mapped[str] = mapped_column(String(10), default="urban", server_default="urban")
    baseline_kg_co2_month: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="household")


class EnergyReading(Base):
    """Monthly electricity consumption, one row per user per month."""

    __tablename__ = "energy_readings"
    __table_args__ = (UniqueConstraint("user_id", "month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    month: Mapped[date] = mapped_column(Date)  # always the 1st of the month
    kwh: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(20), default="manual")


class ActionType(Base):
    """Catalogue of green actions a citizen can log."""

    __tablename__ = "action_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30))
    theme: Mapped[str] = mapped_column(String(20), default="energy", server_default="energy")  # one of factors.LIFE_THEMES
    points: Mapped[int] = mapped_column(Integer)
    co2_saved_kg: Mapped[float] = mapped_column(Float)
    kwh_saved: Mapped[float] = mapped_column(Float, default=0)
    max_per_day: Mapped[int] = mapped_column(Integer, default=1)


class ActionLog(Base):
    __tablename__ = "action_logs"
    __table_args__ = (
        Index("ix_action_logs_user_created", "user_id", "created_at"),
        Index("ix_action_logs_status", "status"),
        Index("ix_action_logs_proof_hash", "proof_hash"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action_type_id: Mapped[int] = mapped_column(ForeignKey("action_types.id"))
    status: Mapped[ActionStatus] = mapped_column(Enum(ActionStatus))
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    co2_saved_kg: Mapped[float] = mapped_column(Float, default=0)
    # Impact is computed for the household when logged and stored, so history doesn't
    # change if the household's answers are edited later.
    kwh_saved: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    is_daily_challenge: Mapped[bool] = mapped_column(Boolean, default=False)
    proof_path: Mapped[str | None] = mapped_column(String(255))
    # Perceptual hash of the proof photo (64-bit dHash as 16 hex chars), to reject reused photos.
    proof_hash: Mapped[str | None] = mapped_column(String(16))
    # AI pre-screening of the proof photo; an admin still makes the decision.
    ai_verdict: Mapped[str | None] = mapped_column(String(10))  # likely | unlikely | unsure
    ai_confidence: Mapped[float | None] = mapped_column(Float)
    ai_reason: Mapped[str | None] = mapped_column(String(300))
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    action_type: Mapped[ActionType] = relationship()


class ClimateMonth(Base):
    """Observed monthly weather for a district (Open-Meteo historical archive), cached."""

    __tablename__ = "climate_months"

    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), primary_key=True)
    month: Mapped[date] = mapped_column(Date, primary_key=True)  # 1st of the month
    cooling_degree_days: Mapped[float] = mapped_column(Float)
    mean_temp_c: Mapped[float] = mapped_column(Float)
    days_observed: Mapped[int] = mapped_column(Integer)  # < days in month while the month is in progress


class PushSubscription(Base):
    """A browser or installed app that agreed to receive Nidhi alerts."""

    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    endpoint: Mapped[str] = mapped_column(String(1000), unique=True)
    p256dh: Mapped[str] = mapped_column(String(200))
    auth: Mapped[str] = mapped_column(String(100))
    locale: Mapped[str] = mapped_column(String(5), default="en")
    # Alerts already sent today, e.g. "2026-11-10:green,peak", so each kind goes once a day.
    sent_today: Mapped[str] = mapped_column(String(60), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Society(Base):
    """An apartment society or ward group whose committee manages its members' participation."""

    __tablename__ = "societies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), index=True)
    join_code: Mapped[str] = mapped_column(String(10), unique=True)
    goal_kg_month: Mapped[float | None] = mapped_column(Float)  # CO2 the society aims to avoid each month
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    district: Mapped[District] = relationship()


class SocietyMember(Base):
    """Membership is opt-in and one society per person. Committee members manage the society."""

    __tablename__ = "society_members"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("societies.id"), index=True)
    role: Mapped[str] = mapped_column(String(10), default="member")  # member | committee
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(overlaps="society_member")
    society: Mapped[Society] = relationship()


class SocietyAnnouncement(Base):
    __tablename__ = "society_announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("societies.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    author: Mapped[User] = relationship()


class Campaign(Base):
    """A time-boxed challenge with a shared target, run by GEDA (state or district) or a society committee."""

    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(500), default="")
    action_code: Mapped[str | None] = mapped_column(String(40))  # null = any green action counts
    target: Mapped[int] = mapped_column(Integer)  # total qualifying actions the community aims for
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date] = mapped_column(Date)
    scope: Mapped[str] = mapped_column(String(10))  # state | district | society
    scope_id: Mapped[int | None] = mapped_column(Integer)  # district id or society id
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    """An in-app message. Stored as a key plus parameters so it reads in the viewer's language."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(40))
    params: Mapped[str] = mapped_column(String(500), default="{}")  # JSON
    url: Mapped[str] = mapped_column(String(120), default="/dashboard")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DistrictSun(Base):
    """Real rooftop solar yield for a district (EU JRC PVGIS), fetched once and cached."""

    __tablename__ = "district_sun"

    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), primary_key=True)
    kwh_per_kwp: Mapped[float] = mapped_column(Float)  # annual kWh per installed kWp
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
