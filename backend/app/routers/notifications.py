"""The notification centre: proof decisions and society announcements, in the reader's language."""

import json

from fastapi import APIRouter, status
from sqlalchemy import func, select, update

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale, tr
from app.models import Notification
from app.schemas import NotificationList, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
KEEP = 50


@router.get("", response_model=NotificationList)
def list_notifications(user: CurrentUser, db: DbSession, locale: RequestLocale):
    rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(KEEP)
    ).all()
    unread = db.scalar(
        select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read.is_(False))
    )
    items = []
    for n in rows:
        params = json.loads(n.params or "{}")
        items.append(NotificationOut(id=n.id, title=tr(locale, f"notif.{n.key}.title", **params),
                                     body=tr(locale, f"notif.{n.key}.body", **params), url=n.url,
                                     read=n.read, created_at=n.created_at))
    return NotificationList(unread=unread or 0, items=items)


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: CurrentUser, db: DbSession):
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read.is_(False)).values(read=True))
    db.commit()
