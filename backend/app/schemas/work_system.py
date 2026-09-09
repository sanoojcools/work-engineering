from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class IntentOut(BaseModel):
    """One of the three intents attached to a WorkSystem row: D -- INTENT-LITE's
    Function and Work System intents, plus V10-9's Strategy intent (period
    focus). `label` is the function's outcome sentence for Function intent,
    the journey's purpose sentence for Work System intent, or the period's
    one-line focus for Strategy intent -- none of the three share a field
    name, so the router names it generically here. `measure` is only ever
    populated for Function intent ("not stated" when the T&M sheets name
    none); the other two always send null. `status` is derived from
    confirmed_at, never stored independently. `owner` reads "--" (dashed)
    rather than blank when nobody is named yet -- see intent_debt below,
    which counts exactly the intents this renders dashed."""

    label: str
    owner: str
    measure: str | None = None
    status: str
    confirmed_by: str
    confirmed_at: datetime | None


class WorkSystemOut(BaseModel):
    id: int
    code: str
    name: str
    entry: str
    exit: str
    owner: str
    outcome: str
    status: str
    ratified_by: str
    ratified_at: datetime | None
    created_at: datetime
    function_intent: IntentOut
    work_system_intent: IntentOut
    strategy_intent: IntentOut
    # V10-9: count of the three intents above (function / work system /
    # strategy) that are unowned right now -- "goal" here means one
    # intent's own label, "unowned" means its owner field is blank. A
    # simple integer, not a dashboard -- see services/work_system.py.
    intent_debt: int


class WorkSystemEnsureIn(BaseModel):
    """Get-or-create by (tenant, code). A tenant that already has this
    journey's row gets that row back unchanged -- this never overwrites a
    ratified row's fields (or a confirmed intent's fields) with a
    guest-computed default on a later call. Intent fields are optional so
    older callers (and this schema's own defaults) still work; a first
    ensure call drafts them from the SAME sheet/sitting-sourced constants
    entry/exit/owner/outcome already come from (frontend/src/lib/intent.ts)."""
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    entry: str = ""
    exit: str = ""
    owner: str = ""
    outcome: str = ""
    function_intent_outcome: str = ""
    function_intent_owner: str = ""
    function_intent_measure: str = ""
    work_system_intent_purpose: str = ""
    work_system_intent_owner: str = ""
    strategy_intent_focus: str = ""
    strategy_intent_owner: str = ""


class WorkSystemRatifyIn(BaseModel):
    ratified_by: str = Field(min_length=1, max_length=120)


class WorkSystemIntentConfirmIn(BaseModel):
    """'Confirm as owner' -- name + server timestamp is the entire write.
    Same shape as WorkSystemRatifyIn on purpose: one required name, no other
    field a caller could use to also change the intent's own text."""
    confirmed_by: str = Field(min_length=1, max_length=120)
