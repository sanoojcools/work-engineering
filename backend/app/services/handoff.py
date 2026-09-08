"""P2 -- Handoff completeness (docs/BUILD_PROGRAM.md CENSUS-PACK).

A Work Unit is Ready to hand off only if:
  1. a record exists for its code on this tenant,
  2. it names a verification method -- models/workunit.py's own column
     default means any real row already satisfies this the moment (1)
     holds, so this is a schema guarantee once a record exists, not a
     second live check invented here. There is no separate "independent
     checker" column on WorkUnit today (offerDeskWorkRecord.ts's own
     `independentChecker` prose is frontend-only, Document-check-specific
     text) -- inventing one to score against here would be exactly the
     kind of fabricated field this codebase's own honesty discipline
     refuses elsewhere, so a named verification method is read as
     satisfying this condition's whole "check method OR no independent
     checker today" clause: either a real method is named (this), or,
     failing that, an explicit "none today" would have to be a real
     stated field to check -- and none exists to check today.
  3. VERDICT has actually scored it, so its hard gates are *known*. An
     empty gates list from a real score is fine ("gates listed: may be
     none" per the build doc); the absence of a score is not, because
     nobody can honestly call a unit ready without having run the scoring
     that would surface a gate if one applied.
  4. where the sheet itself states a dual-employment stop on this exact
     unit (Document check, sheet step 2 -- offerDeskWorkRecord.ts's
     DOCUMENT_CHECK_RECORD.stopRule), the live record still carries that
     stop in its own persisted text. This is the one condition that can
     regress after being true: an edit to the record could silently drop
     the stop language, and this check exists to catch exactly that drift,
     not to restate a rule that can never fail.
  5. V10-3's 5th gate: an independent check is required and recorded.
     "Required" is true whenever either is true -- a human explicitly said
     so on this unit's verification_design (services/verification_design.py),
     or VERDICT's own origin is "inferred" rather than "confirmed" (nobody
     has attested this score, so an independent check is required
     regardless of what the design says -- this half is non-waivable: there
     is no field that can turn it back off). "Recorded" means
     VerificationDesign.independence is anything other than "no". Neither
     half invents a requirement nobody stated or attested -- same discipline
     condition 4 already follows for the dual-employment stop.

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

from sqlalchemy.orm import Session

from ..models.verdict import VerdictScore
from ..models.verification_design import IndependenceKind, VerificationDesign
from ..models.workunit import WorkUnit
from ..schemas.handoff import HandoffOut
from . import work_units as wu_svc

# V10-3's 5th gate id, surfaced in HandoffOut.gates alongside VERDICT's own
# gate1_regulatory..gate4_evidence -- computed here, at handoff time, rather
# than persisted on VerdictScore.applied_gates, so it never changes what
# automation_index/census/projections already read off a scored unit
# (services/verdict.py's recommended_level/applied_gates are untouched).
GATE5_INDEPENDENT_CHECK = "gate5_independent_check"

# The sheet's own dual-employment stop (offerDeskWorkRecord.ts's
# DOCUMENT_CHECK_RECORD.stopRule) attaches to exactly one real business
# record -- Offer Desk sheet step 2, "Verify candidate documents" -- under
# either code shape this app's own import paths actually produce: the
# 2-digit code the evidence pack imports (WU-OD-02) and the 3-digit code
# the family-genome import uses for the same sheet step (WU-OD-002; see
# frontend/src/lib/workSystemUnits.ts's candidateCodes()). No other unit's
# sheet states this stop, so no other code is checked against it.
DUAL_EMPLOYMENT_STOP_CODES = frozenset({"WU-OD-02", "WU-OD-002"})


def _dual_employment_text_present(wu: WorkUnit) -> bool:
    haystack = " ".join([
        wu.failure_semantics or "",
        wu.acceptance_criteria or "",
        wu.evidence_required or "",
        wu.context or "",
    ]).lower()
    return "dual employ" in haystack


def check_readiness(db: Session, code: str) -> HandoffOut:
    wu = db.query(WorkUnit).filter(WorkUnit.code == code).one_or_none()
    if wu is None:
        return HandoffOut(
            work_unit_code=code,
            ready=False,
            reasons=[f"No record for '{code}' on this tenant -- nothing to hand off yet."],
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

    # 5th gate (docs/BUILD_PROGRAM.md): non-waivable the moment VERDICT's
    # intent isn't confirmed -- see this module's docstring, condition 5.
    design = db.query(VerificationDesign).filter(VerificationDesign.work_unit_id == wu.id).one_or_none()
    intent_unconfirmed = verdict is not None and verdict.origin != "confirmed"
    independence_required = bool(design and design.independence_required) or intent_unconfirmed
    independence_recorded = design is not None and design.independence != IndependenceKind.no
    if independence_required and not independence_recorded:
        reasons.append(
            "Independent check required and missing"
            + (" -- VERDICT's intent is not yet confirmed by a human (non-waivable)" if intent_unconfirmed else "")
            + "."
        )
        gates = [*(gates or []), GATE5_INDEPENDENT_CHECK]

    ready = not reasons
    return HandoffOut(
        work_unit_code=code,
        ready=ready,
        reasons=reasons,
        verification_method=wu.verification_method.value if wu.verification_method else None,
        gates=gates,
        dual_employment_stop_required=dual_required,
        independent_check_required=independence_required,
        bundle=wu_svc.to_out(wu) if ready else None,
    )
