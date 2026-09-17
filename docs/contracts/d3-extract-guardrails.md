# D-3 — extract guardrails

Port rules into `services/scout_story.py`. Not a scout-v1 / aodp import.

Already true: every span must be a literal substring, or it is dropped.

Added:
- Model reading (name + structured fields) may contain at most one `?`.
- No `automat*` in the model reading unless that stem is already in what they said.
- On refuse: `used_llm: true`, **empty chunks**, note says refused. Not a quiet sentence split.
- Dead model still falls back to the splitter and names the failure.
- Tests stub the model. Never a live call. Dual-employment stop stays in `handoff.py`.
- Same URL: `POST /api/scout/extract-from-story`.
