"""Slice 0 (playbook D.1.4): locks Bug 3 — the top-level GenomeImportRequest
container must stay extra="ignore" so benign Scout export metadata doesn't
422 the whole payload, while WorkUnitImport (one Work Unit) stays
extra="forbid" so a stray top-level `variant` field is still rejected.

If someone "fixes" the container back to extra="forbid" thinking it's
stricter/safer, this test fails and explains why that's a regression, not
an improvement.
"""
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.genome_import import GenomeImportRequest
from app.services.gqs import compute_gqs

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"


def _load_fixed() -> dict:
    with open(SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-FIXED.json", encoding="utf-8") as f:
        return json.load(f)


def test_benign_top_level_metadata_does_not_422():
    """source_files, automation_index, and a stray org field must not raise
    at the Pydantic layer — GQS is what scores/flags them, not extra=forbid."""
    genome = _load_fixed()
    genome["source_files"] = ["USHR_Agent_Ready.xlsx"]
    genome["automation_index"] = {"L5_fully_automated": 5}
    genome["org"] = "Client A"  # a violation for GQS to catch, not for Pydantic to reject

    parsed = GenomeImportRequest.model_validate(genome)
    assert len(parsed.work_units) == len(genome["work_units"])


def test_fixed_genome_with_benign_metadata_still_clears_gqs_gate():
    """The same benign top-level keys must not prevent a genuinely clean
    genome from passing GQS >= 90 — the container's permissiveness must not
    accidentally hide real Work Unit violations either."""
    genome = _load_fixed()
    genome["source_files"] = ["USHR_Agent_Ready.xlsx"]
    genome["automation_index"] = {"L5_fully_automated": 5}
    genome["dual_scoring_kappa"] = 0.85

    result = compute_gqs(genome, kappa=genome["dual_scoring_kappa"])
    assert result["passes_gate"], f"expected GQS>=90, got {result['gqs']}: {result['violations']}"

    parsed = GenomeImportRequest.model_validate(genome)
    assert len(parsed.work_units) == len(genome["work_units"])


def test_work_unit_level_variant_field_still_rejected():
    """extra=forbid on WorkUnitImport itself must still catch the original
    P0 violation: a top-level `variant` field on one Work Unit (not nested
    under context.variants[]) is invalid, not benign metadata."""
    genome = _load_fixed()
    genome["work_units"][0]["variant"] = "some legacy top-level variant string"

    with pytest.raises(ValidationError) as exc_info:
        GenomeImportRequest.model_validate(genome)

    errors = exc_info.value.errors()
    assert any("variant" in ".".join(str(p) for p in e["loc"]) for e in errors)
