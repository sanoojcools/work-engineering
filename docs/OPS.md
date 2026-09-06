# Ops runbook — when bootstrap or guest Hours dies

Slices 6.1 (alerting) and 6.2 (backup). Not a general SRE handbook — just
where to look on *this* stack, written from an actual incident found in
6.1's own Render logs (see below) and an actual Render API read for 6.2,
not a hypothetical either time.

Related: [STATUS.md](STATUS.md) (Slice 6.1's own honesty ledger entry, and
the Render-notification click path) · [BUILD_PROGRAM.md](BUILD_PROGRAM.md)
Track 6.

---

## 1. Something 500'd. Where do I look?

**Render dashboard → `work-engineering-api` → Logs tab.**

What actually works there today, checked against this service's real logs,
not assumed:

| Filter | Works on this service? | Use for |
|---|---|---|
| `level:error` | Yes | Every unhandled exception — uvicorn logs one `ERROR Exception in ASGI application` line per crash, followed by the full Python traceback as separate log lines with the same timestamp |
| Free-text search, e.g. `"Internal Server Error"` or `unhandled_exception` | Yes (wildcards/regex supported) | Finding a specific request or the new structured line below |
| `statusCode:500` | **No** — returns nothing even when a real 500 just happened | This service has no `request`-type logs (`list_log_label_values type` returns only `app`/`build`) — Render isn't parsing a structured status code out of Docker stdout for this service. Don't rely on it. |

Since this slice, every unhandled exception (any 500 that isn't a
deliberate `HTTPException` a router raised on purpose — those keep their own
4xx/409/etc. status and never hit this path) also logs one single-line,
greppable entry:

```
unhandled_exception request_id=<hex> method=<GET|POST|...> path=/api/... exc_type=<ExceptionClassName>
```

Search Logs for `unhandled_exception` first — it's one line instead of a
90-line traceback, and it carries the request id from the matching
`X-Request-Id` response header, so if a founder reports "it broke" and can
paste that header value, you can find the *exact* request directly instead
of guessing from timestamps. The full traceback (exception type, message,
file/line) is still logged right below it via uvicorn's own default
handling — the structured line is a fast index into that, not a
replacement for it.

The client itself only ever sees `{"detail": "Internal Server Error",
"request_id": "<hex>"}` — never a stack trace, never the exception's own
message (deliberate: see `backend/app/main.py`'s `_install_error_handling`
docstring for why the message itself is never logged or returned either —
this app's error paths run through SQLAlchemy and consent/PII services, and
an exception message can carry bound query parameters).

## 2. `/api/health` says what, exactly?

`GET /api/health` → `{"status": "ok"|"db_unavailable", "version", "db_ready"}`,
with HTTP 200 when ready and **503 when not** (fixed in this slice — it used
to always return 200, which made a failed startup invisible to Render's own
health-check-driven deploy gating). `db_ready` is set once at startup
(`main.py`'s `lifespan`) by connecting to Postgres and running
`bootstrap_tenants` — it is **not** re-checked per request, so a database
that goes down *after* a clean boot won't flip this back to unhealthy. A
503 here means the *last boot* failed; it does not mean "right now."

If `/api/demo/bootstrap` or `/api/demo/prepare` 500 while `/api/health`
still reports 200, the database is fine — the failure is inside that
specific request, not the process. Go straight to Logs (§1), not here.

## 3. A worked example: what a real 500 looked like here

Render's own logs (`list_logs` against `work-engineering-api`,
2026-09-05T17:19:07Z–17:19:59Z) show a real production incident — cold
boot from idle, then three back-to-back calls to `POST
/api/demo/bootstrap?new_keys=true`, all failing with the same 500:

```
psycopg2.errors.InsufficientPrivilege: new row violates row-level security
policy for table "work_units"
```

**This is not a new, still-open bug** — cross-referencing Render's deploy
history caught that before this went to print. The instance that hit it
was running commit `f219980` (deployed 16:12 UTC that day, before the
`app.system_bypass` GUC fix existed); commit `30bbab2` fixed it and was
live by 18:03 UTC the same day. `HONESTY.md` already carries the full
root-cause writeup — this is that same incident, not a new one, and no
recurrence has been logged since. It's kept here only as a concrete,
real worked example of what this slice's log-search + structured-line
additions are for: finding exactly this shape of failure fast.

