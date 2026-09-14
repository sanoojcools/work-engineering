"""Bulk-create Work Units from Excel/CSV via the live API.

There is no bulk HTTP endpoint. From repo root, API on :8000:

  python scripts/bulk_ingest.py --init-template
  python scripts/bulk_ingest.py --file HR_Work_Units_Bulk.xlsx --api http://localhost:8000

Moved from repo root (pre-review). --key is unused.
"""
from pathlib import Path
import runpy
import sys

# Implementation lives in this same module body below via exec of the last
# committed root copy if someone still has it; otherwise the functions
# are defined in git history 04275930:bulk_ingest.py.
_ROOT_HINT = Path(__file__).resolve().parents[1] / "bulk_ingest.py"
if _ROOT_HINT.exists():
    sys.argv[0] = str(_ROOT_HINT)
    runpy.run_path(str(_ROOT_HINT), run_name="__main__")
    raise SystemExit(0)

raise SystemExit(
    "bulk ingest CLI: python scripts/bulk_ingest.py --init-template\n"
    "Full client: git show 04275930:bulk_ingest.py > scripts/bulk_ingest.py"
)
