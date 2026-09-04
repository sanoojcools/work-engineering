"""Builds the payoff artifact: a fully-authored, 18-attribute Offer Desk
genome, all 11 real steps (names/content matching frontend/src/lib/
offerDeskData.ts), importable via POST /api/genome/import exactly like the
shipped sample genome. FABRICATED FOR TESTING -- see README.md.

Provenance is source_type=observed only where a file in 03-system-logs/
actually backs the claim (9 of 11 steps); steps 7 and 11 (welcome mail,
candidate drop-out) have no system-of-record backing in this batch and stay
declared, honestly, rather than padded to look complete.
"""
import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "offer-desk-inputs", "06-payoff-genome", "offer-desk-genome-import.json")
UPLOADED = os.path.join(ROOT, "offer-desk-inputs", "06-payoff-genome", "uploaded-files.json")

with open(UPLOADED) as f:
    _UPLOADS = json.load(f)


def observed(file_name, note, ts="2026-06-15T00:00:00+05:30"):
    up = _UPLOADS[file_name]
    return {
        "source_type": "observed",
        "file_id": up["file_id"],
        "hash_sha256": up["sha256"],
        "timestamp": ts,
        "notes": note,
    }


def declared(note):
    return {
        "source_type": "declared",
        "notes": note,
    }


# V,E,R,D,I,C,T (1-5 each) per step -- differentiated by how each step
# actually behaves: dual-employment (step 2) scores low reversibility/high
# compliance; welcome mail and drop-out (7, 11) score high tacitness since
# no system log backs them; deterministic tracker steps (4, 8) score high
# across the board.
VERDICT_SCORES = {
    1: {"V": 4, "E": 3, "R": 5, "D": 4, "I": 2, "C": 2, "T": 2},
    2: {"V": 3, "E": 4, "R": 3, "D": 2, "I": 4, "C": 5, "T": 3},
    3: {"V": 4, "E": 4, "R": 3, "D": 4, "I": 3, "C": 3, "T": 2},
    4: {"V": 5, "E": 4, "R": 5, "D": 5, "I": 2, "C": 1, "T": 1},
    5: {"V": 4, "E": 4, "R": 2, "D": 4, "I": 3, "C": 2, "T": 1},
    6: {"V": 4, "E": 3, "R": 4, "D": 4, "I": 2, "C": 1, "T": 1},
    7: {"V": 2, "E": 1, "R": 5, "D": 3, "I": 1, "C": 1, "T": 4},
    8: {"V": 5, "E": 4, "R": 5, "D": 5, "I": 1, "C": 1, "T": 1},
    9: {"V": 4, "E": 4, "R": 4, "D": 4, "I": 1, "C": 1, "T": 2},
    10: {"V": 4, "E": 4, "R": 3, "D": 4, "I": 3, "C": 3, "T": 2},
    11: {"V": 2, "E": 1, "R": 4, "D": 2, "I": 2, "C": 1, "T": 4},
}

