"""P0-5 + Day 5-6: POST /api/genome/import orchestration.

Order matters: GQS runs on the RAW dict first (so a failing genome still
gets a score + violation list, not a bare validation error) — only a
genome that clears GQS>=90 gets Pydantic-validated and written to the DB.
A GQS pass does not guarantee Pydantic passes (GQS's completeness check is
looser than the strict schema — e.g. it doesn't enforce provenance.source_type
is one of exactly 4 values), so that's a genuinely separate gate, not
redundant with GQS.
"""
from __future__ import annotations

import json

from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..models.client import Client
from ..models.graph import EdgeType, WorkEdge
from ..models.ontology import EntityKind, EntityType, Provenance
from ..models.regulatory import RegulatoryEntry
from ..models.security import AuditLog, GenomeVersion, GenomeVersionType, UploadedFile, WorkUnitProvenanceDetail, WorkUnitRegulatoryLink
from ..models.workunit import ActorType, UnitStatus, VerificationMethod, WorkUnit
from ..schemas.genome_import import GenomeImportRequest
from . import work_units as wu_svc
from .gqs import GATE_PASS_THRESHOLD, compute_gqs
from .pii import PII_CANDIDATE_FIELDS, scan_and_store_pii

VERDICT_KEY_MAP = {
    "V": "verifiability", "E": "evidence", "R": "reversibility",
    "D": "determinism", "I": "impact_scope", "C": "compliance", "T": "tacitness",
}

_VERIFICATION_KEYWORDS: list[tuple[VerificationMethod, tuple[str, ...]]] = [
    (VerificationMethod.deterministic_rule, ("deterministic rule",)),
    (VerificationMethod.database_constraint, ("database constraint", "system log check", "db state")),
    (VerificationMethod.cross_system_reconciliation, ("cross-system", "cross system", "reconciliation")),
    (VerificationMethod.human_spot_check, ("human spot check", "spot check")),
    (VerificationMethod.llm_as_judge, ("llm-as-judge", "llm as judge")),
    (VerificationMethod.outcome_delay, ("outcome delay",)),
    (VerificationMethod.counterparty_confirmation, ("counterparty confirmation",)),
]


def _clip(value: str, max_len: int) -> str:
    """current_condition/desired_condition are VARCHAR(80) by design — V8
    intends these as short state-machine labels (Draft -> Validated ->
    Committed), not full sentences. Some real-world source data (verbose HR
    condition descriptions) exceeds that; clip rather than widen the column,
    since widening would blur the state-machine-label intent for every
    other caller of WorkUnit."""
    return value if len(value) <= max_len else value[: max_len - 1] + "…"


def _map_verification_method(text_value: str) -> VerificationMethod:
    low = text_value.lower()
    for method, keywords in _VERIFICATION_KEYWORDS:
        if any(k in low for k in keywords):
            return method
    return VerificationMethod.human_spot_check


def _get_or_create_entity_type(db: Session, name: str) -> EntityType:
    row = db.query(EntityType).filter(EntityType.name == name).one_or_none()
    if row:
        return row
    row = EntityType(name=name, kind=EntityKind.business_object, description="", state_machine="[]")
    db.add(row)
    db.flush()
    return row


def _get_or_create_regulatory_entry(db: Session, rr_id: str) -> RegulatoryEntry:
    row = db.query(RegulatoryEntry).filter(RegulatoryEntry.regulation == rr_id).one_or_none()
    if row:
        return row
    row = RegulatoryEntry(
        regulation=rr_id, clause="",
        control_objective=f"Auto-created stub for {rr_id} — populate via /regulatory before relying on it for compliance gating",
        requires_licensed_human=False,
    )
    db.add(row)
    db.flush()
    return row


