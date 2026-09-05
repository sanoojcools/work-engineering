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
from ..models.security import (
    AuditLog,
    ConsentReceipt,
    ConsentStatus,
    GenomeVersion,
    GenomeVersionType,
    UploadedFile,
    WorkUnitProvenanceDetail,
    WorkUnitRegulatoryLink,
)
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


def _validate_work_unit_codes(db: Session, client_id: int, parsed: GenomeImportRequest) -> list[dict]:
    """work_units has a UNIQUE (client_id, code) constraint, and nothing
    checked it before the insert loop — so importing a genome whose codes
    already exist for the tenant blew up mid-loop on a raw psycopg2
    UniqueViolation, surfacing as a 500 with no violation list and leaving
    the rows written before the collision behind. That is reachable in an
    ordinary demo: samples/Private-Genome-MVP-HR-Ops-FIXED.json and the
    Client A HR seed (services/demo.py) both define WU-OFF-03.

    Same pre-pass shape as _validate_file_provenance: catch it before any
    row is written and report it as a structured violation, so a re-import
    is a clean 400 the caller can act on rather than a 500.

    Also catches duplicates WITHIN one payload, which would otherwise hit
    the same constraint on the second occurrence."""
    violations: list[dict] = []
    incoming = [_clip(wu_in.id, 40) for wu_in in parsed.work_units]

    seen: set[str] = set()
    for code in incoming:
        if code in seen:
            violations.append({
                "code": "duplicate_work_unit_id",
                "detail": f"{code}: appears more than once in this payload; work unit ids must be unique",
            })
        seen.add(code)

    existing = {
        row[0]
        for row in db.query(WorkUnit.code)
        .filter(WorkUnit.client_id == client_id, WorkUnit.code.in_(sorted(seen)))
        .all()
    }
    for code in sorted(seen & existing):
        violations.append({
            "code": "work_unit_id_already_exists",
            "detail": (
                f"{code}: this tenant already has a work unit with this id. Import a genome whose "
                f"ids are unique for the tenant, or use a different tenant."
            ),
        })
    return violations


def _detect_dependency_cycles(parsed: GenomeImportRequest) -> list[dict]:
    """Track 3 of the enterprise-readiness roadmap ("make the spec
    trustworthy") — see docs/Work-Engineering-V8.md Part K11: GQS's own
    completeness check validates that a dependency reference *exists*, not
    that the graph those references form is acyclic. A real cycle reached
    this exact codebase once (samples/Private-Genome-MVP-HR-Ops-FIXED.json
    used to declare WU-OFF-02B and WU-OFF-03 as each other's dependency —
    fixed by hand in that file, but nothing stopped the next genome from
    doing the same thing and passing).

    Same pre-pass shape as _validate_file_provenance / _validate_work_unit_codes:
    pure, in-memory, no DB write yet, runs over the same edges _write_genome
    will create below (dep_code -> wu_in.id, and only within this payload —
    a dependency naming a code outside this payload is silently skipped for
    edge-creation there too, so it's excluded here on the same terms rather
    than treated as part of the graph being checked).

    Standard three-color DFS: WHITE (unvisited), GRAY (on the current
    recursion stack), BLACK (fully explored). A GRAY node reached again is
    a back-edge — a cycle — and the recursion stack at that point *is* the
    cycle path, reported so a human can see exactly which units to fix
    rather than just "a cycle exists somewhere."
    """
    ids = {wu_in.id for wu_in in parsed.work_units}
    adjacency: dict[str, list[str]] = {wu_id: [] for wu_id in ids}
    for wu_in in parsed.work_units:
        for dep_code in wu_in.dependencies:
            if dep_code in ids:
                adjacency[dep_code].append(wu_in.id)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {wu_id: WHITE for wu_id in ids}
    violations: list[dict] = []
    seen_cycles: set[frozenset[str]] = set()

    def visit(node: str, stack: list[str]) -> None:
        color[node] = GRAY
        stack.append(node)
        for neighbor in adjacency[node]:
            if color[neighbor] == GRAY:
                cycle_start = stack.index(neighbor)
                cycle = stack[cycle_start:] + [neighbor]
                key = frozenset(cycle)
                if key not in seen_cycles:
                    seen_cycles.add(key)
                    violations.append({
                        "code": "circular_dependency",
                        "detail": (
                            f"{' -> '.join(cycle)}: these work units depend on each other in a "
                            f"cycle. A dependency chain must have a real starting point; break the "
                            f"cycle by removing the direction that doesn't match each unit's own "
                            f"current_condition/desired_condition/trigger."
                        ),
                    })
            elif color[neighbor] == WHITE:
                visit(neighbor, stack)
        stack.pop()
        color[node] = BLACK

    for wu_id in ids:
        if color[wu_id] == WHITE:
            visit(wu_id, [])

    return violations