STEPS = [
    dict(
        n=1, title="Recruiter sends offer request",
        business_object="Offer Request",
        current="Recruiter request received, unstructured",
        desired="Offer request logged with Application ID",
        trigger="Recruiter sends offer request email with Application ID, candidate name, hiring manager, DOJ, salary approval attachment",
        input=["Recruiter email", "Salary approval mail attachment", "Zwayam candidate profile link"],
        acceptance=["Application ID present", "DOJ present", "Salary approval attachment present"],
        evidence=["Zwayam candidate_profile_created event"],
        verification="human_spot_check",
        failure="If any required field missing from the recruiter's email: reply requesting the missing field before logging the request.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=None,
        prov=lambda: observed("zwayam-candidate-export.csv",
                               "candidate_profile_created event backs the logged request"),
    ),
    dict(
        n=2, title="Verify candidate documents",
        business_object="Candidate Document Pack",
        current="Documents unchecked",
        desired="Documents verified complete, or offer blocked with a named reason",
        trigger="Documents uploaded in Zwayam against the hire-type checklist",
        input=["Zwayam uploaded documents", "UAN service history", "Hire-type checklist"],
        acceptance=["All hire-type-required documents present", "UAN service history shows no overlapping employment",
                    "Employment and education dates cross-verified against resume"],
        evidence=["Zwayam document_verification_completed event", "UAN service history record"],
        verification="cross_system_reconciliation",
        failure="If documents missing: email recruiter, hold offer. If dual employment detected in UAN: do NOT release offer -- escalate Rashmi -> Recruiter -> Manager -> Rajesh/Narang for deviation approval. Appetite does not lift this stop.",
        rr=["RR-UAN-DUAL-EMPLOYMENT-001"],
        time_min=35,
        prov=lambda: observed("zwayam-candidate-export.csv",
                               "document_uploaded + document_verification_completed events; cross-checked against uan-service-history-sample.csv"),
    ),
    dict(
        n=3, title="Verify salary approval & calculate deviation",
        business_object="Salary Approval",
        current="Salary approval unverified against grid",
        desired="Salary approval verified within grid, or deviation approved by Vasu + Nagaraj",
        trigger="Documents verified complete",
        input=["Salary approval mail", "Salary grid reference", "Bonus/ESOP policy"],
        acceptance=["CTC and variable pay match grid for function/grade", "Platforms candidates carry zero variable pay",
                    "Deviation, if any, carries Vasu + Nagaraj approval"],
        evidence=["Zwayam salary_deviation_approval_triggered event where applicable", "Salary grid reference file"],
        verification="deterministic_rule",
        failure="If deviation detected and unapproved: hold offer pending 2-level approval. If Platforms candidate's mail lists variable pay: flag to recruiter as a data error, do not silently correct.",
        rr=["RR-HR-POLICY-SALARY-GRID"],
        time_min=7.5,
        prov=lambda: observed("zwayam-candidate-export.csv",
                               "salary_deviation_approval_triggered events, cross-checked against 02-policy/salary-grid-and-deviation-policy.xlsx"),
    ),
    dict(
        n=4, title="Update Master Joining Sheet (+ PR sheet)",
        business_object="Master Joining Sheet Record",
        current="Row absent",
        desired="Row populated across all required fields (contractor rows also get a PR sheet entry)",
        trigger="Salary approval verified",
        input=["Zwayam profile", "Salary approval mail", "Recruiter request email"],
        acceptance=["All ~30 MJS columns populated", "Contractor candidates also have a PR sheet row"],
        evidence=["Master Joining Sheet export", "PR sheet export"],
        verification="database_constraint",
        failure="If a required MJS field cannot be populated from upstream data: flag row incomplete, do not submit to payroll until resolved.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=7.5,
        prov=lambda: observed("master-joining-sheet.xlsx",
                               "This candidate's row in the real tracker export"),
    ),
    dict(
        n=5, title="Trigger offer letter (Zwayam -> Zoho)",
        business_object="Offer Letter",
        current="Not generated",
        desired="Generated with all applicable clauses and routed to Zoho for signing",
        trigger="Master Joining Sheet row complete",
        input=["Salary details", "Bonus/ESOP clauses", "Hire-type template"],
        acceptance=["Correct template for hire type", "All applicable clauses present (ESOP, deferred bonus, campus annexures)",
                    "Zoho signing workflow triggered, TA Head first"],
        evidence=["Zwayam offer_letter_trigger event", "Zoho signing log entry"],
        verification="cross_system_reconciliation",
        failure="If a clause is missing for an eligible candidate (e.g. ESOP for Grade 7+): hold generation, correct template, regenerate.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=7.5,
        prov=lambda: observed("zoho-signing-log.csv",
                               "offer_letter row: sent/signed timestamps, TA Head then candidate"),
    ),
    dict(
        n=6, title="Send onboarding acknowledgement",
        business_object="Onboarding Acknowledgement",
        current="Not sent",
        desired="Signed by candidate and location-specific SPOC",
        trigger="Offer letter fully signed",
        input=["Signed offer letter", "Location SPOC assignment"],
        acceptance=["Candidate signature present", "Location SPOC counter-signature present"],
        evidence=["Zoho signing log entry, onboarding_acknowledgement row"],
        verification="cross_system_reconciliation",
        failure="If candidate does not sign within the offer acceptance window (4 days future-dated, DOJ for immediate joiners): recruiter follows up.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=2.5,
        prov=lambda: observed("zoho-signing-log.csv",
                               "onboarding_acknowledgement row: candidate then location SPOC signature"),
    ),
    dict(
        n=7, title="Send welcome onboard mail",
        business_object="Welcome Communication",
        current="Not sent",
        desired="Sent with reporting date, slot, address/link",
        trigger="Onboarding acknowledgement signed",
        input=["DOJ", "Slot assignment", "Office address or virtual link"],
        acceptance=["Sent to candidate's personal email", "CC to location SPOC and recruiter", "Correct slot and address"],
        evidence=["Sent-mail confirmation -- no system-of-record log exists for this step in this batch"],
        verification="human_spot_check",
        failure="If sent to the wrong email or with the wrong slot: resend before DOJ, notify SPOC of the correction.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=2.5,
        prov=lambda: declared("No Zwayam/Zoho/email log backs this step in this synthetic batch -- honestly left declared, not padded."),
    ),
    dict(
        n=8, title="Request email ID creation",
        business_object="Email ID Request",
        current="Not requested",
        desired="Email ID created and confirmed by IT",
        trigger="Welcome mail sent",
        input=["Candidate name", "Org/platform", "DOJ", "Grade", "Reporting manager"],
        acceptance=["Proposed email <=18 characters", "IT confirms creation before DOJ morning"],
        evidence=["Email ID creation tracker export"],
        verification="database_constraint",
        failure="If IT has not responded by DOJ morning: escalate directly, do not wait for the evening batch.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=5,
        prov=lambda: observed("email-id-creation-tracker.xlsx",
                               "This candidate's row in the real tracker export"),
    ),
    dict(
        n=9, title="Place documents & notify onboarding team",
        business_object="Document Repository Entry",
        current="Documents not filed",
        desired="Documents filed by year/month/date folder, onboarding team notified",
        trigger="Email ID confirmed",
        input=["Verified documents", "Offer letter PDF", "DOJ"],
        acceptance=["Folder created under the correct year/month/date", "Offer letter renamed with candidate name",
                    "Onboarding team notified via group chat"],
        evidence=["OneDrive placement log entry"],
        verification="human_spot_check",
        failure="If a document is missing from the folder at notify time: hold the notification until complete.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=4,
        prov=lambda: observed("onedrive-placement-log.csv",
                               "Folder-placement rows for this candidate"),
    ),
    dict(
        n=10, title="Compile monthly payroll reports",
        business_object="Payroll Report",
        current="Not compiled",
        desired="Three reports (joining bonus, deferred bonus, referral bonus) compiled and sent to Umesh",
        trigger="17th of the month arrives",
        input=["Master Joining Sheet", "Deferred bonus vest dates", "Referral records"],
        acceptance=["All three reports compiled", "Referrer-not-on-interview-panel cross-check done", "Rajesh approves before sending"],
        evidence=["Payroll report export"],
        verification="database_constraint",
        failure="If a referrer is found on the candidate's own interview panel: exclude the referral bonus, flag for review.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=37.5,
        prov=lambda: observed("payroll-report-17th.xlsx",
                               "This month's compiled report export"),
    ),
    dict(
        n=11, title="Handle candidate drop-out",
        business_object="Candidate Drop-out Case",
        current="Status unconfirmed",
        desired="Master Joining Sheet updated with confirmed status and reason",
        trigger="Rashmi checks with recruiter 2 days before DOJ for future-dated joiners",
        input=["Recruiter confirmation", "Drop-out reason"],
        acceptance=["MJS updated with reason", "Recruiter has handled candidate communication"],
        evidence=["No system-of-record log exists for this step in this batch"],
        verification="human_spot_check",
        failure="If status cannot be confirmed by DOJ-1: escalate to recruiter directly rather than leaving the MJS row stale.",
        rr=["RR-HR-POLICY-OFFER-DESK"],
        time_min=5,
        prov=lambda: declared("No candidates in this 9-candidate batch dropped out -- no event exists to observe. Left declared, not fabricated."),
    ),
]


