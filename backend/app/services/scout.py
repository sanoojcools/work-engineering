"""Scout Elevated V2 PR1: Genome Strength completeness calc.

The design doc's formula ("sum captured / total expected, expected from
JD + logs baseline") isn't buildable today -- no JD or log ingestion
exists. This is the honestly-simpler stand-in: a named-constant target
unit count (matching the codebase's existing pattern of published
planning constants like BUS_FACTOR_WU_THRESHOLD, never invented at
call time) plus, per captured unit, which of its fields are filled.

8 dimensions were specified; only 7 have a real field to measure today.
"Knowledge Artifacts" (policies/JD/papers linked) would need uploaded
files linked to a session, which this PR doesn't wire up -- it's
reported with computed=False rather than faked at 0%, the same
reciprocal_computed=False pattern automation-index already uses for
work graph cycle detection.
"""
from __future__ import annotations

from ..models.scout import ScoutCapturedUnit
from ..schemas.scout import DimensionOut, UnitOut

# Published planning constant, not an AI-derived baseline -- see module
# docstring. Revisit once real JD/log ingestion exists.
EXPECTED_UNITS_PER_SESSION = 8


def _pct(captured: int, expected: int) -> float:
    if expected <= 0:
        return 0.0
    return round(min(captured, expected) / expected * 100, 1)


def _field_filled_pct(units: list[ScoutCapturedUnit], predicate) -> tuple[int, float]:
    if not units:
        return 0, 0.0
    filled = sum(1 for u in units if predicate(u))
    return filled, round(filled / len(units) * 100, 1)


def compute_dimensions(units: list[ScoutCapturedUnit]) -> list[DimensionOut]:
    work_units_captured = _pct(len(units), EXPECTED_UNITS_PER_SESSION)

    io_filled, io_pct = _field_filled_pct(units, lambda u: bool(u.inputs.strip()) and bool(u.outputs.strip()))
    sys_filled, sys_pct = _field_filled_pct(units, lambda u: bool(u.systems.strip()))
    time_filled, time_pct = _field_filled_pct(
        units, lambda u: bool(u.frequency.strip()) and u.time_minutes is not None
    )
    dec_filled, dec_pct = _field_filled_pct(units, lambda u: bool(u.decision_rule.strip()))
    handoff_filled, handoff_pct = _field_filled_pct(units, lambda u: bool(u.handoffs.strip()))
    pain_filled, pain_pct = _field_filled_pct(units, lambda u: bool(u.pain.strip()))

    return [
        DimensionOut(
            key="work_units_captured", label="Work Units Captured",
            captured=len(units), expected=EXPECTED_UNITS_PER_SESSION, pct=work_units_captured,
        ),
        DimensionOut(
            key="inputs_outputs", label="Inputs / Outputs",
            captured=io_filled, expected=len(units), pct=io_pct,
        ),
        DimensionOut(
            key="systems_tools", label="Systems / Tools",
            captured=sys_filled, expected=len(units), pct=sys_pct,
        ),
        DimensionOut(
            key="time_frequency", label="Time & Frequency",
            captured=time_filled, expected=len(units), pct=time_pct,
        ),
        DimensionOut(
            key="decisions_rules", label="Decisions / Rules",
            captured=dec_filled, expected=len(units), pct=dec_pct,
        ),
        DimensionOut(
            key="handoffs", label="Handoffs",
            captured=handoff_filled, expected=len(units), pct=handoff_pct,
        ),
        DimensionOut(
            key="pain_exceptions", label="Pain & Exceptions",
            captured=pain_filled, expected=len(units), pct=pain_pct,
        ),
        DimensionOut(
            key="knowledge_artifacts", label="Knowledge Artifacts",
            captured=0, expected=0, pct=0.0, computed=False,
        ),
    ]


def compute_completeness_pct(dimensions: list[DimensionOut]) -> float:
    computed = [d.pct for d in dimensions if d.computed]
    if not computed:
        return 0.0
    return round(sum(computed) / len(computed), 1)


def unit_to_out(u: ScoutCapturedUnit) -> UnitOut:
    return UnitOut(
        id=u.id, name=u.name, inputs=u.inputs, outputs=u.outputs, systems=u.systems,
        frequency=u.frequency, time_minutes=u.time_minutes, pain=u.pain,
        handoffs=u.handoffs, decision_rule=u.decision_rule,
        created_at=u.created_at, updated_at=u.updated_at,
    )
