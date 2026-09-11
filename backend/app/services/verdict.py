"""H1–H2: VERDICT scores → autonomy level. Deterministic, not LLM-judged.

The extracted V8 text specifies four hard gates and six levels. It does not publish
an arithmetic for the uncapped mapping, so the mean-to-level function below is a
design decision (Part I: VERDICT as hypothesis). Gates are applied exactly as H2.
"""
from __future__ import annotations

import json
from typing import Any

PROPERTIES = (
    "verifiability",
    "evidence",
    "reversibility",
    "determinism",
    "impact_scope",
    "compliance",
    "tacitness",
)

LEVEL_NAMES = {
    1: "L1_human_only",
    2: "L2_human_led_agent_assists",
    3: "L3_agent_led_human_approves",
    4: "L4_agent_autonomous_human_reviews",
    5: "L5_agent_autonomous_exception_only",
    6: "L6_fully_deterministic",
}


def clamp_score(value: int) -> int:
    return max(1, min(5, int(value)))


def mean_score(scores: dict[str, int]) -> float:
    return sum(clamp_score(scores[p]) for p in PROPERTIES) / 7.0


def _band_for_value(value: float) -> int:
    if value < 2.0:
        return 1
    elif value < 2.75:
        return 2
    elif value < 3.5:
        return 3
    elif value < 4.25:
        return 4
    else:
        return 5


def _level_at(scores: dict[str, int], value: float) -> int:
    """Map a single 1-5 value (a mean, or -- for V10-14's scenario floor/
    ceiling -- a min/max across the seven properties) onto L1-L5, with L6's
    deterministic special case. The one place this arithmetic lives --
    base_level() and scenario_levels() both call it, so there is no second
    engine between VERDICT's own derivation and the scenario strip."""
    level = _band_for_value(value)
    # L6 is fully deterministic automation (no LLM): high D, V, T and a high value.
    if (
        scores["determinism"] == 5
        and scores["verifiability"] >= 4
        and scores["tacitness"] >= 4
        and value >= 4.5
    ):
        level = 6
    return level


def base_level(scores: dict[str, int]) -> int:
    """Map the 1–5 mean onto L1–L5. L6 requires a deterministic special case."""
    return _level_at(scores, mean_score(scores))


# The cap each hard gate imposes when it fires -- shared by apply_hard_gates
# (computed from live scores at score time) and cap_from_applied_gates
# (replayed from an already-persisted applied_gates list, e.g. V10-14's
# scenario strip, which has no access to requires_licensed_human /
# evidence_path_exists and must not re-derive them).
GATE_CAPS: dict[str, int] = {
    "gate1_regulatory": 2,
    "gate2_reversibility": 3,
    "gate3_impact": 3,
    "gate4_evidence": 2,
}


def apply_hard_gates(
    level: int,
    scores: dict[str, int],
    *,
    requires_licensed_human: bool,
    evidence_path_exists: bool,
) -> tuple[int, list[str]]:
    """H2: four hard gates cap autonomy regardless of the VERDICT mean."""
    gates: list[str] = []
    cap = 6
    if scores["compliance"] == 1 or requires_licensed_human:
        cap = min(cap, GATE_CAPS["gate1_regulatory"])
        gates.append("gate1_regulatory")
    if scores["reversibility"] == 1:
        cap = min(cap, GATE_CAPS["gate2_reversibility"])
        gates.append("gate2_reversibility")
    if scores["impact_scope"] == 1:
        cap = min(cap, GATE_CAPS["gate3_impact"])
        gates.append("gate3_impact")
    if (not evidence_path_exists) or scores["evidence"] == 1:
        cap = min(cap, GATE_CAPS["gate4_evidence"])
        gates.append("gate4_evidence")
    return min(level, cap), gates


def cap_from_applied_gates(applied_gates: list[str]) -> int:
    """Replay GATE_CAPS against an already-persisted applied_gates list
    (VerdictScore.applied_gates) instead of re-deriving requires_licensed_human
    / evidence_path_exists, which are not available after the fact. Mirrors
    frontend/src/lib/offerDeskScenarios.ts::capFromAppliedGates exactly."""
    cap = 6
    for gate in applied_gates:
        if gate in GATE_CAPS:
            cap = min(cap, GATE_CAPS[gate])
    return cap


def scenario_levels(
    scores: dict[str, int],
    *,
    recommended_level: int,
    applied_gates: list[str],
) -> dict[str, int]:
    """V10-14 (docs/contracts/v10-14-handoff.md): careful / as_calculated /
    ambitious -- the same S1 floor / S2 derived / S3 ceiling arithmetic
    frontend/src/lib/offerDeskScenarios.ts::scenarioStrip already runs,
    ported here so the governor bundle and any other backend caller read it
    off one engine, not a second one. S2 (as_calculated) is not recomputed
    -- it is the real, already-persisted recommended_level, exactly as
    scenarioStrip treats verdict.recommended_level. S1 (careful) and S3
    (ambitious) replay _level_at against the minimum/maximum of the seven
    real scores instead of their mean. The same cap (replayed from
    applied_gates, not re-derived) applies to all three, so a hard gate
    that fired caps ambitious exactly like it caps careful and
    as_calculated."""
    cleaned = {p: clamp_score(scores[p]) for p in PROPERTIES}
    values = [cleaned[p] for p in PROPERTIES]
    cap = cap_from_applied_gates(applied_gates)
    return {
        "careful": min(_level_at(cleaned, min(values)), cap),
        "as_calculated": min(recommended_level, cap),
        "ambitious": min(_level_at(cleaned, max(values)), cap),
        "cap": cap,
    }


def derive_autonomy(
    scores: dict[str, int],
    *,
    requires_licensed_human: bool = False,
    evidence_path_exists: bool = True,
) -> dict[str, Any]:
    cleaned = {p: clamp_score(scores[p]) for p in PROPERTIES}
    uncapped = base_level(cleaned)
    capped, gates = apply_hard_gates(
        uncapped,
        cleaned,
        requires_licensed_human=requires_licensed_human,
        evidence_path_exists=evidence_path_exists,
    )
    return {
        "scores": cleaned,
        "mean": round(mean_score(cleaned), 3),
        "uncapped_level": uncapped,
        "recommended_level": capped,
        "level_name": LEVEL_NAMES[capped],
        "applied_gates": gates,
        "allocation": allocation_for(capped, actor_type="human"),
    }


def allocation_for(level: int, actor_type: str = "human") -> str:
    """H3: make / agent / automate / buy — a decision per unit, not per function."""
    if actor_type == "external":
        return "buy"
    if level >= 6:
        return "automate"
    if level >= 3:
        return "agent"
    return "make"


def scores_from_orm(row) -> dict[str, int]:
    return {p: getattr(row, p) for p in PROPERTIES}


def persist_derivation(row, result: dict[str, Any], actor_type: str) -> None:
    row.recommended_level = result["recommended_level"]
    row.applied_gates = json.dumps(result["applied_gates"])
    row.allocation = allocation_for(result["recommended_level"], actor_type)
