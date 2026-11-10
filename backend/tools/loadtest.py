"""Load test for the Nidhi API (read-only endpoints; creates no data).

    cd backend
    uv run --with locust locust -f tools/loadtest.py --headless -u 50 -r 10 -t 60s \
        --host https://lifeline-api-9ox2.onrender.com --csv /tmp/nidhi-load

Each simulated citizen opens the sign-up page data (districts, config), watches the
live footprint preview as they type, and the host's health check runs alongside.
"""

import random

from locust import HttpUser, between, task

COMMUTES = ["car", "two_wheeler", "bus", "metro", "cycle_walk"]
DISCOMS = ["dgvcl", "mgvcl", "pgvcl", "ugvcl", "torrent"]


class Citizen(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def districts(self):
        self.client.get("/api/districts")

    @task(2)
    def config(self):
        self.client.get("/api/config")

    @task(5)
    def footprint_preview(self):
        self.client.post(
            "/api/footprint/preview",
            json={
                "monthly_kwh": random.randint(80, 600),
                "members": random.randint(1, 6),
                "lpg_cylinders_per_month": random.choice([0.5, 1, 1.5]),
                "commute_mode": random.choice(COMMUTES),
                "commute_km_per_day": random.randint(0, 40),
                "discom": random.choice(DISCOMS),
                "area": random.choice(["urban", "rural"]),
            },
            name="/api/footprint/preview",
        )

    @task(1)
    def health(self):
        self.client.get("/api/health")
