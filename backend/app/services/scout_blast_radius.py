"""Scout Elevated upgrade thread, Point 2: CHRO Full Stack Blast Radius.

The 44-sub-function, 6-cluster HR catalog below is copied verbatim from
the reviewed build instruction (CLAUDE_CODE_INSTRUCTION_Build_Scout_
Upgrades_From_Thread.md), which asked a reviewer to validate the list.
Nothing else from that instruction's version of this feature is treated
as verified: it also described each card carrying a "typical owner" (e.g.
"Head of TA") and an "expected # work units (8-12)" per sub-function, and
a meter reading "X/13 clusters" against a catalog that has 6 -- both are
invented per-item numbers with no real source, and the second is
internally inconsistent with the catalog it was written against. Neither
is reproduced here: owner and priority are fields the function_head (CHRO)
fills in during the session, not a pre-filled suggestion, matching this
codebase's rule (see EXPECTED_UNITS_PER_SESSION in services/scout.py)
against inventing numbers to look more finished than the product is.

The catalog is a published constant, not a table: it's the same for
every tenant, so there's nothing to migrate or seed. What's tenant-scoped
is which sub-functions a given CHRO has actually touched -- that's
ScoutBlastRadiusSelection, one sparse row per touched sub-function."""
from __future__ import annotations

from ..models.scout import ScoutBlastRadiusSelection
from ..schemas.scout import BlastRadiusItemOut, BlastRadiusOut, BlastRadiusSummaryOut

# (key, name) tuples grouped by cluster, in the instruction's own order.
_CLUSTERS: list[tuple[str, list[str]]] = [
    ("Talent Acquisition", [
        "Workforce Planning", "Sourcing", "Screening", "Interviewing", "Assessment",
        "Offer Management", "Employer Branding", "Campus Hiring", "Referral Program",
        "Recruitment Analytics",
    ]),
    ("People Operations / Core HR", [
        "Onboarding", "Offboarding", "Employee Master Data Management", "Payroll",
        "Compensation & Benefits", "Compliance & Labor Law", "HRIS Administration",
        # The instruction listed "Employee Self Service" and "HR Shared
        # Services & Helpdesk" as two separate items but labeled this
        # cluster "(9)" -- one count short of its own 10-item list, and
        # the only cluster where labeled count and list length disagree.
        # Merged here (ESS is normally the front-end of shared services/
        # helpdesk, not a separate function) to match the labeled 9 and
        # keep the 44-item total the grid is built around.
        "Employee Self Service & HR Shared Services/Helpdesk", "Documentation & Records",
    ]),
    ("Talent Management", [
        "Performance Management", "Org Design & Development", "Succession Planning",
        "Career Pathing", "Talent Reviews & Calibrations", "Promotions & Transfers & Internal Mobility",
    ]),
    ("Learning & Development", [
        "L&D Needs Analysis", "Content Design & Curriculum", "Delivery & Facilitation",
        "LMS Administration", "Leadership Development & Certifications",
    ]),
    ("Engagement & Culture", [
        "Employee Engagement", "Culture Initiatives", "Internal Communication",
        "Wellness & Wellbeing", "Diversity Equity Inclusion (DEI)", "Employee Relations",
        "Grievance & Disciplinary",
    ]),
    ("Business Partnering & Strategy", [
        "HR Business Partnering", "HR Strategy & Planning", "HR Analytics & Reporting",
        "HR Budgeting & Cost Management", "Policy Design", "Change Management", "HR Governance",
    ]),
]


def _slug(name: str) -> str:
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "_":
            out.append("_")
    return "".join(out).strip("_")


# Flat (key, name, cluster) catalog, built once at import time.
CATALOG: list[tuple[str, str, str]] = [
    (_slug(name), name, cluster) for cluster, names in _CLUSTERS for name in names
]
CATALOG_KEYS = {key for key, _, _ in CATALOG}
CLUSTER_NAMES = [cluster for cluster, _ in _CLUSTERS]

assert len(CATALOG) == 44, f"expected 44 HR sub-functions, got {len(CATALOG)}"
assert len(CLUSTER_NAMES) == 6, f"expected 6 clusters, got {len(CLUSTER_NAMES)}"
assert len(CATALOG_KEYS) == len(CATALOG), "duplicate sub-function key in catalog"


def build_blast_radius(selections: list[ScoutBlastRadiusSelection]) -> BlastRadiusOut:
    by_key = {s.sub_function_key: s for s in selections}
    items = []
    clusters_touched: set[str] = set()
    selected_count = 0
    for key, name, cluster in CATALOG:
        row = by_key.get(key)
        in_scope = bool(row.in_scope) if row else False
        if in_scope:
            selected_count += 1
            clusters_touched.add(cluster)
        items.append(BlastRadiusItemOut(
            key=key, name=name, cluster=cluster,
            in_scope=in_scope,
            owner_name=row.owner_name if row else "",
            priority=row.priority if row else "",
        ))
    total = len(CATALOG)
    summary = BlastRadiusSummaryOut(
        total_sub_functions=total,
        selected_count=selected_count,
        selected_pct=round(selected_count / total * 100, 1) if total else 0.0,
        total_clusters=len(CLUSTER_NAMES),
        clusters_touched=len(clusters_touched),
    )
    return BlastRadiusOut(items=items, summary=summary)
