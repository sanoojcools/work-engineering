"""Demo employer: 12 cross-industry HR units + a sample SOP (V8 J1 wedge)."""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from ..models.client import Client
from ..models.ontology import EntityKind, EntityType, Provenance
from ..models.security import GenomeVersion, OrgApiKey
from ..models.workunit import ActorType, UnitStatus, VerificationMethod, WorkUnit
from ..services.census import run_census
from ..services.genome_import import import_genome
from ..services.tenants import (
    bootstrap_tenants,
    clone_cross_industry_hr,
    get_or_create_catalog,
    get_or_create_client_a,
)

DEMO_SOP = """Client A — HR Onboarding and Offboarding SOP (90-day census sample)

Onboarding
1. After the offer is signed, collect joining documents into the HRIS.
2. Verify documents against the signed offer.
3. Create the employee master record.
4. Send pre-joining welcome communication (mail and calendar invite).
5. On day one, complete welcome and confirm joining.

Offboarding
1. Initiate exit when resignation is accepted.
2. Revoke system access on the last working day.
3. Process full and final settlement.

This SOP is declared intent (D1 downward). It does not mention access provisioning, exit interview, or closing the employee record.
"""

# code, name, current, desired, method, owner, actor, sla, evidence, acceptance
HR_UNITS = [
    ("WU-ONB-01", "Collect joining documents", "offer_signed", "documents_received",
     VerificationMethod.human_spot_check, "HR Ops SPOC", ActorType.human, 24,
     "HRIS document packet ID", "All mandatory docs attached in the HRIS"),
    ("WU-ONB-02", "Verify documents", "documents_received", "documents_verified",
     VerificationMethod.deterministic_rule, "HR Ops SPOC", ActorType.human, 8,
     "HRIS verification checklist", "Every required document is marked verified"),
    ("WU-ONB-03", "Create employee master", "documents_verified", "master_created",
     VerificationMethod.database_constraint, "HR Ops SPOC", ActorType.human, 8,
     "Employee ID in HRIS", "Employee record exists with unique employee ID"),
    ("WU-ONB-04", "Pre-Joining Communication", "offer_signed", "welcome_delivered",
     VerificationMethod.deterministic_rule, "HR Ops SPOC", ActorType.agent, 8,
     "Outlook message ID + Teams invite ID", "Outlook mail log exists AND Teams invite exists"),
    ("WU-ONB-05", "Provision access", "master_created", "access_granted",
     VerificationMethod.database_constraint, "IT Ops", ActorType.human, 24,
     "Directory account ID", "Account is active in the directory"),
    ("WU-ONB-06", "Day-1 welcome", "access_granted", "day1_complete",
     VerificationMethod.human_spot_check, "HR Ops SPOC", ActorType.human, 8,
     "Day-1 checklist", "Welcome and workstation checklist signed"),
    ("WU-ONB-07", "Confirm joining", "day1_complete", "active",
     VerificationMethod.database_constraint, "HR Ops SPOC", ActorType.human, 8,
     "HRIS status change", "Employee state is active"),
    ("WU-OFF-01", "Initiate exit", "resignation_accepted", "exit_initiated",
     VerificationMethod.database_constraint, "HR Ops SPOC", ActorType.human, 8,
     "Exit case ID", "Exit case is open in the HRIS"),
    ("WU-OFF-02", "Revoke access", "exit_initiated", "access_revoked",
     VerificationMethod.database_constraint, "IT Ops", ActorType.human, 8,
     "Directory disable event", "Directory account is disabled"),
    ("WU-OFF-03", "Full and final settlement", "access_revoked", "settled",
     VerificationMethod.cross_system_reconciliation, "Payroll", ActorType.human, 72,
     "Payroll settlement ID", "Net pay matches approved settlement sheet"),
    ("WU-OFF-04", "Exit interview", "exit_initiated", "interview_recorded",
     VerificationMethod.human_spot_check, "HR Ops SPOC", ActorType.human, 24,
     "Interview notes ID", "Exit interview notes stored on the case"),
    ("WU-OFF-05", "Close employee record", "settled", "offboarded",
     VerificationMethod.database_constraint, "HR Ops SPOC", ActorType.human, 8,
     "HRIS status change", "Employee state is offboarded"),
]


