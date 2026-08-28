"""Slice 2 PR 2c (playbook F.3): GET /automation-index read model plus the
Shared Object and Shared Resource / bus-factor-1 detectors on top of the
Sequence edges Slice 1 already writes.

Named constants are the published planning rule — do not invent a
different threshold, and do not add a dollar constant (CostProfile is not
populated by genome import; cost_per_verified_unit stays null)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.graph import EdgeType, WorkEdge
from ..models.verdict import VerdictScore
from ..models.workunit import VerificationMethod, WorkUnit
from .pii import redact

WORKING_DAYS_PER_MONTH = 22   # only for per-day bottleneck view
BUS_FACTOR_WU_THRESHOLD = 3   # published planning rule
BUS_FACTOR_HOURS_PER_DAY = 6  # published planning rule

SAVEABLE_LEVELS = {4, 5, 6}


def _hours_current(wu: WorkUnit) -> float | None:
    """time_per_case_min * volume_per_month / 60 == sla_hours * volume_per_month.
    None (never 0) when either factor is missing — do not impute. sla_hours
    of exactly 0 means time_per_case_min was never supplied (see
    genome_import.py), matching the existing L2 view's `if sla_hours else
    None` convention."""
    if not wu.sla_hours or wu.volume_per_month is None:
        return None
    return wu.sla_hours * wu.volume_per_month


def _ensure_edge(
    db: Session, edge_type: EdgeType, wu_a: WorkUnit, wu_b: WorkUnit, *, reason: str, detection_method: str
) -> None:
    """Idempotent: a second call (second GET) must not duplicate the edge."""
    lo, hi = (wu_a, wu_b) if wu_a.id < wu_b.id else (wu_b, wu_a)
    existing = (
        db.query(WorkEdge)
        .filter(WorkEdge.edge_type == edge_type, WorkEdge.source_id == lo.id, WorkEdge.target_id == hi.id)
        .one_or_none()
    )
    if existing is not None:
        return
    db.add(WorkEdge(source_id=lo.id, target_id=hi.id, edge_type=edge_type, reason=reason, detection_method=detection_method))


def _count_edges(db: Session, edge_type: EdgeType, wu_ids: list[int]) -> int:
    if not wu_ids:
        return 0
    return (
        db.query(WorkEdge)
        .filter(WorkEdge.edge_type == edge_type, WorkEdge.source_id.in_(wu_ids), WorkEdge.target_id.in_(wu_ids))
        .count()
    )


def compute_automation_index(db: Session, version_id: int) -> dict:
    wus = db.query(WorkUnit).filter(WorkUnit.genome_version_id == version_id).all()
    wu_ids = [wu.id for wu in wus]

    verdicts: dict[int, VerdictScore] = {}
    if wu_ids:
        verdicts = {
            v.work_unit_id: v
            for v in db.query(VerdictScore).filter(VerdictScore.work_unit_id.in_(wu_ids)).all()
        }

    level_counts = {level: 0 for level in range(1, 7)}
    verdict_missing_count = 0
    rule_debt_count = 0
    total_hours_current = 0.0
    total_hours_saveable = 0.0
    saveable_targets: list[tuple[str, float]] = []

    for wu in wus:
        verdict = verdicts.get(wu.id)
        if verdict is not None:
            level_counts[verdict.recommended_level] = level_counts.get(verdict.recommended_level, 0) + 1
        else:
            verdict_missing_count += 1

        if wu.verification_method == VerificationMethod.human_spot_check:
            rule_debt_count += 1

        hours = _hours_current(wu)
        if hours is None:
            continue
        total_hours_current += hours
        if verdict is not None and verdict.recommended_level in SAVEABLE_LEVELS:
            total_hours_saveable += hours
            saveable_targets.append((wu.code, hours))

    saveable_targets.sort(key=lambda pair: pair[1], reverse=True)
    highest_value_targets = [code for code, _ in saveable_targets]

    # --- Bottleneck / Shared Resource: group by exact authority string ---
    by_authority: dict[str, list[WorkUnit]] = {}
    for wu in wus:
        by_authority.setdefault(wu.authority, []).append(wu)

    bottleneck_view = []
    for authority, group in by_authority.items():
        group_hours = sum(h for h in (_hours_current(w) for w in group) if h is not None)
        hours_per_day = group_hours / WORKING_DAYS_PER_MONTH
        bus_factor_1 = len(group) > BUS_FACTOR_WU_THRESHOLD and hours_per_day > BUS_FACTOR_HOURS_PER_DAY
        bottleneck_view.append({
            "authority_redacted": redact(authority),
            "wu_count": len(group),
            "hours_per_day": round(hours_per_day, 4),
            "bus_factor_1": bus_factor_1,
            "wu_ids": [w.code for w in group],
        })
        if bus_factor_1:
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    _ensure_edge(
                        db, EdgeType.shared_resource, group[i], group[j],
                        reason="authority_overlap", detection_method="authority_overlap_v1",
                    )
    bottleneck_view.sort(key=lambda row: row["hours_per_day"], reverse=True)

    # --- Shared Object: same business_object on >=2 WUs in this version ---
    by_bo: dict[str, list[WorkUnit]] = {}
    for wu in wus:
        by_bo.setdefault(wu.business_object_type.name, []).append(wu)

    for bo_name, group in by_bo.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                _ensure_edge(
                    db, EdgeType.shared_object, group[i], group[j],
                    reason=f"Same Business Object {bo_name} operated by multiple WUs",
                    detection_method="business_object_overlap_v1",
                )

    db.commit()

    result: dict = {f"L{level}_count": level_counts[level] for level in range(1, 7)}
    result.update({
        "verdict_missing_count": verdict_missing_count,
        "total_hours_current": round(total_hours_current, 4),
        "total_hours_saveable": round(total_hours_saveable, 4),
        "highest_value_targets": highest_value_targets,
        "cost_per_verified_unit": None,
        "needs_cost_profile": True,
        "rule_debt_count": rule_debt_count,
        "bottleneck_view": bottleneck_view,
        "work_graph_summary": {
            "sequence_edges": _count_edges(db, EdgeType.sequence, wu_ids),
            "shared_object_edges": _count_edges(db, EdgeType.shared_object, wu_ids),
            "shared_resource_edges": _count_edges(db, EdgeType.shared_resource, wu_ids),
            "reciprocal_edges": 0,
            "reciprocal_computed": False,
        },
    })
    return result
