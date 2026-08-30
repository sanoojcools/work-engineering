"""Elevation 5: Future Preview. Pure derivation from data the other
elevations already compute -- no new inference, no LLM, no invented
dollar figure (same "hours only, no $ rate" discipline as
automation_index)."""
from __future__ import annotations

from ..models.scout import ScoutInterviewSession
from .scout_pain import build_pain_heatmap


def build_future_preview(session: ScoutInterviewSession) -> dict:
    units = list(session.units)
    heatmap = build_pain_heatmap(units)
    business_objects = sorted({u.name for u in units if u.name.strip()})
    return {
        "completeness_pct": session.completeness_pct,
        "unlocked": session.completeness_pct >= 100,
        "time_saved_min_per_day": heatmap["total_time_wasted_min_per_day"],
        "business_objects_preview": business_objects,
        "unit_count": len(units),
    }
