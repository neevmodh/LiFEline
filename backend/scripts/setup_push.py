"""Turn on Web Push alerts in production. Run it yourself; it never prints the keys.

    cd backend && uv run python scripts/setup_push.py srv-xxxxxxxx

It generates a VAPID key pair and a scheduler secret, then:
- appends them to backend/.env (for local runs);
- sets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT and PUSH_CRON_SECRET on the
  Render service (using the `render login` token) and redeploys it;
- stores PUSH_CRON_SECRET and API_URL as GitHub Actions secrets (using `gh`), so the
  scheduled workflow can call the sender every 15 minutes.
"""

import base64
import json
import re
import secrets
import subprocess
import sys
import urllib.request
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

ROOT = Path(__file__).resolve().parents[2]
ENV = ROOT / "backend/.env"
API_URL = "https://lifeline-api-9ox2.onrender.com"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def vapid_keys() -> tuple[str, str]:
    key = ec.generate_private_key(ec.SECP256R1())
    private_raw = key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return b64url(public_raw), b64url(private_raw)


def render_put(service: str, values: dict[str, str]) -> None:
    cfg = (Path.home() / ".render/cli.yaml").read_text()
    token = re.search(r"^\s+key:\s*(\S+)", cfg, re.M).group(1)
    host = re.search(r"^\s+host:\s*(\S+)", cfg, re.M)
    base = (host.group(1) if host else "https://api.render.com/v1/").rstrip("/")
    base = base if base.endswith("/v1") else base + "/v1"

    def call(method, path, body):
        req = urllib.request.Request(f"{base}{path}", method=method, data=json.dumps(body).encode(),
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=30).read()

    for k, v in values.items():
        call("PUT", f"/services/{service}/env-vars/{k}", {"value": v})
        print(f"  Render: set {k}")
    call("POST", f"/services/{service}/deploys", {})
    print("  Render: redeploying")


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].startswith("srv-"):
        sys.exit("Usage: uv run python scripts/setup_push.py srv-xxxxxxxx")
    public, private = vapid_keys()
    cron = secrets.token_urlsafe(32)
    values = {
        "VAPID_PUBLIC_KEY": public,
        "VAPID_PRIVATE_KEY": private,
        "VAPID_SUBJECT": "mailto:neevmodh205@gmail.com",
        "PUSH_CRON_SECRET": cron,
    }
    text = ENV.read_text()
    text = re.sub(r"^(VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|VAPID_SUBJECT|PUSH_CRON_SECRET)=.*\n?", "", text, flags=re.M)
    ENV.write_text(text.rstrip("\n") + "\n\n# Web Push alerts\n" + "".join(f"{k}={v}\n" for k, v in values.items()))
    print("  .env: updated")
    render_put(sys.argv[1], values)
    for name, value in (("PUSH_CRON_SECRET", cron), ("API_URL", API_URL)):
        subprocess.run(["gh", "secret", "set", name, "--repo", "neevmodh/LiFEline"], input=value.encode(), check=True,
                       capture_output=True)
        print(f"  GitHub: set secret {name}")
    print("Alerts are set up. Tell Claude \"done\".")


if __name__ == "__main__":
    main()
