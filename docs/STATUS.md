# Product state — 25 August 2026

Status of the Work Engineering specification layer after the census-scoped, demo-ready slice.

Concept: [Work-Engineering-V8.md](Work-Engineering-V8.md). Code mapping: [../ARCHITECTURE.md](../ARCHITECTURE.md). HTTP: [API.md](API.md). How to run: [../README.md](../README.md).

---

## In one sentence

You can switch to **Client A**, see **12 HR Work Units**, run a **draft census** against a sample SOP, and walk Graph, VERDICT, Economics, Projections, and Discovery as **the same company**. Scores and hours are **inferred** until a human confirms. This is colleague-demo ready. It is not a sold customer product and not production-hosted.

This repo remains the **specification layer** (V8 C4). It does not log people in, connect to ERP, or execute work.

---

## Readiness

| Bar | Now | Meaning |
|---|---|---|
| **Colleague demo** | **Yes** | Overview → Prepare Client A HR demo → keep Client A selected → Work Units → Discovery → Projections → VERDICT. Say *draft / inferred*. |
| **End-to-end (wedge)** | **Yes for J1** | One company × one function × inventory, graph, VERDICT, economics, gap, pack on screen. |
| **Customer-ready** | **Not yet** | Units are a sample employer. Hours are guessed until confirmed. No login. Not their SOP unless they paste one. |
| **Ship-ready (hosted product)** | **Not yet** | No auth, schema is `create_all`, local demo DB. Ready to **demo the spec**, not to sell multi-tenant SaaS. |

V8 alignment for this slice: **J1** (one function, one record, 90-day output), **C3** (five projections of one record), **D1/D3** (declared SOP vs inventory = conformance gap), **H2** (VERDICT + gates), **H5** (honest case = smaller attributed hours), **C4** (spec, not execution), **E7** (provenance: inferred vs confirmed).

---

## What a colleague should see (10 minutes)

1. Open the UI (frontend that proxies to this API). Company switcher top-left.
2. Overview → **Prepare Client A HR demo**. Switcher lands on Client A.
3. Overview one-liner: 12 units, L4+ drafts, attributed hours, FTE after attribution. Banner: inferred until confirmed.
4. Work Units: HR stack, sample SOP prefilled, **Run census** / **Download HR pack**.
5. Discovery: same SOP; gap scan is this company. Sample SOP omits access provisioning, exit interview, close record → unimplemented gaps.
6. Projections: five C3 views for Client A. Download pack JSON.
7. VERDICT: origin column `inferred`. **Save and confirm** protects that unit from a census re-run.
8. Economics / Work Graph: same twelve units only. Catalog is the test lab — switch back to see mixed samples.

Do not treat **0.79 FTE** (or any inferred total) as measured labour. That is H5: drafts until confirmed.

---

## What shipped in this slice

- Company switcher on **every census page**, not only Work Units.
- `GET` lists for work units, projections, VERDICT, economics, graph edges, discovery intent/candidates/gaps take `?client_id=`.
- **Inferred vs confirmed** on VERDICT and cost. Census writes inferred; human PUT confirms; re-run keeps confirmed scores.
- **Prepare Client A HR demo**: 12 ONB/OFF units on Catalog, clone to Client A, run census with sample SOP.
- Overview walkthrough, census-first progress bar, tour rewritten for the wedge.
- Company banner on pages so you cannot mix Catalog into a Client A story by accident.

**Still not built (on purpose):** login, ERP connectors, live executor, six fake companies-by-function, renaming the five projections.

---

## Demo data (when you click Prepare)

| Item | Value |
|---|---|
| Catalog | 12 HR units created if missing |
| Client A | Clone of those 12 (`WU-ONB-01`…`07`, `WU-OFF-01`…`05`) |
| Function | HR & People Ops |
| Sample SOP | Onboarding 1–5 + offboarding 1–3 (declared intent) |
| Typical census | 12 VERDICT drafts, 12 cost profiles, ~6 gaps, sequence + shared-object edges |
| Economics | Inferred minutes × 50 executions/month, attribution 0.6 |

---

## API (new or changed)

| Method | Path | Role |
|---|---|---|
| POST | `/api/demo/prepare` | Catalog HR + Client A clone + inferred census |
| GET | `/api/clients/` | Catalog and Client A |
| GET | `/api/work-units/?client_id=` | Inventory for one company |
| POST | `/api/census/run` | Function census; skips confirmed VERDICT |
| GET | `/api/census/pack/{client_id}` | J1 pack for one function |
| GET | `/api/projections/*?client_id=` | C3 views scoped |
| PUT | `/api/verdict/{id}` | Human save → `origin=confirmed` |
| PUT | `/api/economics/{id}` | Human save → `origin=confirmed` |

