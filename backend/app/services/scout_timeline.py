"""Elevation 1: Time-Travel Replay. Deterministic scheduling over a
published 9am-6pm window -- no LLM involved, this is arithmetic over
frequency + time_minutes, same spirit as automation-index's existing
hours math (services/automation_index.py's WORKING_DAYS_PER_MONTH=22).
"""
from __future__ import annotations

from ..models.scout import ScoutCapturedUnit

DAY_START_MIN = 9 * 60  # 09:00
DAY_END_MIN = 18 * 60  # 18:00
WORKING_WINDOW_MINUTES = DAY_END_MIN - DAY_START_MIN  # 540
WORKING_DAYS_PER_MONTH = 22  # matches automation_index's published constant
GAP_THRESHOLD_MINUTES = 30  # below this, don't bother surfacing it as a gap


def daily_minutes(unit: ScoutCapturedUnit) -> float | None:
    """How many minutes of THIS unit happen on a typical day, derived from
    frequency text + time_minutes. Returns None when there isn't enough to
    place it (matches automation-index's "skip WUs missing either factor,
    do not impute" rule)."""
    if unit.time_minutes is None:
        return None
    freq = unit.frequency.lower()
    if not freq or "day" in freq:
        return unit.time_minutes
    if "week" in freq:
        return unit.time_minutes / 5
    if "month" in freq:
        return unit.time_minutes / WORKING_DAYS_PER_MONTH
    return unit.time_minutes  # unrecognized frequency text -> treat as a one-off daily block


def build_timeline(units: list[ScoutCapturedUnit]) -> dict:
    placeable = [(u, daily_minutes(u)) for u in units]
    placeable = [(u, m) for u, m in placeable if m is not None and m > 0]
    placeable.sort(key=lambda pair: -pair[1])  # largest first, stable & deterministic

    blocks = []
    cursor = DAY_START_MIN
    for unit, minutes in placeable:
        start = cursor
        end = start + minutes
        blocks.append({
            "unit_id": unit.id, "unit_name": unit.name,
            "start_min": round(start), "end_min": round(end), "minutes": round(minutes, 1),
        })
        cursor = end

    total_minutes = sum(m for _, m in placeable)
    over_allocated = total_minutes > WORKING_WINDOW_MINUTES

    # Gaps only make sense within the nominal window; anything placed past
    # DAY_END_MIN because of over-allocation is flagged, not gap-hunted.
    gaps = []
    prev_end = DAY_START_MIN
    for block in blocks:
        if block["start_min"] > DAY_END_MIN:
            break
        gap_end = min(block["start_min"], DAY_END_MIN)
        if gap_end - prev_end >= GAP_THRESHOLD_MINUTES:
            gaps.append({"start_min": prev_end, "end_min": gap_end, "minutes": gap_end - prev_end})
        prev_end = max(prev_end, block["end_min"])
    if DAY_END_MIN - prev_end >= GAP_THRESHOLD_MINUTES:
        gaps.append({"start_min": prev_end, "end_min": DAY_END_MIN, "minutes": DAY_END_MIN - prev_end})

    return {
        "day_start_min": DAY_START_MIN,
        "day_end_min": DAY_END_MIN,
        "blocks": blocks,
        "gaps": gaps,
        "total_minutes": round(total_minutes, 1),
        "over_allocated": over_allocated,
        "unplaced_units": [
            {"unit_id": u.id, "unit_name": u.name, "reason": "no time_minutes or frequency"}
            for u in units if u.id not in {b["unit_id"] for b in blocks}
        ],
    }
