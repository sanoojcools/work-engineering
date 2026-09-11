"""P2 -- Handoff completeness (docs/BUILD_PROGRAM.md CENSUS-PACK), extended
by V10-3 (docs/contracts/v10-3-verify.md).

A Work Unit is Ready to hand off only if:
  1. a record exists for its code on this tenant,
  2. VERDICT has actually scored it, so its hard gates are *known*. An
     empty gates list from a real score is fine ("gates listed: may be
     none" per the build doc); the absence of a score is not, because
     nobody can honestly call a unit ready without having run the scoring
     that would surface a gate if one applied.
  3. where the sheet itself states a dual-employment stop on this exact
     unit (Document check, sheet step 2 -- offerDeskWorkRecord.ts's
     DOCUMENT_CHECK_RECORD.stopRule), the live record still carries that
     stop in its own persisted text. This is the one condition that can
     regress after being true: an edit to the record could silently drop
     the stop language, and this check exists to catch exactly that drift,
     not to restate a rule that can never fail.
  4. V10-11 (docs/contracts/v10-11-states.md): for a unit on the Offer Desk
     -> Onboarding journey (work_system.py::desk_of), admissibility is a
     hard refusal, not a reason string in a 200 body -- no_exit,
     two_owners, and unaffordable_check each 422 with that same reason,
     checked before any of the gates below and before the dual-employment
     stop, so an inadmissible unit is never evaluated for readiness at
     all. A unit off this journey is unaffected (services/admissibility.py
     only scores journey units).
  5. V10-3's 5th gate, `intent_guardrail` (docs/contracts/v10-3-verify.md,
     verbatim): `method=none` (no verification_designs row at all reads
     identically to one whose row still says so) OR `independent` is
     `no`/`not_stated` while this unit is one that always needs
     independence -- offer-release (sheet step 5, "trigger offer letter" --
     frontend/src/lib/workSystemUnits.ts's candidateCodes("offer-desk", 5))
     and dual-employment (step 2, same codes as condition 3) units, named
     as such by the contract rather than a general caller-settable flag.
     Non-waivable: no field anywhere turns either half back off.

Read-only. Never executes the unit, never sends it to an agent (P2's own
scope line) -- this only answers "is this unit's record complete enough to
hand off," the same way Spec's own POST /spec/check answers "is this
particular action allowed" without performing it.

Mirrored, not re-implemented, on the frontend (lib/handoffReadiness.ts) so
Plan can show the same Ready/Not-ready+why for every unit already loaded
there without one network round trip per unit -- the same relationship
offerDeskScenarios.ts already has with services/verdict.py.
"""
from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.pointers import FieldPointer, PointerStatus
from ..models.verdict import VerdictScore
from ..models.verification_design import IndependenceKind, VerificationDesign, VerificationDesignMethod
from ..models.workunit import WorkUnit
from ..schemas.handoff import (
    ActorPolicyOut,
    HandoffBundleOut,
    HandoffOut,
    ProvenanceOut,
    ScenarioOut,
    ValidatorSpecOut,
)
from . import admissibility as admissibility_svc
from . import verdict as verdict_svc
from . import work_units as wu_svc
from .work_system import desk_of

# The two views V10-14 (docs/contracts/v10-14-handoff.md) puts on this same
# route. `governor` is the default so today's callers keep working.
GOVERNOR_VIEW = "governor"
PERFORMER_VIEW = "performer"
VALID_VIEWS = frozenset({GOVERNOR_VIEW, PERFORMER_VIEW})

# V10-3's 5th gate id (docs/contracts/v10-3-verify.md, verbatim), surfaced
# in HandoffOut.gates alongside VERDICT's own gate1_regulatory..
# gate4_evidence -- computed here, at handoff time, rather than persisted
# on VerdictScore.applied_gates, so it never changes what automation_index/
# census/projections already read off a scored unit (services/verdict.py's
# recommended_level/applied_gates are untouched).
INTENT_GUARDRAIL = "intent_guardrail"

# The sheet's own dual-employment stop (offerDeskWorkRecord.ts's
# DOCUMENT_CHECK_RECORD.stopRule) attaches to exactly one real business
# record -- Offer Desk sheet step 2, "Verify candidate documents" -- under
# either code shape this app's own import paths actually produce: the
# 2-digit code the evidence pack imports (WU-OD-02) and the 3-digit code
# the family-genome import uses for the same sheet step (WU-OD-002; see
# frontend/src/lib/workSystemUnits.ts's candidateCodes()). No other unit's
# sheet states this stop, so no other code is checked against it.
DUAL_EMPLOYMENT_STOP_CODES = frozenset({"WU-OD-02", "WU-OD-002"})

# Sheet step 5, "Rashmi triggers offer letter in Zwayam... TA Head signs
# first, then sent to candidate" (offerDeskData.ts) -- the one step that is
# the offer's actual release, distinct from step 2's document check.
# Same two code shapes as DUAL_EMPLOYMENT_STOP_CODES, same reasoning.
OFFER_RELEASE_CODES = frozenset({"WU-OD-05", "WU-OD-005"})

