"""Local Excel/CSV ingest. There is no bulk HTTP endpoint.

The full client was at repo root. Restore and run from repo root:

    git show 04275930:bulk_ingest.py > scripts/bulk_ingest.py
    python scripts/bulk_ingest.py --init-template
    python scripts/bulk_ingest.py --file HR_Work_Units_Bulk.xlsx --api http://localhost:8000

--key is unused (create is not Spec API).
"""
raise SystemExit(__doc__)
