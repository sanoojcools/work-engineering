from app.services.verdict import apply_hard_gates, derive_autonomy


HIGH = dict(
    verifiability=5,
    evidence=5,
    reversibility=5,
    determinism=5,
    impact_scope=5,
    compliance=5,
    tacitness=5,
)


def test_high_scores_reach_l6():
    result = derive_autonomy(HIGH, evidence_path_exists=True)
    assert result["recommended_level"] == 6
    assert result["applied_gates"] == []
    assert result["allocation"] == "automate"


def test_gate1_regulatory_caps_at_l2():
    scores = {**HIGH, "compliance": 1}
    result = derive_autonomy(scores, requires_licensed_human=False, evidence_path_exists=True)
    assert result["recommended_level"] == 2
    assert "gate1_regulatory" in result["applied_gates"]


def test_gate1_licensed_human_caps_at_l2():
    result = derive_autonomy(HIGH, requires_licensed_human=True, evidence_path_exists=True)
    assert result["recommended_level"] == 2
    assert "gate1_regulatory" in result["applied_gates"]


def test_gate2_reversibility_caps_at_l3():
    scores = {**HIGH, "reversibility": 1}
    result = derive_autonomy(scores, evidence_path_exists=True)
    assert result["recommended_level"] == 3
    assert "gate2_reversibility" in result["applied_gates"]


def test_gate3_impact_caps_at_l3():
    scores = {**HIGH, "impact_scope": 1}
    result = derive_autonomy(scores, evidence_path_exists=True)
    assert result["recommended_level"] == 3
    assert "gate3_impact" in result["applied_gates"]


def test_gate4_no_evidence_path_caps_at_l2():
    result = derive_autonomy(HIGH, evidence_path_exists=False)
    assert result["recommended_level"] == 2
    assert "gate4_evidence" in result["applied_gates"]


def test_gate4_evidence_score_one_caps_at_l2():
    scores = {**HIGH, "evidence": 1}
    result = derive_autonomy(scores, evidence_path_exists=True)
    assert result["recommended_level"] == 2
    assert "gate4_evidence" in result["applied_gates"]


def test_gates_stack_to_tightest_cap():
    level, gates = apply_hard_gates(
        6,
        {**HIGH, "compliance": 1, "reversibility": 1, "impact_scope": 1, "evidence": 1},
        requires_licensed_human=True,
        evidence_path_exists=False,
    )
    assert level == 2
    assert set(gates) >= {"gate1_regulatory", "gate2_reversibility", "gate3_impact", "gate4_evidence"}
