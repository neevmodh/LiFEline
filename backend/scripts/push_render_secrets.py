"""Copy the API's secrets from backend/.env into the Render service, then redeploy.

Run it yourself in a terminal (it prints key names only, never values):

    cd backend && python3 scripts/push_render_secrets.py srv-xxxxxxxx https://your-site.vercel.app

Uses the token saved by `render login`. Sends DATABASE_URL, MIGRATION_DATABASE_URL,
SUPABASE_SERVICE_KEY and GROQ_API_KEY (if set) from .env, and a freshly generated
JWT_SECRET for production.
"""

import json
import re
import secrets
import sys
import urllib.request
from pathlib import Path

ENV = Path(__file__).resolve().parent.parent / ".env"
CLI_CONFIG = Path.home() / ".render" / "cli.yaml"
FROM_ENV = ["DATABASE_URL", "MIGRATION_DATABASE_URL", "SUPABASE_SERVICE_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY"]


def read_env() -> dict[str, str]:
    out = {}
    for line in ENV.read_text().splitlines():
        m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
        if m and m.group(2) and "<" not in m.group(2):
            out[m.group(1)] = m.group(2)
    return out


def render_api() -> tuple[str, str]:
    text = CLI_CONFIG.read_text()
    key = re.search(r"^\s+key:\s*(\S+)", text, re.M)
    host = re.search(r"^\s+host:\s*(\S+)", text, re.M)
    if not key:
        sys.exit("Run `render login` first.")
    base = (host.group(1) if host else "https://api.render.com/v1/").rstrip("/")
    return key.group(1), base if base.endswith("/v1") else f"{base}/v1"


def call(method: str, url: str, token: str, body: dict | None = None) -> None:
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                                          "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def main() -> None:
    if len(sys.argv) != 3 or not sys.argv[1].startswith("srv-") or not sys.argv[2].startswith("https://"):
        sys.exit("Usage: python3 scripts/push_render_secrets.py srv-xxxxxxxx https://your-site.vercel.app")
    service, site = sys.argv[1], sys.argv[2].rstrip("/")
    env = read_env()
    values = {k: env[k] for k in FROM_ENV if k in env}
    missing = {"DATABASE_URL", "MIGRATION_DATABASE_URL", "SUPABASE_SERVICE_KEY"} - values.keys()
    if missing:
        sys.exit(f"backend/.env is missing: {', '.join(sorted(missing))}")
    values["JWT_SECRET"] = secrets.token_urlsafe(48)
    values["CORS_ORIGINS"] = json.dumps([site])  # the website is the only origin allowed to call the API

    token, base = render_api()
    for key, value in values.items():
        call("PUT", f"{base}/services/{service}/env-vars/{key}", token, {"value": value})
        print(f"  set {key}")
    call("POST", f"{base}/services/{service}/deploys", token, {})
    print("Redeploying with the new settings. Tell Claude \"done\".")


if __name__ == "__main__":
    main()