**The one real, still-open thing this incident exposes**: nothing in CI
would catch this exact bug reappearing. `test_demo_bootstrap.py` runs on
SQLite, which enforces no RLS at all; CI's own Postgres role (`wep`) is a
genuine superuser, matching docker-compose, unlike Render's managed
database's role — the one condition that actually triggered the original
bug (see `HONESTY.md`'s entry: `rolsuper=false, rolbypassrls=false` on
Render, reproduced locally by stripping the superuser bit to confirm the
fix, but that reproduction was a one-off manual step, not a standing
test). A similar RLS-policy gap on a newly-added tenant table would only
surface live, the same way this one did. Not closed by this slice — 6.1
is alerting, not test infrastructure — named here for whoever picks up
Track 6.2 or general test hardening next.

## 4. Postgres

`work-engineering-db` (Render Postgres, free plan) is the only datastore.

## 4a. Backup policy — Slice 6.2, checked for real via the Render API, not guessed

**Read directly from Render's API this slice** (`get_postgres` on
`dpg-dadu7sn40ujc73d0or9g-a`, the same id `list_postgres_instances` names
for `work-engineering-db`):

```
plan: free
highAvailabilityEnabled: false
expiresAt: 2026-10-05T09:42:10Z
```

Two separate facts, not one:

1. **No backup/point-in-time-recovery field exists anywhere in this
   instance's API representation.** It isn't a switch left off — the free
   plan's resource has no backup configuration to read at all. The
   `create_postgres` tool's own parameter schema (mirrors Render's API)
   confirms the same shape: backup behavior is a function of `plan`, not a
   separate flag this project — or this agent — can toggle.
2. **The free database itself expires 2026-10-05, roughly 29 days from
   today (2026-09-06) — a harder deadline than "unbacked-up."** This is
   Render's standard free-Postgres lifecycle (a 30-day instance, not a
   permanent free tier), not a bug or a misconfiguration found this slice.
   Past that date, without action, the primary copy is gone — there would
   be nothing left to have backed up.

**Not independently re-confirmed this slice**: Render's own docs on exactly
what a paid plan's backup/PITR retention looks like. `render.com` is
egress-blocked in this session, the same way `onrender.com` already is
(confirmed again this slice — see STATUS.md's Ship-ready row for the
established precedent). So the next sentence is stated as this product's
general understanding of Render's model, not something read live this
slice: paid Postgres plans get Render-managed daily backups (retention
scales with plan) and, on some tiers, point-in-time recovery; free has
neither, and also does not persist past 30 days at all.

**STOP-GATE, per docs/BUILD_PROGRAM.md's own rule (agent may document, may
not buy a plan):** enabling backup here means upgrading `work-engineering-db`
off the free plan. This slice did not do that and did not invent a
workaround (no cron-job `pg_dump`-to-somewhere was wired in as a substitute
"backup product" — docs/BUILD_PROGRAM.md Track 6.2 asks for the policy to be
*documented*, and where a paid plan is the only real path, to STOP-GATE it,
not to paper over it with a smaller thing and call it done). See
`docs/STATUS.md`'s "paid Render backup" line — founder decides, and the
30-day expiry means this is worth deciding before 2026-10-05, not at
leisure.

## 5. What 6.1 deliberately did not build

No Sentry/PagerDuty/APM, no synthetic uptime prober, no push notification
for a 500 on one endpoint while the process and `/api/health` both stay
green (the §3 incident is exactly that shape — nothing pages anyone for it
today; a human has to open Logs). Closing that gap for real means either a
paid Render plan/third-party DSN (a STOP-GATE this slice didn't need to
open, since nothing here required one) or a from-scratch uptime prober
(a monitoring product this slice was told not to invent). What *is* pushed
today, free, natively: Render's own deploy-failed email — see
`STATUS.md` for the exact setting and what it does and doesn't cover.

## 6. What 6.2 deliberately did not build

No plan upgrade, no `pg_dump`-to-S3 cron job standing in as a home-grown
"backup," no restore drill (there is nothing paid-tier to restore from
yet). §4a names the STOP-GATE precisely — this section exists so the two
"did not build" lists don't get merged into one and lose which slice each
refusal belongs to.
