"""V10-14 (docs/contracts/v10-14-handoff.md): pure invariant checks. No
database needed -- these construct plain (unpersisted) ORM instances, since
app.services.invariants only ever reads their attributes."""
from __future__ import annotations

import pytest

from app.models.field_ratification import FieldRatification, FieldRatificationField, FieldRatificationStatus
from app.models.pointers import FieldPointer, PointerStatus
from app.models.workunit import WorkUnit
from app.services import invariants
from app.services import verdict as verdict_svc


# --- Lint 1: binding fields need quotes ---

def _unit(**overrides) -> WorkUnit:
    defaults = {"code": "WU-TEST-INV", "name": "Test unit", "current_condition": "a", "desired_condition": "b"}
    defaults.update(overrides)
    return WorkUnit(**defaults)


def test_binding_field_with_no_pointer_raises():
    wu = _unit(authority="Head of HR Ops may release")
    with pytest.raises(ValueError, match="authority"):
        invariants.assert_binding_fields_quoted(wu, [])


def test_binding_field_with_verified_declared_pointer_passes():
    wu = _unit(authority="Head of HR Ops may release")
    pointer = FieldPointer(
        work_unit_id=1, field_name="authority", requested_status=PointerStatus.declared,
        status=PointerStatus.declared, quote="Head of HR Ops",
    )
    invariants.assert_binding_fields_quoted(wu, [pointer])  # no raise


def test_blank_binding_field_needs_no_pointer():
    wu = _unit()
    invariants.assert_binding_fields_quoted(wu, [])  # no raise


def test_binding_field_pointer_with_non_declared_status_still_fails():
    wu = _unit(actor_constraints="Only TA Head may sign")
    pointer = FieldPointer(
        work_unit_id=1, field_name="actor_constraints", requested_status=PointerStatus.composed,
        status=PointerStatus.composed, quote="Only TA Head may sign",
    )
    with pytest.raises(ValueError, match="actor_constraints"):
        invariants.assert_binding_fields_quoted(wu, [pointer])


def test_binding_field_pointer_whose_quote_is_not_a_substring_fails():
    wu = _unit(acceptance_criteria="All documents present")
    pointer = FieldPointer(
        work_unit_id=1, field_name="acceptance_criteria", requested_status=PointerStatus.declared,
        status=PointerStatus.declared, quote="something else entirely",
    )
    with pytest.raises(ValueError, match="acceptance_criteria"):
        invariants.assert_binding_fields_quoted(wu, [pointer])


# --- Lint 2: composed cannot flow unratified ---

def test_composed_pointer_without_confirmation_raises():
    pointer = FieldPointer(
        work_unit_id=1, field_name="authority", requested_status=PointerStatus.composed,
        status=PointerStatus.composed, quote="",
    )
    with pytest.raises(ValueError, match="composed"):
        invariants.assert_composed_not_unratified([pointer], [])


def test_composed_pointer_after_confirm_passes():
    pointer = FieldPointer(
        work_unit_id=1, field_name="authority", requested_status=PointerStatus.composed,
        status=PointerStatus.composed, quote="",
    )
    ratification = FieldRatification(
        client_id=1, work_unit_id=1, field_name=FieldRatificationField.authority,
        sitting_quote="q", drafted_value="v", status=FieldRatificationStatus.confirmed,
    )
    invariants.assert_composed_not_unratified([pointer], [ratification])  # no raise


def test_composed_pointer_with_only_drafted_ratification_still_raises():
    pointer = FieldPointer(
        work_unit_id=1, field_name="authority", requested_status=PointerStatus.composed,
        status=PointerStatus.composed, quote="",
    )
    ratification = FieldRatification(
        client_id=1, work_unit_id=1, field_name=FieldRatificationField.authority,
        sitting_quote="q", drafted_value="v", status=FieldRatificationStatus.drafted,
    )
    with pytest.raises(ValueError, match="composed"):
        invariants.assert_composed_not_unratified([pointer], [ratification])


def test_non_composed_pointer_needs_no_ratification():
    pointer = FieldPointer(
        work_unit_id=1, field_name="authority", requested_status=PointerStatus.declared,
        status=PointerStatus.declared, quote="q",
    )
    invariants.assert_composed_not_unratified([pointer], [])  # no raise


# --- Lint 3: careful <= as_calculated <= ambitious <= cap ---

def test_scenario_monotonic_passes():
    invariants.assert_scenario_monotonic(1, 2, 2, 2)


def test_scenario_out_of_order_raises():
    with pytest.raises(ValueError, match="monotonic"):
        invariants.assert_scenario_monotonic(3, 2, 5, 6)


def test_scenario_levels_from_verdict_are_monotonic_for_a_real_score():
    """No second engine: run the real scores through
    services/verdict.py::scenario_levels and assert the result satisfies
    Lint 3, rather than hand-building numbers."""
    scores = {
        "verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3,
        "impact_scope": 4, "compliance": 5, "tacitness": 3,
    }
    derived = verdict_svc.derive_autonomy(scores)
    levels = verdict_svc.scenario_levels(
        scores, recommended_level=derived["recommended_level"], applied_gates=derived["applied_gates"],
    )
    invariants.assert_scenario_monotonic(levels["careful"], levels["as_calculated"], levels["ambitious"], levels["cap"])


def test_scenario_levels_capped_by_a_hard_gate_still_monotonic():
    # compliance=1 fires gate1_regulatory -> cap=2 for all three scenarios.
    scores = {
        "verifiability": 5, "evidence": 5, "reversibility": 5, "determinism": 5,
        "impact_scope": 5, "compliance": 1, "tacitness": 5,
    }
    derived = verdict_svc.derive_autonomy(scores)
    assert derived["applied_gates"] == ["gate1_regulatory"]
    levels = verdict_svc.scenario_levels(
        scores, recommended_level=derived["recommended_level"], applied_gates=derived["applied_gates"],
    )
    assert levels["cap"] == 2
    # careful replays base_level against the MIN of the seven scores, which
    # here is compliance=1 itself (< 2.0 -> L1), capped no further by the
    # gate (min(1, 2) == 1). ambitious replays against the max (5, which
    # hits the L6 special case) and IS capped down to 2.
    assert levels["careful"] == 1 and levels["ambitious"] == 2
    invariants.assert_scenario_monotonic(levels["careful"], levels["as_calculated"], levels["ambitious"], levels["cap"])


def test_binding_fields_constant_matches_pointers_service():
    from app.services.pointers import BINDING_FIELDS

    assert invariants.BINDING_FIELDS == BINDING_FIELDS
