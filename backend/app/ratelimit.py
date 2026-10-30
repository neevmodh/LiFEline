"""Fixed-window rate limiting for sensitive endpoints.

In-memory, so limits are per API process. With several replicas, swap the
store for Redis (INCR + EXPIRE) behind the same interface.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, name: str):
        self.limit = limit
        self.window = window_seconds
        self.name = name
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits[key] if now - t < self.window]
            if len(hits) >= self.limit:
                retry_after = int(self.window - (now - hits[0])) + 1
                self._hits[key] = hits
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    f"Too many {self.name} attempts. Try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)
            self._hits[key] = hits

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


login_limiter = RateLimiter(limit=10, window_seconds=300, name="login")
register_limiter = RateLimiter(limit=5, window_seconds=3600, name="sign-up")
bill_scan_limiter = RateLimiter(limit=10, window_seconds=3600, name="bill scan")
