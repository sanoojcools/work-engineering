"""Function Pack validation — slice 1.4 (HR Function Pack v0).

Checks one thing: does a pack's question_bank.yaml carry at least one
interview question mapped to each of the 18 Work Unit attributes
(REQUIRED_18, same list GQS scores against)? Nothing else — no ontology,
regulatory stub, or parser-hint file is part of this slice.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.services.gqs import REQUIRED_18


def load_question_bank(pack_dir: Path) -> dict[str, Any]:
    path = pack_dir / "question_bank.yaml"
    if not path.exists():
        raise FileNotFoundError(f"{path} not found — a pack must ship question_bank.yaml")
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: expected a YAML mapping at the top level")
    return data


def attribute_coverage(question_bank: dict[str, Any]) -> dict[str, int]:
    """Count of questions mapped to each of the 18 attributes."""
    coverage = {attr: 0 for attr in REQUIRED_18}
    for questions in question_bank.get("tracks", {}).values():
        for question in questions:
            for attr in question.get("attributes", []):
                if attr in coverage:
                    coverage[attr] += 1
    return coverage


def unknown_attributes(question_bank: dict[str, Any]) -> set[str]:
    """Attributes referenced in the pack that aren't one of the 18 — almost
    always a typo, so validate() treats this as a failure too."""
    known = set(REQUIRED_18)
    seen: set[str] = set()
    for questions in question_bank.get("tracks", {}).values():
        for question in questions:
            seen.update(question.get("attributes", []))
    return seen - known


def validate_pack(pack_dir: Path) -> dict[str, Any]:
    question_bank = load_question_bank(pack_dir)
    coverage = attribute_coverage(question_bank)
    missing = sorted(attr for attr, count in coverage.items() if count == 0)
    unknown = sorted(unknown_attributes(question_bank))
    return {
        "pack": question_bank.get("pack"),
        "coverage": coverage,
        "missing": missing,
        "unknown_attributes": unknown,
        "ok": not missing and not unknown,
    }
