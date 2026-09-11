"""V10-14 (docs/contracts/v10-14-handoff.md): pure invariant checks over
the handoff bundle's own inputs -- work units, field pointers, field
ratifications, and VERDICT scenario levels. Each `assert_*` function raises
plain `ValueError` (not HTTPException: nothing here is a request handler)
on the first violation it finds, and returns None on success. CI runs
backend/tests/test_v10_14_invariants.py as its own named step so a red X on
one of these is readable without reading pytest -q's full scroll.

No second engine: `assert_scenario_monotonic` checks the numbers
services/verdict.py::scenario_levels already computed, it does not
recompute them.
"""
from __future__ import annotations

from collections.abc import Iterable

from ..models.field_ratification import FieldRatification, FieldRatificationStatus
from ..models.pointers import FieldPointer, PointerStatus
from ..models.workunit import WorkUnit

# The three fields V10_BUILD.md names as binding -- same set as
# services/pointers.py::BINDING_FIELDS (not imported from there to keep
# this module import-light and DB-session-free; the two are asserted equal
# in tests).
BINDING_FIELDS = frozenset({"authority", "acceptance_criteria", "actor_constraints"})


def assert_binding_fields_quoted(wu: WorkUnit, pointers: Iterable[FieldPointer]) -> None:
    """Lint 1: a non-blank binding field on a work unit used as ready-to-
    hand-off must carry a field pointer with a non-empty quote that is a
    literal substring of the field's own value, at status `declared` --
    services/pointers.py::upsert_field_pointer only ever persists a
    binding-field pointer that way (declared + resolver-verified quote), so
    `status == declared` here stands in for the persisted
    `quote_verified=True` this table does not carry as its own column. A
    blank field needs no pointer at all."""
    by_field = {p.field_name: p for p in pointers}
    for field in BINDING_FIELDS:
        value = (getattr(wu, field, "") or "")
        if not value.strip():
            continue
        pointer = by_field.get(field)
        quoted = (
            pointer is not None
            and pointer.status == PointerStatus.declared
            and bool(pointer.quote.strip())
            and pointer.quote in value
        )
        if not quoted:
            raise ValueError(
                f"{wu.code}.{field} is non-blank but has no verified `declared` pointer whose quote is a "
                "literal substring of the field"
            )


def assert_composed_not_unratified(pointers: Iterable[FieldPointer], ratifications: Iterable[FieldRatification]) -> None:
    """Lint 2: a pointer standing at `composed` (a person's judgement, not a
    quote) may not flow into a handoff bundle unless the same field has a
    confirmed field_ratification -- the one write (V10-8,
    docs/contracts/v10-8-field-ratify.md) that turns a draft into a
    confirmed fact."""
    confirmed_fields = {
        r.field_name.value for r in ratifications if r.status == FieldRatificationStatus.confirmed
    }
    for pointer in pointers:
        if pointer.status == PointerStatus.composed and pointer.field_name not in confirmed_fields:
            raise ValueError(
                f"pointer on field {pointer.field_name!r} is `composed` but has no confirmed field_ratification "
                "for that field"
            )


def assert_scenario_monotonic(careful: int, as_calculated: int, ambitious: int, cap: int) -> None:
    """Lint 3: careful <= as_calculated <= ambitious <= cap. Dual-employment
    does not participate here -- it is a stop, not a level (contract,
    verbatim)."""
    if not (careful <= as_calculated <= ambitious <= cap):
        raise ValueError(
            f"scenario levels not monotonic: careful={careful} as_calculated={as_calculated} "
            f"ambitious={ambitious} cap={cap} -- expected careful <= as_calculated <= ambitious <= cap"
        )
