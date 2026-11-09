from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession, OptionalUser
from app.i18n import RequestLocale, tr
from app.models import ActionLog, ActionStatus, ActionType, Household
from app.schemas import ActionLogOut, ActionTypeOut, DailyChallengeOut
from app.services.gamification import DAILY_CHALLENGE_MULTIPLIER, daily_challenge_code, points_for
from app.services.factors import peak_label
from app.services.impact import action_impact
from app.services.proof_screen import screen_proof
from app.storage import StorageError, get_storage
from app.timeutil import ist_day_bounds_utc, today_ist
from app.uploads import IMAGE_TYPES, NEAR_DUPLICATE_BITS, difference_hash, hash_chunks, hash_distance, read_image

router = APIRouter(prefix="/api/actions", tags=["actions"])


def action_text(code: str, locale: str) -> tuple[str, str]:
    """Title and description in the user's language."""
    return tr(locale, f"action.{code}.title"), tr(locale, f"action.{code}.description", peak=peak_label())


def action_out(action: ActionType, household: Household | None, locale: str = "en") -> ActionTypeOut:
    """The catalogue entry, with savings computed for this household when there is one."""
    out = ActionTypeOut.model_validate(action)
    out.title, out.description = action_text(action.code, locale)
    if household is not None:
        impact = action_impact(action.code, household)
        out.co2_saved_kg, out.kwh_saved = impact.co2_kg, impact.kwh
        out.applicable, out.not_applicable_reason = impact.applicable, impact.reason(locale)
    return out


def daily_challenge_for(
    db: Session, user_id: int, day: date, household: Household | None, locale: str = "en"
) -> DailyChallengeOut:
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
        action=action_out(action, household, locale),
        completed=bool(completed),
        multiplier=DAILY_CHALLENGE_MULTIPLIER,
    )


def log_out(log: ActionLog, locale: str = "en") -> ActionLogOut:
    return ActionLogOut(
        id=log.id,
        action=action_out(log.action_type, None, locale),
        status=log.status.value,
        points_awarded=log.points_awarded,
        co2_saved_kg=log.co2_saved_kg,
        kwh_saved=log.kwh_saved,
        is_daily_challenge=log.is_daily_challenge,
        note=log.note,
        has_proof=log.proof_path is not None,
        created_at=log.created_at,
    )


def _photo_already_used(db: Session, proof_hash: str) -> bool:
    """True if this photo, or a resized or re-compressed copy of it, backs another live claim."""
    same_chunk = or_(
        *(func.substr(ActionLog.proof_hash, i * 4 + 1, 4) == chunk for i, chunk in enumerate(hash_chunks(proof_hash)))
    )
    candidates = db.scalars(
        select(ActionLog.proof_hash).where(
            ActionLog.proof_hash.is_not(None), ActionLog.status != ActionStatus.rejected, same_chunk
        )
    )
    return any(hash_distance(proof_hash, other) <= NEAR_DUPLICATE_BITS for other in candidates)


@router.get("/types", response_model=list[ActionTypeOut])
def list_types(db: DbSession, user: OptionalUser, locale: RequestLocale):
    household = user.household if user else None
    actions = db.scalars(select(ActionType).order_by(ActionType.category, ActionType.points)).all()
    return [action_out(a, household, locale) for a in actions]


@router.get("/today", response_model=DailyChallengeOut)
def today_challenge(user: CurrentUser, db: DbSession, locale: RequestLocale):
    return daily_challenge_for(db, user.id, today_ist(), user.household, locale)


@router.post("", response_model=ActionLogOut, status_code=status.HTTP_201_CREATED)
async def log_action(
    user: CurrentUser,
    db: DbSession,
    locale: RequestLocale,
    action_code: Annotated[str, Form()],
    note: Annotated[str | None, Form(max_length=500)] = None,
    proof: Annotated[UploadFile | None, File()] = None,
):
    if user.household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    action = db.scalar(select(ActionType).where(ActionType.code == action_code))
    if action is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown action")
    impact = action_impact(action.code, user.household)
    if not impact.applicable:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, impact.reason(locale))

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

    proof_path = proof_hash = None
    screening = None
    if proof and proof.filename:
        checked = await read_image(proof)
        proof_hash = difference_hash(checked.image)
        if _photo_already_used(db, proof_hash):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "This photo has already been submitted. Take a new photo of this action."
            )
        try:
            proof_path = await get_storage().save(checked.data, checked.media_type, IMAGE_TYPES[checked.media_type])
        except StorageError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Couldn't store the photo. Try again.") from exc
        screening = await screen_proof(checked.data, checked.media_type, action.title, action.description)

    challenge = daily_challenge_for(db, user.id, today, user.household, locale)
    is_challenge = challenge.action.code == action.code and not challenge.completed
    status_ = ActionStatus.pending if proof_path else ActionStatus.self_reported

    log = ActionLog(
        user_id=user.id,
        action_type_id=action.id,
        status=status_,
        points_awarded=points_for(action.points, status_, is_challenge),
        # Stored for every log; totals only count self-reported and verified ones (stats.COUNTED_STATUSES).
        co2_saved_kg=impact.co2_kg,
        kwh_saved=impact.kwh,
        is_daily_challenge=is_challenge,
        proof_path=proof_path,
        proof_hash=proof_hash,
        ai_verdict=screening.verdict if screening else None,
        ai_confidence=screening.confidence if screening else None,
        ai_reason=screening.reason if screening else None,
        note=note.strip() if note else None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log_out(log, locale)


@router.get("/mine", response_model=list[ActionLogOut])
def my_actions(user: CurrentUser, db: DbSession, locale: RequestLocale, limit: int = 50):
    logs = db.scalars(
        select(ActionLog)
        .where(ActionLog.user_id == user.id)
        .order_by(ActionLog.created_at.desc())
        .limit(min(limit, 200))
    ).all()
    return [log_out(log, locale) for log in logs]
