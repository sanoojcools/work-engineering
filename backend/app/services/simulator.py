"""V10-13 (docs/contracts/v10-13-simulator.md): case simulator for the one
Offer -> Day-1 journey. Reads packs/hr/hire_leaves.yaml -- the same 18
leaves Cursor's Chart already renders from -- and runs three scenarios
(careful / as_calculated / ambitious) over them, deterministically, with no
LLM and no second arithmetic: a leaf that already has a real VerdictScore
defers to services/verdict.py rather than inventing its own scoring, and
the dual-employment stop (services/handoff.py's DUAL_EMPLOYMENT_STOP_CODES)
is reported here, never lifted.

Not Box 6 (workforce/headcount simulator across a whole org) and not Box 4
(agents actually executing) -- this only answers "which leaves would fire,
where would a human still have to touch it, where would Spec block it,"
for one already-declared case. `capacity` is explicitly `labelled:
"not_live"`: a hypothetical read of stated/defended hours, never a
scheduling or execution decision.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.verdict import VerdictScore
from ..models.workunit import WorkUnit
from . import handoff as handoff_svc

HIRE_LEAVES_PACK = Path(__file__).resolve().parents[3] / "packs" / "hr" / "hire_leaves.yaml"

# Aliases accepted on the querystring, mapped to the three real scenario
# names -- never exposed as the only names (docs/contracts/v10-13-simulator.md).
SCENARIO_ALIASES = {
    "s1": "careful",
    "s2": "as_calculated",
    "s3": "ambitious",
    "careful": "careful",
    "as_calculated": "as_calculated",
    "ambitious": "ambitious",
}

DEFAULT_SCENARIO = "as_calculated"

# The one named twin this contract allows -- WU-HIRE-05 (dual employment /
# integrity, this pack) and WU-OD-02 (the same sheet step under the Offer
# Desk's own real work-unit codes, services/handoff.py's
# DUAL_EMPLOYMENT_STOP_CODES). Do not invent any other twin.
HIRE05_TWIN_CODE = "WU-OD-02"


def resolve_scenario(raw: str) -> str:
    key = (raw or "").strip().lower()
    if key not in SCENARIO_ALIASES:
        raise ValueError(f"Unknown scenario '{raw}'")
    return SCENARIO_ALIASES[key]


def _load_pack() -> dict[str, Any]:
    with open(HIRE_LEAVES_PACK, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _fires_for_leaf(leaf: dict[str, Any], scenario: str) -> tuple[str, str | None, bool]:
    """Returns (fires, blocked_reason, stop) per the contract's deterministic
    rules, checked in the contract's own order."""
    band = leaf["band"]
    if band == "external":
        return "outside", None, False
    if leaf.get("stop") == "dual_employment":
        return "blocked", "dual_employment", True
    if band == "human":
        return "human_must_touch", None, False
    if scenario == "careful" and band == "augment":
        return "human_must_touch", None, False
    return "yes", None, False


def _actual_for_unit(db: Session, wu: WorkUnit, fires: str) -> str:
    """A real work unit exists for this leaf (or its one named twin) -- ask
    the same handoff check the desk itself would run, rather than a second
    arithmetic. A 422 (admissibility, or any other hard refusal) reports
    `blocked`; a 200 with the dual-employment stop still named reports
    `blocked` too; a scored unit reports whatever this leaf's own `fires`
    value is; an unscored one is honestly `not_scored`."""
    try:
        result = handoff_svc.check_readiness(db, wu.code)
    except HTTPException as exc:
        if exc.status_code == 422:
            return "blocked"
        raise
    if not result.ready and result.dual_employment_stop_required:
        return "blocked"
    verdict = db.query(VerdictScore).filter(VerdictScore.work_unit_id == wu.id).one_or_none()
    if verdict is not None:
        return fires
    return "not_scored"


def _actual_for_leaf(db: Session, leaf_id: str, fires: str) -> str:
    candidate_codes = [leaf_id]
    if leaf_id == "WU-HIRE-05":
        candidate_codes = [leaf_id, HIRE05_TWIN_CODE]
    for code in candidate_codes:
        wu = db.query(WorkUnit).filter(WorkUnit.code == code).one_or_none()
        if wu is not None:
            return _actual_for_unit(db, wu, fires)
    return "not_scored"


# Offer Desk stated/defended totals (Plan 95 / 61.8) -- fixed constants, not
# read off a per-leaf sum: parents_stated_hrs_mo in hire_leaves.yaml already
# says "Plan still shows 95 stated / 61.8 defended as Offer Desk totals. Do
# not print 61.8 on a leaf." 160 = one person-month of hours (contract).
STATED_HOURS_MO = 95.0
DEFENDED_HOURS_MO = 61.8
HOURS_PER_FTE_MONTH = 160.0


def build_simulation(db: Session, scenario: str) -> dict[str, Any]:
    pack = _load_pack()
    composite = pack["composite"]
    leaves = pack["leaves"]

    out_leaves: list[dict[str, Any]] = []
    human_must_touch: list[str] = []
    spec_blocks: list[dict[str, str]] = []

    for leaf in leaves:
        fires, blocked_reason, stop = _fires_for_leaf(leaf, scenario)
        actual = _actual_for_leaf(db, leaf["id"], fires)

        out_leaves.append({
            "id": leaf["id"],
            "name": leaf["name"],
            "band": leaf["band"],
            "fires": fires,
            "blocked_reason": blocked_reason,
            "expected": leaf["band"],
            "actual": actual,
            "stop": stop,
        })

        if leaf["band"] == "human" or fires == "human_must_touch":
            human_must_touch.append(leaf["id"])
        if fires == "blocked":
            spec_blocks.append({"id": leaf["id"], "reason": blocked_reason or "blocked"})

    return {
        "work_system": composite["work_system"],
        "composite": composite["name"],
        "scenario": scenario,
        "leaf_count": len(out_leaves),
        "leaves": out_leaves,
        "human_must_touch": human_must_touch,
        "spec_blocks": spec_blocks,
        "capacity": {
            "labelled": "not_live",
            "stated_hours_mo": STATED_HOURS_MO,
            "defended_hours_mo": DEFENDED_HOURS_MO,
            "if_we_ran_this": (
                "How many people or agents this would take if we ran it today -- not live, not a commitment."
            ),
            "peak_fte_stated": STATED_HOURS_MO / HOURS_PER_FTE_MONTH,
        },
    }