def _validate_file_provenance(db: Session, client_id: int, parsed: GenomeImportRequest) -> list[dict]:
    """Slice 1 PR 1a: a Work Unit citing provenance.file_id must reference a
    real UploadedFile for this tenant, and if it also supplies hash_sha256,
    that hash must match the server-computed one on record. This runs as a
    pre-pass over the whole batch (before any WorkUnit row is written) so a
    bad reference fails the entire import, not a partial write.

    A Work Unit with NO file_id is unaffected — that's the caller-supplied-hash
    path that already existed, and stays exactly as it was."""
    violations: list[dict] = []
    for wu_in in parsed.work_units:
        file_id_raw = wu_in.provenance.file_id
        if not file_id_raw:
            continue
        try:
            file_pk = int(file_id_raw)
        except (TypeError, ValueError):
            violations.append({
                "code": "unknown_file_id",
                "detail": f"{wu_in.id}: provenance.file_id {file_id_raw!r} is not a valid UploadedFile id",
            })
            continue
        row = db.query(UploadedFile).filter(UploadedFile.id == file_pk, UploadedFile.client_id == client_id).one_or_none()
        if row is None:
            violations.append({
                "code": "unknown_file_id",
                "detail": f"{wu_in.id}: provenance.file_id {file_id_raw!r} does not exist for this tenant",
            })
            continue
        if wu_in.provenance.hash_sha256 and wu_in.provenance.hash_sha256 != row.sha256:
            violations.append({
                "code": "file_hash_mismatch",
                "detail": f"{wu_in.id}: provenance.hash_sha256 does not match UploadedFile {file_id_raw}'s server-computed sha256",
            })
    return violations


def _log_audit(db: Session, client_id: int, actor: str, action: str, resource: str, resource_id: str, detail: str = "") -> None:
    db.add(AuditLog(client_id=client_id, actor=actor, action=action, resource=resource, resource_id=resource_id, detail=detail))


def _failure_result(gqs_result: dict, version: GenomeVersion, violations: list[dict]) -> dict:
    return {
        "accepted": False,
        "version_id": version.id,
        "gqs": gqs_result["gqs"],
        "gate_threshold": GATE_PASS_THRESHOLD,
        "breakdown": gqs_result["breakdown"],
        "violations": violations,
        "work_unit_count": gqs_result["work_unit_count"],
    }


