"""Create (or promote) a GEDA administrator account.

    python -m app.create_admin --email officer@geda.gujarat.gov.in --name "District Officer"

The password is read from the LIFELINE_ADMIN_PASSWORD environment variable if
set (for scripted setups such as CI), otherwise prompted for without echo.
"""

import argparse
import getpass
import os
import sys

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select

from app.db import SessionLocal
from app.migrate import upgrade_to_head
from app.models import Role, User
from app.schemas import MAX_PASSWORD_BYTES
from app.security import hash_password


def create_admin(email: str, name: str, password: str) -> User:
    # Same rules as citizen sign-up.
    TypeAdapter(EmailStr).validate_python(email)
    if not 8 <= len(password) or len(password.encode()) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be 8 characters to {MAX_PASSWORD_BYTES} bytes")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email.lower()))
        if user is None:
            user = User(email=email.lower(), name=name.strip())
            db.add(user)
        user.role = Role.admin
        user.password_hash = hash_password(password)
        db.commit()
        db.refresh(user)
        return user


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()

    password = os.environ.get("LIFELINE_ADMIN_PASSWORD") or getpass.getpass("Password (min 8 characters): ")
    upgrade_to_head()
    try:
        user = create_admin(args.email, args.name, password)
    except (ValueError, ValidationError) as exc:
        sys.exit(f"Not created: {exc}")
    print(f"Administrator ready: {user.email}")


if __name__ == "__main__":
    main()
