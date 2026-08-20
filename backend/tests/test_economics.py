from app.services.economics import monthly_hours


def test_four_disciplines_reduce_claimed_hours():
    # 400 executions × 6 minutes = 40h do; 3 min verify = 20h; 5% × 20 min = 6.67h; 2h maint
    result = monthly_hours(
        executions_per_month=400,
        minutes_per_execution=6,
        verification_minutes=3,
        failure_rate=0.05,
        exception_minutes=20,
        maintenance_hours=2,
        attribution_confidence=0.8,
    )
    assert result["do_hours"] == 40.0
    assert result["verify_hours"] == 20.0
    assert round(result["exception_hours"], 2) == 6.67
    assert result["maintenance_hours"] == 2.0
    assert result["attributed_hours"] < result["gross_hours"]
    assert result["fte"] == round(result["attributed_hours"] / 160.0, 4)


def test_cost_per_verified_unit_none_when_no_completions():
    result = monthly_hours(
        executions_per_month=0,
        minutes_per_execution=10,
        verification_minutes=5,
        failure_rate=0,
        exception_minutes=0,
        maintenance_hours=0,
        attribution_confidence=1,
        verified_completions=0,
    )
    assert result["cost_per_verified_unit_hours"] is None
