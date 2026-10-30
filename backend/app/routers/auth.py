from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import District, User
from app.schemas import DistrictOut, LoginIn, RegisterIn, TokenOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api", tags=["auth"])


def user_out(user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.onboarded = user.household is not None
    return out


@router.get("/districts", response_model=list[DistrictOut])
def list_districts(db: DbSession):
    return db.scalars(select(District).order_by(District.name)).all()


@router.post("/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DbSession):
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
def login(body: LoginIn, db: DbSession):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenOut(token=create_access_token(user.id), user=user_out(user))


@router.get("/auth/me", response_model=UserOut)
def me(user: CurrentUser):
    return user_out(user)
