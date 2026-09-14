# scripts/

Local CLIs. **Not** HTTP APIs. There is no bulk ingest endpoint.

```bash
python scripts/bulk_ingest.py --init-template
python scripts/bulk_ingest.py --file HR_Work_Units_Bulk.xlsx --api http://localhost:8000
```
