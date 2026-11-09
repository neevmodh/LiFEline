"""Create in-app notifications. Callers commit."""

import json

from sqlalchemy.orm import Session

from app.models import Notification


def notify(db: Session, user_id: int, key: str, url: str = "/dashboard", **params: object) -> None:
    db.add(Notification(user_id=user_id, key=key, params=json.dumps(params, ensure_ascii=False), url=url))