def _validate_consent(db: Session, client_id: int, parsed: GenomeImportRequest) -> list[dict]:
    """Track 3 of the enterprise-readiness roadmap ("make the spec
    trustworthy"), second piece -- closes the gap Part K9 named as still
    open: "a session does not require one, and the genome-import pipeline
    does not yet read the one a session might cite." Scout-Reference.md's
    own rule: observed *from an interview* requires a consent receipt.

    Deliberately NOT wired into every import — only into import_genome's
    enforce_consent=True path, which today means exactly one caller:
    services/scout_genome.py's live Scout session -> genome handoff. The
    generic JSON-body import (POST /api/genome/import, enforce_consent
    stays False) also accepts a provenance.interview_id/consent_receipt_id
    pair, but that's free-text a caller can set to anything — including
    the shipped sample genome, whose fixture predates the real
    consent-receipt feature and carries decorative UUID-shaped values
    that were never meant to resolve against a real ConsentReceipt row.
    Blocking that fixture over data that was never real consent-tracking
    to begin with would be enforcing a rule against something the rule
    was never protecting. What this *is* protecting -- a live interview's
    output being written without anyone having actually consented to it
    -- is real only for the one path that can genuinely make that claim.

    Same pre-pass shape as the checks above: pure read (one query per
    distinct cited receipt id, not per unit), no write yet, blocks the
    whole batch rather than writing some units with consent and some
    without."""
    violations: list[dict] = []
    receipt_cache: dict[int, ConsentReceipt | None] = {}

    for wu_in in parsed.work_units:
        if not wu_in.provenance.interview_id:
            continue
        raw_id = wu_in.provenance.consent_receipt_id
        if not raw_id:
            violations.append({
                "code": "missing_consent",
                "detail": (
                    f"{wu_in.id}: provenance.interview_id is set (this unit came from an interview) "
                    f"but no provenance.consent_receipt_id was supplied. An interview requires a "
                    f"consent receipt before its output can be written -- see POST /api/consent/receipts."
                ),
            })
            continue
        try:
            receipt_id = int(raw_id)
        except (TypeError, ValueError):
            violations.append({
                "code": "invalid_consent",
                "detail": f"{wu_in.id}: provenance.consent_receipt_id {raw_id!r} is not a valid receipt id",
            })
            continue
        if receipt_id not in receipt_cache:
            receipt_cache[receipt_id] = (
                db.query(ConsentReceipt)
                .filter(ConsentReceipt.id == receipt_id, ConsentReceipt.client_id == client_id)
                .one_or_none()
            )
        receipt = receipt_cache[receipt_id]
        if receipt is None:
            violations.append({
                "code": "invalid_consent",
                "detail": f"{wu_in.id}: consent receipt {receipt_id} does not exist for this tenant",
            })
        elif receipt.status != ConsentStatus.active:
            violations.append({
                "code": "invalid_consent",
                "detail": f"{wu_in.id}: consent receipt {receipt_id} is {receipt.status.value}, not active",
            })

    return violations


def _log_audit(db: Session, client_id: int, actor: str, action: str, resource: str, resource_id: str, detail: str = "") -> None:
    db.add(AuditLog(client_id=client_id, actor=actor, action=action, resource=resource, resource_id=resource_id, detail=detail))


def _failure_result(gqs_result: dict, version: GenomeVersion, violations: list[dict]) -> dict:
    return {
        "accepted": False,
        "version_id": version.id,
        "sequence": version.sequence,
        "gqs": gqs_result["gqs"],
        "gate_threshold": GATE_PASS_THRESHOLD,
        "breakdown": gqs_result["breakdown"],
        "violations": violations,
        "work_unit_count": gqs_result["work_unit_count"],
    }


def _record_failed_attempt(
    db: Session, client_id: int, actor: str, gqs_result: dict, violations: list[dict],
    version_type: GenomeVersionType = GenomeVersionType.detailed,
) -> dict:
    """Re-record an import attempt after a rollback discarded its original
    GenomeVersion row. Used by the write-phase guard in import_genome: the
    rollback is what keeps a half-written genome out of the database, but
    the attempt still has to stay auditable, which is this module's whole
    reason for persisting blocked imports rather than dropping them."""
    sequence = db.query(GenomeVersion).filter(GenomeVersion.client_id == client_id).count() + 1
    version = GenomeVersion(
        client_id=client_id,
        version_type=version_type,
        sequence=sequence,
        gqs_score=gqs_result["gqs"],
        work_unit_count=gqs_result["work_unit_count"],
        gates_passed=json.dumps([]),
        gates_failed=json.dumps(violations),
    )
    db.add(version)
    db.flush()
    _log_audit(
        db, client_id, actor, "genome.import.failed", "genome_version", str(version.id),
        detail=json.dumps({"violations": violations}),
    )
    db.commit()
    return _failure_result(gqs_result, version, violations)


