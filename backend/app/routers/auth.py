from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import District, User
from app.ratelimit import client_ip, login_limiter, register_limiter
from app.schemas import (
    DistrictOut,
    LoginIn,
    ProfileUpdateIn,
    RegisterIn,
    TokenOut,
    UserOut,
)
from app.security import create_access_token, hash_password, verify_password
from app.seed import suggested_discom

router = APIRouter(prefix="/api", tags=["auth"])


def user_out(user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.onboarded = user.household is not None
    if user.society_member:
        out.society_id, out.society_role = user.society_member.society_id, user.society_member.role
    return out


# Gujarat's 33 districts are reference data that only change with a deploy, so they're read
# from the database once per process and cached by browsers for an hour.
_districts_cache: list[DistrictOut] | None = None


@router.get("/districts", response_model=list[DistrictOut])
def list_districts(db: DbSession, response: Response):
    global _districts_cache
    if _districts_cache is None:
        districts = db.scalars(select(District).order_by(District.name)).all()
        _districts_cache = [
            DistrictOut(id=d.id, name=d.name, lat=d.lat, lon=d.lon, suggested_discom=suggested_discom(d.name))
            for d in districts
        ]
    response.headers["Cache-Control"] = "public, max-age=3600"
    return _districts_cache


@router.post("/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DbSession, request: Request):
    register_limiter.check(client_ip(request))
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    if not db.get(District, body.district_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown district")

    user = User(
        email=email,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        district_id=body.district_id,
        ward=body.ward.strip() if body.ward else None,
    )
    db.add(user)
    db.commit()
    return TokenOut(token=create_access_token(user.id), user=user_out(user))


@router.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn, db: DbSession, request: Request):
    # Keyed by IP and email so one attacker can't lock other users out.
    login_limiter.check(f"{client_ip(request)}:{body.email.lower()}")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenOut(token=create_access_token(user.id), user=user_out(user))


@router.get("/auth/me", response_model=UserOut)
def me(user: CurrentUser):
    return user_out(user)


@router.patch("/auth/me", response_model=UserOut)
def update_profile(body: ProfileUpdateIn, user: CurrentUser, db: DbSession):
    if body.district_id is not None:
        if not db.get(District, body.district_id):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown district")
        user.district_id = body.district_id
    if body.name is not None:
        user.name = body.name.strip()
    if "ward" in body.model_fields_set:
        user.ward = body.ward.strip() if body.ward else None
    db.commit()
    db.refresh(user)
    return user_out(user)
