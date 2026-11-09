"""Monthly PDF report."""

from app.timeutil import today_ist
from conftest import HOUSEHOLD, register


def test_report_is_a_pdf_for_the_signed_in_citizen_only(client):
    assert client.get("/api/report/monthly.pdf").status_code == 401
    h = register(client)
    assert client.get("/api/report/monthly.pdf", headers=h).status_code == 409  # no household yet
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=h)
    r = client.get("/api/report/monthly.pdf", headers=h)
    assert r.status_code == 200 and r.content[:5] == b"%PDF-"
    assert f"lifeline-{today_ist():%Y-%m}.pdf" in r.headers["content-disposition"]
    assert client.get("/api/report/monthly.pdf?month=2026-13", headers=h).status_code == 422
    assert client.get("/api/report/monthly.pdf?month=2025-01", headers=h).status_code == 200  # empty month still renders
