import enum
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    citizen = "citizen"
    admin = "admin"


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
    # Community goal: total kg CO2 the district aims to avoid this month.
    monthly_goal_kg: Mapped[float] = mapped_column(Float, default=5000)


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
    points: Mapped[int] = mapped_column(Integer)
    co2_saved_kg: Mapped[float] = mapped_column(Float)
    kwh_saved: Mapped[float] = mapped_column(Float, default=0)
    max_per_day: Mapped[int] = mapped_column(Integer, default=1)


class ActionLog(Base):
    __tablename__ = "action_logs"
    __table_args__ = (
        Index("ix_action_logs_user_created", "user_id", "created_at"),
        Index("ix_action_logs_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action_type_id: Mapped[int] = mapped_column(ForeignKey("action_types.id"))
    status: Mapped[ActionStatus] = mapped_column(Enum(ActionStatus))
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    co2_saved_kg: Mapped[float] = mapped_column(Float, default=0)
    is_daily_challenge: Mapped[bool] = mapped_column(Boolean, default=False)
    proof_path: Mapped[str | None] = mapped_column(String(255))
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    action_type: Mapped[ActionType] = relationship()
