"""Elevation 3: Pain & Automation X-Ray. Deterministic keyword heuristic
over the free-text `pain` field -- explicitly NOT sentiment analysis, no
LLM. Named PAIN_KEYWORDS so nobody mistakes the score for a model's
judgment; it's a word-count, same honesty bar as GQS's own violation
detectors elsewhere in this codebase.
"""
from __future__ import annotations

from ..models.scout import ScoutCapturedUnit
from .scout_timeline import daily_minutes

# word -> weight. Not exhaustive, not tuned against a corpus -- a
# starting heuristic, documented as such in docs/HONESTY.md.
PAIN_KEYWORDS: dict[str, int] = {
    "manual": 1, "copy": 1, "paste": 1, "copy-paste": 2, "painful": 2,
    "forever": 1, "annoying": 1, "tedious": 1, "duplicate": 1, "rework": 1,
    "slow": 1, "error-prone": 2, "double-check": 1, "chase": 1, "waiting": 1,
}
MAX_PAIN_SCORE = 5


def pain_score(text: str) -> int:
    lowered = text.lower()
    score = sum(weight for word, weight in PAIN_KEYWORDS.items() if word in lowered)
    return min(score, MAX_PAIN_SCORE)


def copy_paste_mentions(text: str) -> int:
    lowered = text.lower()
    return lowered.count("copy") + lowered.count("paste")


def build_pain_heatmap(units: list[ScoutCapturedUnit]) -> dict:
    by_system: dict[str, dict] = {}
    for unit in units:
        minutes = daily_minutes(unit) or 0.0
        score = pain_score(unit.pain)
        cp = copy_paste_mentions(unit.pain)
        systems = [s.strip() for s in unit.systems.split(",") if s.strip()] or ["(no system named)"]
        for system in systems:
            row = by_system.setdefault(system, {
                "system": system, "time_wasted_min_per_day": 0.0, "unit_count": 0,
                "copy_paste_count": 0, "pain_score_total": 0, "unit_names": [],
            })
            row["time_wasted_min_per_day"] += minutes
            row["unit_count"] += 1
            row["copy_paste_count"] += cp
            row["pain_score_total"] += score
            row["unit_names"].append(unit.name)

    total_minutes = sum(r["time_wasted_min_per_day"] for r in by_system.values())

    rows = []
    for row in by_system.values():
        avg_pain = row["pain_score_total"] / row["unit_count"] if row["unit_count"] else 0
        automation_potential_pct = (
            round(row["time_wasted_min_per_day"] / total_minutes * 100, 1) if total_minutes > 0 else 0.0
        )
        rows.append({
            "system": row["system"],
            "time_wasted_min_per_day": round(row["time_wasted_min_per_day"], 1),
            "unit_count": row["unit_count"],
            "copy_paste_count": row["copy_paste_count"],
            "avg_pain_score": round(avg_pain, 1),
            "automation_potential_pct": automation_potential_pct,
            "unit_names": row["unit_names"],
        })

    rows.sort(key=lambda r: -(r["time_wasted_min_per_day"] * (r["avg_pain_score"] + 1)))
    top_3 = rows[:3]

    return {
        "systems": rows,
        "top_pain_points": top_3,
        "total_time_wasted_min_per_day": round(total_minutes, 1),
    }
