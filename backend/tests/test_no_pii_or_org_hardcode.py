"""Slice 0 (playbook D.1.5): pytest-based guard, shipped instead of a
pre-commit hook per playbook Section M ("the guard matters more than the
hook mechanism"). Scans application source (not fixtures/samples, which
legitimately contain scrubbed PII-shaped strings for testing) for:

- the sample employer name treated as an org-hardcoding violation
- a real-looking email not on the known-fake allow-list
- a 4x4-digit UAN-shaped pattern that isn't the XXXX-XXXX-XXXX-XXXX placeholder

Does not scan alembic/versions (binary-adjacent migration noise) and does
not fail on the bare word "UAN".
"""
import re
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"

ORG_HARDCODE_NAMES = ("Trianz",)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
FAKE_EMAIL_ALLOWLIST = ("example.com", "invalid.", "person_a@", "person_b@")

UAN_SHAPE_RE = re.compile(r"\b\d{4}-\d{4}-\d{4}-\d{4}\b")
UAN_PLACEHOLDER = "XXXX-XXXX-XXXX-XXXX"


def _python_files():
    return [p for p in APP_ROOT.rglob("*.py") if "__pycache__" not in p.parts]


def test_no_hardcoded_sample_org_name_in_application_code():
    hits = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for name in ORG_HARDCODE_NAMES:
            if name in text:
                hits.append(f"{path}: contains {name!r}")
    assert not hits, "Org-name hardcoding found in application code:\n" + "\n".join(hits)


def test_no_real_looking_email_in_application_code():
    hits = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in EMAIL_RE.finditer(text):
            email = match.group(0)
            if not any(fake in email for fake in FAKE_EMAIL_ALLOWLIST):
                hits.append(f"{path}: {email}")
    assert not hits, "Real-looking email found in application code:\n" + "\n".join(hits)


def test_no_real_looking_uan_in_application_code():
    hits = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in UAN_SHAPE_RE.finditer(text):
            if match.group(0) != UAN_PLACEHOLDER:
                hits.append(f"{path}: {match.group(0)}")
    assert not hits, "Real-looking UAN-shaped value found in application code:\n" + "\n".join(hits)