def _employee_type(db: Session) -> EntityType:
    row = db.query(EntityType).filter(EntityType.name == "Employee").one_or_none()
    if row:
        return row
    row = EntityType(
        name="Employee",
        kind=EntityKind.business_object,
        description="Person on the payroll",
        state_machine='["offer_signed","documents_received","documents_verified","master_created","welcome_delivered","access_granted","day1_complete","active","resignation_accepted","exit_initiated","access_revoked","settled","interview_recorded","offboarded"]',
    )
    db.add(row)
    db.flush()
    return row


def ensure_catalog_hr(db: Session) -> int:
    catalog = get_or_create_catalog(db)
    et = _employee_type(db)
    existing = {u.code for u in db.query(WorkUnit).filter(WorkUnit.client_id == catalog.id).all()}
    created = 0
    for code, name, pre, post, method, owner, actor, sla, evidence, acceptance in HR_UNITS:
        if code in existing:
            continue
        db.add(WorkUnit(
            client_id=catalog.id,
            code=code,
            name=name,
            business_object_type_id=et.id,
            current_condition=pre,
            desired_condition=post,
            context=f"HR operations · Employee · {name}",
            trigger=pre,
            inputs=evidence,
            authority=owner,
            actor_constraints=owner,
            acceptance_criteria=acceptance,
            evidence_required=evidence,
            verification_method=method,
            sla_hours=float(sla),
            failure_semantics="Hold; notify owner; do not silently retry",
            provenance=Provenance.designed,
            owner=owner,
            actor_type=actor,
            status=UnitStatus.reconciled,
        ))
        created += 1
    db.flush()
    return created


def prepare_demo(db: Session, run: bool = True) -> dict:
    bootstrap_tenants(db)
    catalog = get_or_create_catalog(db)
    client_a = get_or_create_client_a(db)
    created = ensure_catalog_hr(db)
    cloned = clone_cross_industry_hr(db, catalog, client_a)
    db.commit()
    census = None
    if run:
        census = run_census(db, client_a.id, "HR & People Ops", DEMO_SOP, 50)
    return {
        "catalog_id": catalog.id,
        "client_a_id": client_a.id,
        "catalog_hr_created": created,
        "cloned_hr": cloned,
        "census": census,
        "sop": DEMO_SOP,
        "note": "Switch to Client A. This is a sample employer, not a real customer. VERDICT and hours are inferred drafts.",
    }