---

## Reference files

Paths from the repo root.

### Concept

| File | Role |
|---|---|
| [docs/Work-Engineering-V8.md](Work-Engineering-V8.md) | J1, C3, D3, H2, H5, C4 |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | How V8 maps onto this repo |
| [docs/API.md](API.md) | HTTP surface (may lag; see table above) |

### Company and census

| File | Role |
|---|---|
| [backend/app/models/client.py](../backend/app/models/client.py) | Company |
| [backend/app/models/workunit.py](../backend/app/models/workunit.py) | `client_id`; unique `(client_id, code)` |
| [backend/app/models/verdict.py](../backend/app/models/verdict.py) | `origin` inferred \| confirmed |
| [backend/app/models/economics.py](../backend/app/models/economics.py) | `origin` inferred \| confirmed |
| [backend/app/services/tenants.py](../backend/app/services/tenants.py) | Catalog, Client A, clone rule, `?client_id` query helper |
| [backend/app/services/census.py](../backend/app/services/census.py) | Draft VERDICT/cost; skip confirmed |
| [backend/app/services/demo.py](../backend/app/services/demo.py) | 12 HR units + sample SOP |
| [backend/app/routers/admin.py](../backend/app/routers/admin.py) | `POST /api/demo/prepare` |
| [backend/app/routers/census.py](../backend/app/routers/census.py) | Run + pack |
| [backend/app/routers/clients.py](../backend/app/routers/clients.py) | Companies |
| [backend/app/routers/projections.py](../backend/app/routers/projections.py) | C3 scoped by `client_id` |

### UI (demo walk)

| File | Role |
|---|---|
| [frontend/src/company.tsx](../frontend/src/company.tsx) | Selected company |
| [frontend/src/layout/AppShell.tsx](../frontend/src/layout/AppShell.tsx) | Switcher |
| [frontend/src/components/CompanyBanner.tsx](../frontend/src/components/CompanyBanner.tsx) | “Viewing Client A / Catalog” |
| [frontend/src/components/ProgressTracker.tsx](../frontend/src/components/ProgressTracker.tsx) | Census-first steps |
| [frontend/src/lib/tourSteps.ts](../frontend/src/lib/tourSteps.ts) | Colleague tour |
| [frontend/src/lib/demoSop.ts](../frontend/src/lib/demoSop.ts) | Sample SOP text |
| [frontend/src/lib/withClient.ts](../frontend/src/lib/withClient.ts) | `?client_id=` on fetches |
| [frontend/src/pages/Overview.tsx](../frontend/src/pages/Overview.tsx) | Walkthrough + prepare + one-liner |
| [frontend/src/pages/WorkUnits.tsx](../frontend/src/pages/WorkUnits.tsx) | Inventory + census button |
| [frontend/src/pages/Discovery.tsx](../frontend/src/pages/Discovery.tsx) | SOP / gaps for this company |
| [frontend/src/pages/Projections.tsx](../frontend/src/pages/Projections.tsx) | Five views + pack download |
| [frontend/src/pages/Verdict.tsx](../frontend/src/pages/Verdict.tsx) | Confirm scores |
| [frontend/src/pages/Economics.tsx](../frontend/src/pages/Economics.tsx) | Confirm cost |
| [frontend/src/pages/WorkGraph.tsx](../frontend/src/pages/WorkGraph.tsx) | Edges for this company |

### Tests

| File | Role |
|---|---|
| [backend/tests/test_api.py](../backend/tests/test_api.py) | Company boundary, census, demo prepare, confirmed VERDICT survives re-run |

---

## What to say in the room

- Catalog is the **test lab**. Client A is **one employer**.
- Census is **HR**, not the whole firm.
- VERDICT and FTE are **drafts from the contract** until someone confirms.
- The **gap vs SOP** is the artefact V8 says anyone pays for, before any agent is deployed.
- This product **specifies** work. Execution systems consume the Spec API.

## What not to promise

- That 12 L4+ means you should automate tomorrow.
- That attributed FTE is payroll.
- That a customer can log in and see only their pack (login is the slice after someone outside you must see Client A).
- Connectors or a live executor.
