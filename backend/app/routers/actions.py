import uuid
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.models import ActionLog, ActionStatus, ActionType
from app.schemas import ActionLogOut, ActionTypeOut, DailyChallengeOut
from app.services.gamification import DAILY_CHALLENGE_MULTIPLIER, daily_challenge_code, points_for
from app.timeutil import ist_day_bounds_utc, today_ist

router = APIRouter(prefix="/api/actions", tags=["actions"])

ALLOWED_PROOF_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PROOF_BYTES = 5 * 1024 * 1024


def daily_challenge_for(db: Session, user_id: int, day: date) -> DailyChallengeOut:
    types = db.scalars(select(ActionType)).all()
    code = daily_challenge_code(day, [t.code for t in types])
    action = next(t for t in types if t.code == code)
    start, end = ist_day_bounds_utc(day)
    completed = db.scalar(
        select(func.count(ActionLog.id)).where(
            ActionLog.user_id == user_id,
            ActionLog.is_daily_challenge.is_(True),
            ActionLog.status != ActionStatus.rejected,
            ActionLog.created_at >= start,
            ActionLog.created_at < end,
        )
    )
    return DailyChallengeOut(
        date=day,
        action=ActionTypeOut.model_validate(action),
        completed=bool(completed),
        multiplier=DAILY_CHALLENGE_MULTIPLIER,
    )


def log_out(log: ActionLog) -> ActionLogOut:
    return ActionLogOut(
        id=log.id,
        action=ActionTypeOut.model_validate(log.action_type),
        status=log.status.value,
        points_awarded=log.points_awarded,
        co2_saved_kg=log.co2_saved_kg,
        is_daily_challenge=log.is_daily_challenge,
        note=log.note,
        has_proof=log.proof_path is not None,
        created_at=log.created_at,
    )


async def _save_proof(upload: UploadFile) -> str:
    ext = ALLOWED_PROOF_TYPES.get(upload.content_type or "")
    if ext is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Proof must be a JPEG, PNG or WebP image")
    data = await upload.read(MAX_PROOF_BYTES + 1)
    if len(data) > MAX_PROOF_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Proof image must be under 5 MB")

    upload_dir = Path(get_settings().upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (upload_dir / name).write_bytes(data)
    return name


@router.get("/types", response_model=list[ActionTypeOut])
def list_types(db: DbSession):
    return db.scalars(select(ActionType).order_by(ActionType.category, ActionType.points)).all()


@router.get("/today", response_model=DailyChallengeOut)
def today_challenge(user: CurrentUser, db: DbSession):
    return daily_challenge_for(db, user.id, today_ist())


@router.post("", response_model=ActionLogOut, status_code=status.HTTP_201_CREATED)
async def log_action(
    user: CurrentUser,
    db: DbSession,
    action_code: Annotated[str, Form()],
    note: Annotated[str | None, Form(max_length=500)] = None,
    proof: Annotated[UploadFile | None, File()] = None,
):
    action = db.scalar(select(ActionType).where(ActionType.code == action_code))
    if action is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown action")

    today = today_ist()
    start, end = ist_day_bounds_utc(today)
    logged_today = db.scalar(
        select(func.count(ActionLog.id)).where(
            ActionLog.user_id == user.id,
            ActionLog.action_type_id == action.id,
            ActionLog.status != ActionStatus.rejected,
            ActionLog.created_at >= start,
            ActionLog.created_at < end,
        )
    )
    if logged_today >= action.max_per_day:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"You can log '{action.title}' at most {action.max_per_day}x per day",
        )

    challenge = daily_challenge_for(db, user.id, today)
    is_challenge = challenge.action.code == action.code and not challenge.completed

    proof_path = await _save_proof(proof) if proof and proof.filename else None
    status_ = ActionStatus.pending if proof_path else ActionStatus.self_reported

    log = ActionLog(
        user_id=user.id,
        action_type_id=action.id,
        status=status_,
        points_awarded=points_for(action.points, status_, is_challenge),
        co2_saved_kg=action.co2_saved_kg if status_ == ActionStatus.self_reported else 0.0,
        is_daily_challenge=is_challenge,
        proof_path=proof_path,
        note=note.strip() if note else None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log_out(log)


@router.get("/mine", response_model=list[ActionLogOut])
def my_actions(user: CurrentUser, db: DbSession, limit: int = 50):
    logs = db.scalars(
        select(ActionLog)
        .where(ActionLog.user_id == user.id)
        .order_by(ActionLog.created_at.desc())
        .limit(min(limit, 200))
    ).all()
    return [log_out(log) for log in logs]