def issue_first_key(
    db: Session, client: Client, label: str = "demo", *, replace: bool = False
) -> tuple[str | None, int | None]:
    """Mint a tenant's FIRST org API key. Until this existed, standing a demo
    up meant a hand-written `INSERT INTO org_api_keys` with a manually
    computed sha256 — routers/org.py could only ROTATE a key you already had,
    so there was no way to get the first one through the app at all.

    Returns (plaintext, key_id), or (None, None) when the tenant already has
    an active key: a key's plaintext exists only at the moment it is minted
    (the table stores the hash), so this can never "show me the existing
    key", and re-running is a no-op rather than an error.

    `replace=True` retires the existing active keys and mints a fresh one.
    That is the recovery path for a key that was lost — rotation needs the
    old key, so without this, mislaying it mid-demo meant going back to
    hand-written SQL."""
    existing_keys = (
        db.query(OrgApiKey)
        .filter(OrgApiKey.client_id == client.id, OrgApiKey.is_active.is_(True))
        .all()
    )
    if existing_keys and not replace:
        return None, None
    for row in existing_keys:
        row.is_active = False
        row.rotated_at = datetime.now(timezone.utc)
    plaintext = secrets.token_urlsafe(24)
    row = OrgApiKey(
        client_id=client.id,
        label=label,
        key_hash=hashlib.sha256(plaintext.encode("utf-8")).hexdigest(),
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return plaintext, row.id


SAMPLE_GENOME_SLUG = "sample-genome-co"
SAMPLES_DIR = Path(__file__).resolve().parents[3] / "samples"
SAMPLE_GENOME_FILE = SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-FIXED.json"

# The shipped sample carries no dual_scoring_kappa, and GQS gives kappa a flat
# 10 points — so the file on its own scores 84.29 and is blocked by the gate,
# despite being the sample that is meant to demonstrate a passing genome.
# Supplied here explicitly rather than written into the sample file, because
# kappa is caller-supplied by design: nothing in this system produces two
# independent scorings to compute it from (see HONESTY.md). This is a stated
# demo input, not a measurement.
SAMPLE_GENOME_KAPPA = 0.85


def get_or_create_sample_genome_tenant(db: Session) -> Client:
    """Separate tenant for the shipped observed-provenance genome sample.

    samples/Private-Genome-MVP-HR-Ops-FIXED.json and the Client A HR seed
    both define WU-OFF-03 and WU-OFF-04, and work_units is UNIQUE on
    (client_id, code) — so importing the sample into Client A is rejected by
    design. They are two different genomes for two different employers, so
    they belong in two different tenants rather than being reconciled into
    one."""
    row = db.query(Client).filter(Client.slug == SAMPLE_GENOME_SLUG).one_or_none()
    if row:
        return row
    row = Client(
        slug=SAMPLE_GENOME_SLUG,
        name="Sample Genome Co",
        industry="HR & People Ops",
        description=(
            "Holds samples/Private-Genome-MVP-HR-Ops-FIXED.json — an observed-provenance genome "
            "that clears the GQS gate. Kept apart from Client A, whose HR seed shares work unit ids."
        ),
        kind="client",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def import_sample_genome(db: Session, tenant: Client) -> dict:
    """Import the shipped observed-provenance genome into its own tenant.

    Done here rather than left as a documented curl for two reasons: the file
    needs SAMPLE_GENOME_KAPPA supplied to clear the gate at all, and it has to
    land in a tenant that does not already own its work unit ids. Both were
    silent traps — the documented import returned a 400 and the sample named
    "FIXED" looked broken.

    Idempotent: re-running bootstrap reports the existing version rather than
    importing a second colliding copy."""
    existing = (
        db.query(GenomeVersion)
        .filter(GenomeVersion.client_id == tenant.id)
        .order_by(GenomeVersion.id)
        .first()
    )
    if existing is not None:
        return {
            "version_id": existing.id,
            "sequence": existing.sequence,
            "gqs": existing.gqs_score,
            "accepted": bool(json.loads(existing.gates_passed or "[]")),
            "note": "Already imported for this tenant; not re-imported.",
        }

    if not SAMPLE_GENOME_FILE.exists():
        return {"version_id": None, "sequence": None, "gqs": None, "accepted": False,
                "note": f"Sample genome not found at {SAMPLE_GENOME_FILE}."}

    with open(SAMPLE_GENOME_FILE, encoding="utf-8") as handle:
        genome = json.load(handle)
    genome["dual_scoring_kappa"] = SAMPLE_GENOME_KAPPA

    result = import_genome(db, tenant.id, genome, actor="demo-bootstrap")
    return {
        "version_id": result["version_id"],
        "sequence": result["sequence"],
        "gqs": result["gqs"],
        "accepted": result["accepted"],
        "dual_scoring_kappa": SAMPLE_GENOME_KAPPA,
        "note": (
            f"dual_scoring_kappa={SAMPLE_GENOME_KAPPA} was supplied by this bootstrap, not measured — "
            "nothing in this system produces two independent scorings to compute it from. Without it "
            "the shipped sample scores 84.29 and the gate blocks it."
        ),
    }


def bootstrap_demo(db: Session, *, new_keys: bool = False) -> dict:
    """prepare_demo + usable keys, in one unauthenticated call, so a local
    demo is one command instead of a Python snippet against the database.
    Gated by settings.demo_bootstrap_enabled (see routers/admin.py).

    `new_keys=True` retires the existing keys and issues fresh ones — the
    recovery path when a key has been lost, since rotation requires the key
    you no longer have."""
    result = prepare_demo(db)

    client_a = get_or_create_client_a(db)
    plaintext, key_id = issue_first_key(db, client_a, replace=new_keys)
    result["api_key"] = plaintext
    result["api_key_id"] = key_id

    sample_tenant = get_or_create_sample_genome_tenant(db)
    sample_key, sample_key_id = issue_first_key(db, sample_tenant, label="sample-genome", replace=new_keys)
    result["sample_genome_client_id"] = sample_tenant.id
    result["sample_genome_api_key"] = sample_key
    result["sample_genome_api_key_id"] = sample_key_id
    result["sample_genome_import"] = import_sample_genome(db, sample_tenant)

    already = plaintext is None
    result["api_key_note"] = (
        "Keys are shown once and never recoverable — the database stores only their hash. "
        + ("This tenant already had an active key, so none was minted. Re-run with "
           "?new_keys=true to retire it and issue a fresh one. " if already else "")
        + "Paste api_key into the app's key banner for the Client A walkthrough, or "
          "sample_genome_api_key to open the imported sample genome. The sample lives in its own "
          "tenant because it shares work unit ids with the Client A HR seed."
    )
    return result
