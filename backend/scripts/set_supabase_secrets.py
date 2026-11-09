"""Put the Supabase database password and secret key into backend/.env.

Run it yourself in a terminal; input is hidden and nothing is printed:

    cd backend && python3 scripts/set_supabase_secrets.py

Fills the <DB_PASSWORD> and <SERVICE_ROLE_KEY> placeholders. The password is
URL-encoded, so characters like @ # / : are safe inside the connection strings.
"""

import getpass
import sys
from pathlib import Path
from urllib.parse import quote

ENV = Path(__file__).resolve().parent.parent / ".env"


def main() -> None:
    text = ENV.read_text()
    if "<DB_PASSWORD>" not in text and "<SERVICE_ROLE_KEY>" not in text:
        sys.exit(".env has no placeholders left; nothing to do.")

    if "<DB_PASSWORD>" in text:
        password = getpass.getpass("Supabase database password (hidden): ").strip()
        if not password:
            sys.exit("No password entered; .env unchanged.")
        text = text.replace("<DB_PASSWORD>", quote(password, safe=""))

    if "<SERVICE_ROLE_KEY>" in text:
        key = getpass.getpass("Supabase secret key, sb_secret_... (hidden): ").strip()
        if not key.startswith(("sb_secret_", "eyJ")):
            sys.exit("That doesn't look like a secret key (it should start with sb_secret_); .env unchanged.")
        text = text.replace("<SERVICE_ROLE_KEY>", key)

    ENV.write_text(text)
    ENV.chmod(0o600)
    print("Saved to backend/.env. Tell Claude \"done\".")


if __name__ == "__main__":
    main()
