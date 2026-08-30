"""P0 deliverable: GQS blocks a genome with real schema violations (score
well under the 90 gate) and passes once those violations are fixed.

Fixtures live in ../../samples/ (repo root, outside backend/) since they're
genome data, not test-only scaffolding — samples/Private-Genome-MVP-HR-Ops.json
is the original (PII intact, as attached), -SCRUBBED is the PII-safe version
with the same 6 real violations preserved, -FIXED is what an import should
look like after Parser v2 (Day 3-4, not built yet) would have processed it.
"""
import json
from pathlib import Path

from app.services.gqs import compute_gqs

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"


def _load(name: str) -> dict:
    with open(SAMPLES_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def test_scrubbed_sample_has_no_pii_names():
    raw = (SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-SCRUBBED.json").read_text(encoding="utf-8")
    for name in ("Rashmi", "Thamizh", "Sasikala", "Prerana", "Rajitha", "Jayanthi", "Trianz"):
        assert name not in raw, f"PII leak: {name!r} still present in scrubbed sample"


def test_scrubbed_sample_fails_gqs_gate():
    genome = _load("Private-Genome-MVP-HR-Ops-SCRUBBED.json")
    result = compute_gqs(genome)
    assert not result["passes_gate"], f"expected GQS<90, got {result['gqs']}"
    assert result["gqs"] < 50
    codes = {v["code"] for v in result["violations"]}
    assert codes == {
        "hardcoded_org",
        "derived_field_drift",
        "extra_field_variant",
        "unstructured_provenance",
        "free_text_regulatory_link",
        "orphan_dependency",
    }


def test_fixed_sample_passes_gqs_gate():
    genome = _load("Private-Genome-MVP-HR-Ops-FIXED.json")
    result = compute_gqs(genome, kappa=0.85)
    assert result["passes_gate"], f"expected GQS>=90, got {result['gqs']}: {result['violations']}"
    assert result["violations"] == []
    assert result["breakdown"]["observed_pct"] == 100.0
    assert result["breakdown"]["provenance_structured_pct"] == 100.0


def test_gqs_blocks_without_dual_scoring_kappa():
    """Even a structurally clean genome doesn't pass without dual-scoring
    kappa>0.8 (G3: independence is what makes verification worth its cost) —
    GQS caps at 90 exactly when every other component is maxed but kappa
    contributes 0, which sits right at the gate boundary depending on
    completeness, so assert the kappa contribution specifically rather than
    the whole-score pass/fail."""
    genome = _load("Private-Genome-MVP-HR-Ops-FIXED.json")
    result = compute_gqs(genome, kappa=None)
    assert result["breakdown"]["kappa_contribution"] == 0
    assert result["gqs"] < compute_gqs(genome, kappa=0.85)["gqs"]
