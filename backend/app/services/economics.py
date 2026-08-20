"""H5–H7: four costing disciplines. Hours per month unless noted."""
from __future__ import annotations

from typing import Any

from ..config import settings


def monthly_hours(
    *,
    executions_per_month: float,
    minutes_per_execution: float,
    verification_minutes: float,
    failure_rate: float,
    exception_minutes: float,
    maintenance_hours: float,
    attribution_confidence: float,
    verified_completions: float | None = None,
) -> dict[str, Any]:
    do_hours = executions_per_month * minutes_per_execution / 60.0
    verify_hours = executions_per_month * verification_minutes / 60.0
    exception_hours = executions_per_month * failure_rate * exception_minutes / 60.0
    gross = do_hours + verify_hours + exception_hours + maintenance_hours
    confidence = max(0.0, min(1.0, attribution_confidence))
    attributed = gross * confidence
    fte = attributed / settings.monthly_fte_hours if settings.monthly_fte_hours else 0.0
    completions = verified_completions if verified_completions is not None else executions_per_month
    cost_per_verified = (
        (do_hours + verify_hours + exception_hours) / completions if completions else None
    )
    return {
        "do_hours": round(do_hours, 4),
        "verify_hours": round(verify_hours, 4),
        "exception_hours": round(exception_hours, 4),
        "maintenance_hours": round(maintenance_hours, 4),
        "gross_hours": round(gross, 4),
        "attribution_confidence": confidence,
        "attributed_hours": round(attributed, 4),
        "fte": round(fte, 4),
        "cost_per_verified_unit_hours": (
            round(cost_per_verified, 4) if cost_per_verified is not None else None
        ),
        "disciplines": {
            "1_include_cost_to_verify": round(verify_hours, 4),
            "2_include_exceptions": round(exception_hours, 4),
            "3_include_ontology_maintenance": round(maintenance_hours, 4),
            "4_attribution_filter": round(attributed, 4),
        },
    }


def from_profile(profile, verified_completions: float | None = None) -> dict[str, Any]:
    return monthly_hours(
        executions_per_month=profile.executions_per_month,
        minutes_per_execution=profile.minutes_per_execution,
        verification_minutes=profile.verification_minutes,
        failure_rate=profile.failure_rate,
        exception_minutes=profile.exception_minutes,
        maintenance_hours=profile.maintenance_hours,
        attribution_confidence=profile.attribution_confidence,
        verified_completions=verified_completions,
    )