def build():
    work_units = []
    for i, s in enumerate(STEPS):
        wu_id = f"WU-OD-{s['n']:02d}"
        deps = ["external-input"] if i == 0 else [f"WU-OD-{STEPS[i-1]['n']:02d}"]
        work_units.append({
            "id": wu_id,
            "name": s["title"],
            "business_object": s["business_object"],
            "current_condition": s["current"][:80],
            "desired_condition": s["desired"][:80],
            "context": {"decision_branches": s.get("failure", "")[:200], "variants": []},
            "trigger": s["trigger"],
            "input": s["input"],
            "authority": "Rashmi KN (Offer Desk SME)",
            "actor_constraints": "Offer Desk SME only" + (
                "; salary deviation requires Vasu + Nagaraj co-approval" if s["n"] == 3 else ""),
            "acceptance_criteria": s["acceptance"],
            "evidence_required": s["evidence"],
            "verification_method": s["verification"],
            "sla_timing": {
                "time_per_case_min": s["time_min"],
                "frequency": "Per candidate" if s["n"] != 10 else "Monthly (17th)",
                "volume_per_month": 38,
                "sla_deadline": None,
                "raw": None,
            },
            "dependencies": deps,
            "failure_semantics": s["failure"],
            "regulatory_register_link": s["rr"],
            "provenance": s["prov"](),
            "verdict": VERDICT_SCORES[s["n"]],
        })

    genome = {
        "function_pack": "hr_operations",
        "work_units": work_units,
        "work_graph_edges": [],
        "dual_scoring_kappa": 0.87,
        "_disclaimer": "FABRICATED FOR TESTING. Candidate roster, interviews and "
                        "system logs in this folder are synthetic. Not real Rashmi "
                        "production data. See README.md.",
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(genome, f, indent=2)
    print("wrote", OUT)
    observed_n = sum(1 for wu in work_units if wu["provenance"]["source_type"] == "observed")
    print(f"{observed_n}/{len(work_units)} work units observed ({observed_n/len(work_units)*100:.1f}%)")


if __name__ == "__main__":
    build()
