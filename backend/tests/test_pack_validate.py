"""Slice 1.4: HR Function Pack v0 question bank covers all 18 attributes,
and `scout pack validate` fails on a pack missing one.
"""
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

from app.services.gqs import REQUIRED_18
from app.services.pack_validate import load_question_bank, validate_pack

REPO_ROOT = Path(__file__).resolve().parents[2]
HR_PACK_DIR = REPO_ROOT / "packs" / "hr"


def test_hr_pack_covers_all_18_attributes():
    result = validate_pack(HR_PACK_DIR)
    assert result["ok"], f"missing: {result['missing']}, unknown: {result['unknown_attributes']}"
    assert result["missing"] == []
    assert result["unknown_attributes"] == []
    assert set(result["coverage"]) == set(REQUIRED_18)
    assert all(count >= 1 for count in result["coverage"].values())


def test_hr_pack_questions_are_not_invented():
    """Source = the existing hand-written DiscoveryPartner.tsx bank — same
    ids, text, and why for every question, just an added `attributes` map."""
    bank = load_question_bank(HR_PACK_DIR)
    frontend_bank = (
        REPO_ROOT / "frontend" / "src" / "components" / "scout" / "DiscoveryPartner.tsx"
    ).read_text(encoding="utf-8")

    for track_questions in bank["tracks"].values():
        for q in track_questions:
            assert q["id"] in frontend_bank
            assert q["text"] in frontend_bank
            assert q["why"] in frontend_bank


def test_validate_fails_when_an_attribute_has_zero_questions(tmp_path):
    pack_dir = tmp_path / "broken_pack"
    pack_dir.mkdir()
    bank = load_question_bank(HR_PACK_DIR)
    # Drop "provenance" from every question that carries it.
    for track_questions in bank["tracks"].values():
        for q in track_questions:
            q["attributes"] = [a for a in q["attributes"] if a != "provenance"]
    (pack_dir / "question_bank.yaml").write_text(yaml.safe_dump(bank), encoding="utf-8")

    result = validate_pack(pack_dir)
    assert not result["ok"]
    assert result["missing"] == ["provenance"]


def test_validate_fails_on_unknown_attribute(tmp_path):
    pack_dir = tmp_path / "typo_pack"
    pack_dir.mkdir()
    bank = load_question_bank(HR_PACK_DIR)
    bank["tracks"]["function_head"][0]["attributes"].append("buisness_object")
    (pack_dir / "question_bank.yaml").write_text(yaml.safe_dump(bank), encoding="utf-8")

    result = validate_pack(pack_dir)
    assert not result["ok"]
    assert "buisness_object" in result["unknown_attributes"]


def test_validate_raises_when_pack_has_no_question_bank(tmp_path):
    empty_dir = tmp_path / "empty_pack"
    empty_dir.mkdir()
    with pytest.raises(FileNotFoundError):
        validate_pack(empty_dir)


def test_cli_passes_on_hr_pack():
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scout"), "pack", "validate", "packs/hr"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "OK: all 18 attributes have at least one question." in proc.stdout


def test_cli_fails_on_missing_attr_pack(tmp_path):
    pack_dir = tmp_path / "broken_pack"
    pack_dir.mkdir()
    bank = load_question_bank(HR_PACK_DIR)
    for track_questions in bank["tracks"].values():
        for q in track_questions:
            q["attributes"] = [a for a in q["attributes"] if a != "authority"]
    (pack_dir / "question_bank.yaml").write_text(yaml.safe_dump(bank), encoding="utf-8")

    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scout"), "pack", "validate", str(pack_dir)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "authority" in proc.stdout + proc.stderr


def test_cli_fails_on_pack_with_no_question_bank(tmp_path):
    empty_dir = tmp_path / "empty_pack"
    empty_dir.mkdir()
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scout"), "pack", "validate", str(empty_dir)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
