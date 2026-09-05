#!/bin/sh
# Runs the migration then serves. Baked into the image (not a render.yaml
# dockerCommand string) so there's no dependency on how any platform's YAML
# parser tokenizes shell quoting. Idempotent: alembic upgrade head is a
# no-op if already at head, so running it on every boot (every deploy, and
# every free-tier wake-from-sleep) is harmless.
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
