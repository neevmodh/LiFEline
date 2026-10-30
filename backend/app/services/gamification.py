"""Points rules and the daily challenge rotation."""

import hashlib
from datetime import date

from app.models import ActionStatus

# Self-reported actions earn part of the points instantly; uploading proof that
# an admin verifies earns the rest. This keeps logging frictionless while making
# the leaderboard expensive to game.
SELF_REPORT_SHARE = 0.4
DAILY_CHALLENGE_MULTIPLIER = 2


def points_for(base_points: int, status: ActionStatus, is_daily_challenge: bool) -> int:
    if status in (ActionStatus.rejected, ActionStatus.pending):
        return 0
    share = 1.0 if status == ActionStatus.verified else SELF_REPORT_SHARE
    multiplier = DAILY_CHALLENGE_MULTIPLIER if is_daily_challenge else 1
    return round(base_points * share * multiplier)


def daily_challenge_code(day: date, action_codes: list[str]) -> str:
    """Same challenge for every citizen on a given day, so communities act together."""
    if not action_codes:
        raise ValueError("No actions available")
    codes = sorted(action_codes)
    digest = hashlib.sha256(day.isoformat().encode()).digest()
    return codes[int.from_bytes(digest[:4], "big") % len(codes)]


def level_for(points: int) -> tuple[int, str, int]:
    """Return (level, title, points needed for the next level)."""
    thresholds = [
        (0, "Seedling"),
        (100, "Sapling"),
        (300, "Grove Keeper"),
        (700, "Forest Guardian"),
        (1500, "LiFE Champion"),
    ]
    level = 0
    for i, (threshold, _) in enumerate(thresholds):
        if points >= threshold:
            level = i
    next_at = thresholds[level + 1][0] if level + 1 < len(thresholds) else thresholds[-1][0]
    return level + 1, thresholds[level][1], next_at