def import_genome(
    db: Session, client_id: int, raw_genome: dict, *, actor: str = "", enforce_consent: bool = False,
    version_type: GenomeVersionType = GenomeVersionType.detailed,
) -> dict:
    """version_type is a label, not a gate: GenomeVersionType.inferred /
    .detailed / .ratified describe how a version was produced (interview-only,
    SME+docs, manager-approved), but no predecessor is required or checked —
    see HONESTY.md. `ratified` as a state is tracked by GenomeVersion.ratified
    (a bool flipped in routers/genome.py), not by version_type=ratified, which
    nothing ever sets."""
    gqs_result = compute_gqs(raw_genome, kappa=raw_genome.get("dual_scoring_kappa"))

    sequence = db.query(GenomeVersion).filter(GenomeVersion.client_id == client_id).count() + 1
    version = GenomeVersion(
        client_id=client_id,
        version_type=version_type,
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

    code_violations = _validate_work_unit_codes(db, client_id, parsed)
    if code_violations:
        version.gates_failed = json.dumps(code_violations)
        db.commit()
        return _failure_result(gqs_result, version, code_violations)

    cycle_violations = _detect_dependency_cycles(parsed)
    if cycle_violations:
        version.gates_failed = json.dumps(cycle_violations)
        db.commit()
        return _failure_result(gqs_result, version, cycle_violations)

    consent_violations = _validate_consent(db, client_id, parsed) if enforce_consent else []
    if consent_violations:
        version.gates_failed = json.dumps(consent_violations)
        db.commit()
        return _failure_result(gqs_result, version, consent_violations)

    # Everything from here writes rows. Anything unexpected that escapes must
    # roll the whole batch back: before this guard existed, a mid-loop failure
    # (a UniqueViolation on work_units.code, say) surfaced as a bare 500 AND
    # left the work units written before the collision in the database,
    # attached to a version row that still claimed the full count — which then
    # collided with every retry, so one bad import poisoned the tenant.
    try:
        return _write_genome(db, client_id, actor, gqs_result, parsed, version)
    except Exception as exc:  # noqa: BLE001 — deliberately broad: see rollback below
        db.rollback()
        return _record_failed_attempt(db, client_id, actor, gqs_result, [{
            "code": "import_write_failed",
            "detail": (
                f"The genome passed validation but could not be written; nothing was saved. "
                f"{type(exc).__name__}: {exc}"
            ),
        }], version_type=version_type)


def _write_genome(
    db: Session,
    client_id: int,
    actor: str,
    gqs_result: dict,
    parsed: GenomeImportRequest,
    version: GenomeVersion,
) -> dict:
    """The mutating half of import_genome, split out so its caller can wrap
    it in one rollback boundary. Unchanged behaviour — only the enclosing
    error handling is new."""
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
            volume_per_month=wu_in.sla_timing.volume_per_month,
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
        # consent_receipt_id: when enforce_consent was on, _validate_consent
        # already proved this resolves to a real, active receipt. When it
        # was off (the generic JSON-body import), the value is free text a
        # caller can set to anything -- the shipped sample genome carries
        # decorative UUID-shaped values that predate the real consent
        # feature and were never meant to resolve to a real row -- so
        # resolve defensively here too rather than let a bad value crash
        # the insert (consent_receipt_id is a real foreign key).
        resolved_consent_pk = None
        if wu_in.provenance.consent_receipt_id:
            try:
                candidate_id = int(wu_in.provenance.consent_receipt_id)
            except (TypeError, ValueError):
                candidate_id = None
            if candidate_id is not None and db.query(ConsentReceipt.id).filter(
                ConsentReceipt.id == candidate_id, ConsentReceipt.client_id == client_id
            ).first():
                resolved_consent_pk = candidate_id
        db.add(WorkUnitProvenanceDetail(
            work_unit_id=wu.id,
            source_type=provenance,
            file_id=resolved_file_pk,
            row_ref=wu_in.provenance.row,
            col_ref=wu_in.provenance.col or "",
            hash_sha256=wu_in.provenance.hash_sha256 or "",
            source_timestamp=None,
            interview_ref=wu_in.provenance.interview_id or "",
            consent_receipt_id=resolved_consent_pk,
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
        # Callers render this to humans; version_id is a global key and reads
        # as an arbitrary number to anyone who did not import the row.
        "sequence": version.sequence,
        "gqs": gqs_result["gqs"],
        "gate_threshold": GATE_PASS_THRESHOLD,
        "breakdown": gqs_result["breakdown"],
        "violations": [],
        "work_unit_count": len(code_to_wu),
        "work_graph_edge_count": edge_count,
    }
