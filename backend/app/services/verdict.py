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


def base_level(scores: dict[str, int]) -> int:
    """Map the 1–5 mean onto L1–L5. L6 requires a deterministic special case."""
    mean = mean_score(scores)
    if mean < 2.0:
        level = 1
    elif mean < 2.75:
        level = 2
    elif mean < 3.5:
        level = 3
    elif mean < 4.25:
        level = 4
    else:
        level = 5
    # L6 is fully deterministic automation (no LLM): high D, V, T and a high mean.
    if (
        scores["determinism"] == 5
        and scores["verifiability"] >= 4
        and scores["tacitness"] >= 4
        and mean >= 4.5
    ):
        level = 6
    return level


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
        cap = min(cap, 2)
        gates.append("gate1_regulatory")
    if scores["reversibility"] == 1:
        cap = min(cap, 3)
        gates.append("gate2_reversibility")
    if scores["impact_scope"] == 1:
        cap = min(cap, 3)
        gates.append("gate3_impact")
    if (not evidence_path_exists) or scores["evidence"] == 1:
        cap = min(cap, 2)
        gates.append("gate4_evidence")
    return min(level, cap), gates


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