def import_genome(db: Session, client_id: int, raw_genome: dict, *, actor: str = "") -> dict:
    gqs_result = compute_gqs(raw_genome, kappa=raw_genome.get("dual_scoring_kappa"))

    sequence = db.query(GenomeVersion).filter(GenomeVersion.client_id == client_id).count() + 1
    version = GenomeVersion(
        client_id=client_id,
        version_type=GenomeVersionType.detailed,
        sequence=sequence,
        gqs_score=gqs_result["gqs"],
        work_unit_count=gqs_result["work_unit_count"],
        gates_passed=json.dumps([]),
        gates_failed=json.dumps(gqs_result["violations"]),
    )
    db.add(version)
    db.flush()
    _log_audit(
        db, client_id, actor, "genome.import.attempt", "genome_version", str(version.id),
        detail=json.dumps({"gqs": gqs_result["gqs"], "violation_count": len(gqs_result["violations"])}),
    )

    if not gqs_result["passes_gate"]:
        db.commit()
        return _failure_result(gqs_result, version, gqs_result["violations"])

    try:
        parsed = GenomeImportRequest.model_validate(raw_genome)
    except ValidationError as exc:
        pyd_violations = [{"code": "pydantic_validation", "detail": e["msg"], "loc": ".".join(str(p) for p in e["loc"])} for e in exc.errors()]
        version.gates_failed = json.dumps(pyd_violations)
        db.commit()
        return _failure_result(gqs_result, version, pyd_violations)

    file_violations = _validate_file_provenance(db, client_id, parsed)
    if file_violations:
        version.gates_failed = json.dumps(file_violations)
        db.commit()
        return _failure_result(gqs_result, version, file_violations)

    code_to_wu: dict[str, WorkUnit] = {}
    for wu_in in parsed.work_units:
        entity_type = _get_or_create_entity_type(db, wu_in.business_object)
        try:
            provenance = Provenance(wu_in.provenance.source_type)
        except ValueError:
            provenance = Provenance.designed

        sla_hours = round(wu_in.sla_timing.time_per_case_min / 60.0, 4) if wu_in.sla_timing.time_per_case_min else 0.0

        wu = WorkUnit(
            client_id=client_id,
            genome_version_id=version.id,
            code=_clip(wu_in.id, 40),
            name=_clip(wu_in.name, 200),
            business_object_type_id=entity_type.id,
            current_condition=_clip(wu_in.current_condition, 80),
            desired_condition=_clip(wu_in.desired_condition, 80),
            context=json.dumps(wu_in.context.model_dump()),
            trigger=wu_in.trigger,
            inputs="; ".join(wu_in.input),
            authority=wu_in.authority,
            actor_constraints=wu_in.actor_constraints,
            acceptance_criteria="; ".join(wu_in.acceptance_criteria),
            evidence_required="; ".join(wu_in.evidence_required),
            verification_method=_map_verification_method(wu_in.verification_method),
            sla_hours=sla_hours,
            failure_semantics=wu_in.failure_semantics,
            provenance=provenance,
            owner="",
            actor_type=ActorType.human,
            status=UnitStatus.draft,
            autonomy_level=1,
        )
        db.add(wu)
        db.flush()
        code_to_wu[wu_in.id] = wu

        # file_id resolution: _validate_file_provenance already proved this
        # int()s cleanly and exists for this tenant, if it was supplied at all.
        resolved_file_pk = int(wu_in.provenance.file_id) if wu_in.provenance.file_id else None
        db.add(WorkUnitProvenanceDetail(
            work_unit_id=wu.id,
            source_type=provenance,
            file_id=resolved_file_pk,
            row_ref=wu_in.provenance.row,
            col_ref=wu_in.provenance.col or "",
            hash_sha256=wu_in.provenance.hash_sha256 or "",
            source_timestamp=None,
            interview_ref=wu_in.provenance.interview_id or "",
            consent_receipt_id=None,
        ))
        if resolved_file_pk is None and wu_in.provenance.hash_sha256:
            # Caller supplied a hash without a real file_id — it was never
            # server-computed. Flag it, don't block it (that's the existing,
            # already-proven caller-supplied-hash path).
            _log_audit(
                db, client_id, actor, "provenance.hash.not_computed", "work_unit", wu_in.id,
                detail="hash_sha256 supplied without a resolvable file_id — not server-computed",
            )

        for rr_id in wu_in.regulatory_register_link:
            entry = _get_or_create_regulatory_entry(db, rr_id)
            db.add(WorkUnitRegulatoryLink(work_unit_id=wu.id, regulatory_entry_id=entry.id))

        if wu_in.verdict:
            scores, complete = {}, True
            for short, long_name in VERDICT_KEY_MAP.items():
                val = wu_in.verdict.get(short)
                if not isinstance(val, int):
                    complete = False
                    break
                scores[long_name] = val
            if complete:
                wu_svc.apply_verdict(db, wu, scores, origin="inferred")

        scan_and_store_pii(db, wu.id, {
            "authority": wu_in.authority,
            "actor_constraints": wu_in.actor_constraints,
            "input": "; ".join(wu_in.input),
            "evidence_required": "; ".join(wu_in.evidence_required),
        })

    edge_count = 0
    for wu_in in parsed.work_units:
        target = code_to_wu.get(wu_in.id)
        for dep_code in wu_in.dependencies:
            source = code_to_wu.get(dep_code)
            if source is None or target is None:
                continue
            dup = db.query(WorkEdge).filter(WorkEdge.source_id == source.id, WorkEdge.target_id == target.id).one_or_none()
            if dup is None:
                db.add(WorkEdge(source_id=source.id, target_id=target.id, edge_type=EdgeType.sequence))
                edge_count += 1

    version.work_unit_count = len(code_to_wu)
    version.gates_passed = json.dumps(["gqs", "pydantic_validation"])
    version.gates_failed = json.dumps([])
    db.commit()

    _log_audit(
        db, client_id, actor, "genome.import.committed", "genome_version", str(version.id),
        detail=json.dumps({"work_unit_count": len(code_to_wu), "edge_count": edge_count}),
    )
    db.commit()

    return {
        "accepted": True,
        "version_id": version.id,
        "gqs": gqs_result["gqs"],
        "gate_threshold": GATE_PASS_THRESHOLD,
        "breakdown": gqs_result["breakdown"],
        "violations": [],
        "work_unit_count": len(code_to_wu),
        "work_graph_edge_count": edge_count,
    }
