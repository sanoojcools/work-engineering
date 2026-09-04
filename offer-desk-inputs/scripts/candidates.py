"""Single source of truth for the 9 synthetic candidates every other file in
offer-desk-inputs/ derives from. FABRICATED FOR TESTING -- no real candidate
data. Names, IDs and numbers are invented; the policy branches they exercise
(salary deviation, dual employment, campus annexures, contractor Asset vs
non-Asset, ESOP, joining bonus split) are the real rules named in
frontend/src/lib/offerDeskData.ts.
"""

CANDIDATES = [
    {
        "id": "C-2026-0142", "name": "Ananya Rao", "hire_type": "permanent",
        "function": "GTS", "grade": "Grade 5", "city": "Bengaluru",
        "doj": "2026-06-01", "recruiter": "Ramya S", "manager": "Suresh Kumar",
        "ctc": 1850000, "variable_pct": 8, "deviation_pct": 0,
        "joining_bonus": 150000, "deferred_bonus": 0, "esop": False,
        "source_type": "referral", "source_name": "Suresh Kumar",
        "uan_overlap": False, "asset_payroll": None,
        "application_id": "APP-88231",
    },
    {
        "id": "C-2026-0143", "name": "Karthik Subramaniam", "hire_type": "permanent",
        "function": "Platforms", "grade": "Grade 6", "city": "Chennai",
        "doj": "2026-06-08", "recruiter": "Ramya S", "manager": "Nagaraj T",
        "ctc": 2400000, "variable_pct": 0, "deviation_pct": 6,
        "joining_bonus": 0, "deferred_bonus": 0, "esop": False,
        "source_type": "vendor", "source_name": "TalentBridge Consulting",
        "uan_overlap": False, "asset_payroll": None,
        "application_id": "APP-88245",
        "flag": "Salary approval mail lists 5% variable pay -- Platforms has NO variable pay at any level. Flagged to recruiter per policy; corrected before offer generation.",
    },
    {
        "id": "C-2026-0144", "name": "Meera Iyer", "hire_type": "contractor",
        "function": "GTS", "grade": "Grade C", "city": "Hyderabad",
        "doj": "2026-06-03", "recruiter": "Ramya S", "manager": "Suresh Kumar",
        "ctc": 0, "contract_amount": 480000, "contract_months": 6,
        "variable_pct": 0, "deviation_pct": 0, "joining_bonus": 0,
        "deferred_bonus": 0, "esop": False, "source_type": "vendor",
        "source_name": "Quess Corp", "uan_overlap": False,
        "asset_payroll": True, "application_id": "APP-88250",
    },
    {
        "id": "C-2026-0145", "name": "Rohit Sharma", "hire_type": "campus",
        "function": "GTS", "grade": "Grade A", "city": "Bengaluru",
        "doj": "2026-07-01", "recruiter": "Divya P", "manager": "Suresh Kumar",
        "ctc": 900000, "variable_pct": 0, "deviation_pct": 0,
        "joining_bonus": 0, "deferred_bonus": 0, "esop": False,
        "source_type": "campus", "source_name": "PSG College of Technology",
        "uan_overlap": False, "asset_payroll": None,
        "application_id": "APP-88260",
    },
    {
        "id": "C-2026-0146", "name": "Divya Menon", "hire_type": "permanent",
        "function": "Core", "grade": "Grade 4", "city": "Chennai",
        "doj": "2026-06-15", "recruiter": "Ramya S", "manager": "Rajesh Kumar",
        "ctc": 1500000, "variable_pct": 0, "deviation_pct": 0,
        "joining_bonus": 0, "deferred_bonus": 0, "esop": False,
        "source_type": "vendor", "source_name": "Naukri Direct",
        "uan_overlap": True, "asset_payroll": None,
        "application_id": "APP-88266",
        "flag": "UAN service history shows an overlapping employment window with the declared current employer (14 Jan 2026 - 2 Mar 2026 overlap). Dual employment -- offer NOT released. Escalated Rashmi -> Recruiter -> Manager -> Rajesh/Narang for deviation approval.",
    },
    {
        "id": "C-2026-0147", "name": "Arjun Nair", "hire_type": "intern",
        "function": "GTS", "grade": "Grade C", "city": "Bengaluru",
        "doj": "2026-06-10", "recruiter": "Divya P", "manager": "Suresh Kumar",
        "ctc": 0, "stipend": 35000, "variable_pct": 0, "deviation_pct": 0,
        "joining_bonus": 0, "deferred_bonus": 0, "esop": False,
        "source_type": "campus", "source_name": "RV College of Engineering",
        "uan_overlap": False, "asset_payroll": None,
        "application_id": "APP-88270",
    },
    {
        "id": "C-2026-0148", "name": "Priya Desai", "hire_type": "permanent",
        "function": "Platforms", "grade": "Grade 7", "city": "Hyderabad",
        "doj": "2026-06-20", "recruiter": "Ramya S", "manager": "Nagaraj T",
        "ctc": 3200000, "variable_pct": 0, "deviation_pct": 0,
        "joining_bonus": 0, "deferred_bonus": 200000,
        "deferred_bonus_vest": "2027-06-20", "esop": True,
        "source_type": "referral", "source_name": "Nagaraj T",
        "uan_overlap": False, "asset_payroll": None,
        "application_id": "APP-88281",
    },
    {
        "id": "C-2026-0149", "name": "Vikram Singh", "hire_type": "contractor",
        "function": "Core", "grade": "Grade C", "city": "Chennai",
        "doj": "2026-06-05", "recruiter": "Divya P", "manager": "Rajesh Kumar",
        "ctc": 0, "contract_amount": 420000, "contract_months": 12,
        "variable_pct": 0, "deviation_pct": 0, "joining_bonus": 0,
        "deferred_bonus": 0, "esop": False, "source_type": "vendor",
        "source_name": "Randstad India", "uan_overlap": False,
        "asset_payroll": False, "application_id": "APP-88290",
    },
    {
        "id": "C-2026-0150", "name": "Sneha Reddy", "hire_type": "permanent",
        "function": "GTS", "grade": "Grade 5", "city": "Bengaluru",
        "doj": "2026-06-25", "recruiter": "Ramya S", "manager": "Suresh Kumar",
        "ctc": 1750000, "variable_pct": 8, "deviation_pct": 0,
        "joining_bonus": 180000, "deferred_bonus": 0, "esop": False,
        "source_type": "referral", "source_name": "Ramesh Iyer",
        "uan_overlap": False, "asset_payroll": None,
        "application_id": "APP-88301",
    },
]

for _c in CANDIDATES:
    _c.setdefault("flag", "")
    _c.setdefault("ctc", 0)
    _c.setdefault("contract_amount", 0)
    _c.setdefault("contract_months", 0)
    _c.setdefault("stipend", 0)
    _c.setdefault("deferred_bonus_vest", "")
