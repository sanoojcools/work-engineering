from __future__ import annotations

from datetime import datetime

from ..models.work_system import WorkSystem
from ..schemas.work_system import IntentOut, WorkSystemOut

# V10-5b (docs/NEXT.md): the desks this build's one Work System spans, in
# journey order -- the backend half of what frontend/src/lib/
# workSystemUnits.ts already declares as LANE_DESK_IDS + DESK_CODE_PREFIX
# ("offer-desk" then "onboarding"). Lives here, next to the Work System
# itself, because "which desks are in the Work System, and in what order"
# is a fact about the journey, not about genome import -- which only reads
# it to decide whether the seam between two desks was ever handed off
# (services/genome_import.py::_flag_missing_handoff).
#
# Each desk is matched by the real code prefixes this repo's own import
# paths actually produce for it, never by an invented desk column:
#   Offer Desk -- WU-OD- (offer-desk-inputs/06-payoff-genome's evidence
#   pack and the 3-digit family-genome shape, same two shapes
#   services/handoff.py already names) and WU-OFF- (the private-genome
#   samples/*.json shape for the same desk).
#   Onboarding -- WU-ONB-.
# The trailing hyphen is load-bearing: it keeps WU-OFFB- (Offboarding, a
# different desk that is explicitly not in this Work System) out of the
# Offer Desk lane, which a bare "WU-OFF" prefix test would swallow.
WORK_SYSTEM_DESK_LANES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Offer Desk", ("WU-OD-", "WU-OFF-")),
    ("Onboarding", ("WU-ONB-",)),
)


def desk_of(code: str) -> str | None:
    """Which Work System desk a Work Unit code sits on, or None for a unit
    outside this journey entirely (WU-HRBP-*, WU-FIN-*, WU-OFFB-*, ...)."""
    for desk_name, prefixes in WORK_SYSTEM_DESK_LANES:
        if any(code.startswith(p) for p in prefixes):
            return desk_name
    return None


def _intent_status(confirmed_at: datetime | None) -> str:
    return "confirmed" if confirmed_at is not None else "draft"


def to_out(ws: WorkSystem) -> WorkSystemOut:
    return WorkSystemOut(
        id=ws.id,
        code=ws.code,
        name=ws.name,
        entry=ws.entry,
        exit=ws.exit,
        owner=ws.owner,
        outcome=ws.outcome,
        status=ws.status.value,
        ratified_by=ws.ratified_by,
        ratified_at=ws.ratified_at,
        created_at=ws.created_at,
        function_intent=IntentOut(
            label=ws.function_intent_outcome,
            owner=ws.function_intent_owner,
            measure=ws.function_intent_measure or "not stated",
            status=_intent_status(ws.function_intent_confirmed_at),
            confirmed_by=ws.function_intent_confirmed_by,
            confirmed_at=ws.function_intent_confirmed_at,
        ),
        work_system_intent=IntentOut(
            label=ws.work_system_intent_purpose,
            owner=ws.work_system_intent_owner,
            measure=None,
            status=_intent_status(ws.work_system_intent_confirmed_at),
            confirmed_by=ws.work_system_intent_confirmed_by,
            confirmed_at=ws.work_system_intent_confirmed_at,
        ),
    )
