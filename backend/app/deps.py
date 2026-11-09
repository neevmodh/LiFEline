from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Role, User
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    user_id = decode_access_token(creds.credentials) if creds else None
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


def get_optional_user(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User | None:
    user_id = decode_access_token(creds.credentials) if creds else None
    return db.get(User, user_id) if user_id else None


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Dashboards: the state team, a district officer (their district) or a read-only auditor."""
    if user.role not in (Role.admin, Role.officer, Role.auditor):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def require_reviewer(user: Annotated[User, Depends(get_current_user)]) -> User:
    """The proof review queue: the state team, a district officer, or a reviewer. Auditors can't change anything."""
    if user.role not in (Role.admin, Role.officer, Role.reviewer):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Reviewer access required")
    return user


STAFF_ROLES = (Role.admin, Role.officer, Role.reviewer, Role.auditor)


def district_scope(user: User, requested: int | None = None) -> int | None:
    """The district a GEDA user may see: any (or all, None) for the state team and auditors,
    only their own for officers and for reviewers who were given a district."""
    if user.role in (Role.admin, Role.auditor) or (user.role == Role.reviewer and user.district_id is None):
        return requested
    if requested is not None and requested != user.district_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only see your own district")
    return user.district_id


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
ReviewerUser = Annotated[User, Depends(require_reviewer)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
