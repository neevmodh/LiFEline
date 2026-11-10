"""District sunshine: real PVGIS yield, cached, never invented."""

from app.services import solar


def test_every_district_gets_a_yield_and_is_cached(client, monkeypatch):
    calls = []

    async def fake(lat, lon):
        calls.append((lat, lon))
        return 1500.0 + lat  # distinct, plausible kWh per kWp

    monkeypatch.setattr(solar, "fetch_specific_yield", fake)
    first = client.get("/api/sun/districts").json()
    assert len(first) == 33 and all(r["kwh_per_kwp"] > 1400 for r in first)
    assert len(calls) == 33
    second = client.get("/api/sun/districts").json()
    assert second == first and len(calls) == 33  # served from the database, no refetch


def test_a_failed_lookup_is_left_out_not_invented_and_retried(client, monkeypatch):
    async def flaky(lat, lon):
        return None if lat > 23 else 1600.0

    monkeypatch.setattr(solar, "fetch_specific_yield", flaky)
    partial = client.get("/api/sun/districts").json()
    assert 0 < len(partial) < 33 and all(r["lat"] <= 23 for r in partial)

    async def fine(lat, lon):
        return 1600.0

    monkeypatch.setattr(solar, "fetch_specific_yield", fine)
    assert len(client.get("/api/sun/districts").json()) == 33