# Units the contract names as always needing independence, regardless of
# any explicit per-unit setting -- "offer-release and dual-employment units
# always need independence != no" (docs/contracts/v10-3-verify.md).
_ALWAYS_NEEDS_INDEPENDENCE = DUAL_EMPLOYMENT_STOP_CODES | OFFER_RELEASE_CODES

_INDEPENDENCE_MISSING = (IndependenceKind.no, IndependenceKind.not_stated)


def _dual_employment_text_present(wu: WorkUnit) -> bool:
    haystack = " ".join([
        wu.failure_semantics or "",
        wu.acceptance_criteria or "",
        wu.evidence_required or "",
        wu.context or "",
    ]).lower()
    return "dual employ" in haystack


def _build_bundle(db: Session, wu: WorkUnit, verdict: VerdictScore, gates: list[str], view: str) -> HandoffBundleOut:
    """Only called when `ready` is True, so `verdict` is guaranteed (rule 2
    above: no score -> not ready -> no bundle). `view=performer` withholds
    scores per the contract: scenario ints all null, and `record` -- which
    never carried recommended_level or raw VERDICT properties to begin
    with -- is otherwise identical between the two views."""
    design = db.query(VerificationDesign).filter(VerificationDesign.work_unit_id == wu.id).one_or_none()
    method = design.method.value if design else VerificationDesignMethod.none.value
    independent = design.independent.value if design else IndependenceKind.not_stated.value

    pointers = db.query(FieldPointer).filter(FieldPointer.work_unit_id == wu.id).all()
    composed = any(p.status == PointerStatus.composed for p in pointers)

    if view == PERFORMER_VIEW:
        scenario = ScenarioOut()
    else:
        applied_gates = json.loads(verdict.applied_gates)
        scores = verdict_svc.scores_from_orm(verdict)
        levels = verdict_svc.scenario_levels(
            scores, recommended_level=verdict.recommended_level, applied_gates=applied_gates,
        )
        scenario = ScenarioOut(**levels)

    return HandoffBundleOut(
        record=wu_svc.to_out(wu),
        actor_policy=ActorPolicyOut(cap=verdict.allocation, owner=wu.owner),
        gates=gates,
        validator_spec=ValidatorSpecOut(method=method, independent=independent),
        scenario=scenario,
        provenance=ProvenanceOut(source=wu.provenance.value, composed=composed),
    )


def check_readiness(db: Session, code: str, view: str = GOVERNOR_VIEW) -> HandoffOut:
    if view not in VALID_VIEWS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unknown view {view!r}; expected one of {sorted(VALID_VIEWS)}",
        )
    wu = db.query(WorkUnit).filter(WorkUnit.code == code).one_or_none()
    if wu is None:
        return HandoffOut(
            work_unit_code=code,
            ready=False,
            reasons=[f"No record for '{code}' on this tenant -- nothing to hand off yet."],
        )

    if desk_of(wu.code) is not None:
        refusals = admissibility_svc.refusals_for_unit(db, wu)
        if refusals:
            first = refusals[0]
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"work_unit_code": wu.code, "reason": first.reason, "detail": first.detail},
            )

    reasons: list[str] = []

    verdict = db.query(VerdictScore).filter(VerdictScore.work_unit_id == wu.id).one_or_none()
    gates = json.loads(verdict.applied_gates) if verdict is not None else None
    if verdict is None:
        reasons.append("Not yet scored on VERDICT -- gates unknown, so this cannot honestly be called ready.")

    dual_required = code in DUAL_EMPLOYMENT_STOP_CODES
    if dual_required and not _dual_employment_text_present(wu):
        reasons.append(
            "This tenant's sheet requires the dual-employment stop on this unit, and the live record no "
            "longer states it."
        )

    # 5th gate: intent_guardrail (docs/contracts/v10-3-verify.md).
    design = db.query(VerificationDesign).filter(VerificationDesign.work_unit_id == wu.id).one_or_none()
    method_missing = design is None or design.method == VerificationDesignMethod.none
    needs_independence = code in _ALWAYS_NEEDS_INDEPENDENCE
    independence_missing = design is None or design.independent in _INDEPENDENCE_MISSING
    if method_missing or (needs_independence and independence_missing):
        detail = []
        if method_missing:
            detail.append("no verification method is recorded")
        if needs_independence and independence_missing:
            detail.append("this unit always needs an independent check and none is recorded")
        reasons.append("Not ready (5th gate, non-waivable): " + "; ".join(detail) + ".")
        gates = [*(gates or []), INTENT_GUARDRAIL]

    ready = not reasons
    return HandoffOut(
        work_unit_code=code,
        ready=ready,
        reasons=reasons,
        verification_method=wu.verification_method.value if wu.verification_method else None,
        gates=gates,
        dual_employment_stop_required=dual_required,
        independent_check_required=needs_independence,
        bundle=_build_bundle(db, wu, verdict, gates or [], view) if ready else None,
    )
