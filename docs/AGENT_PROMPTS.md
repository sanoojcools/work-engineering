# Agent prompts

Use a **new** agent each time. `main` only. Multitask **off**.

Grok (this program) owns contracts and stop-gates. Claude/Cursor owns one unlocked slice and live proof.

The bottleneck is not “not enough autonomy.” It is mixing **decisions**, **implementation**, and **“is the hosted demo still a demo?”** in one chat. These two prompts split that.

---

## Prompt A — Validate (no build)

```
Read docs/BUILD_PROGRAM.md, docs/STATUS.md, docs/HONESTY.md, docs/ROADMAP-DECISIONS.md.
Do not write product code.

Return:
1. Which slice IDs are already done (cite commits or files).
2. The single UNLOCKED slice to run next, with why.
3. Any STOP-GATE that is blocking a later track — list the question, options, your recommendation. Do not decide.
4. Conflicts between BUILD_PROGRAM and the current code (especially Gate 11, guest walk, users table, offer-desk-inputs).
5. Files you would touch for that next slice — and files you must not.

If Track 0.1 is not proven on https://work-engineering.onrender.com in an empty browser, the next slice is 0.1, not Track 1.
```

---

## Prompt B — Execute one slice (autonomous)

Paste after A. Fill the ID.

```
Execute ONLY slice <ID> from docs/BUILD_PROGRAM.md.
Read the non-negotiables. Fail the slice if you break one.

You have autonomy inside this slice: implement, test, Playwright, hosted verify if the card requires it, HONESTY.md one paragraph if behaviour changed, commit on main (or feat/<id> then PR to main).

Stop when the card’s “Done when” is evidenced, using the slice report template in BUILD_PROGRAM §6.

If you hit a STOP-GATE, do not guess. Write the question and stop.
If hosted 0.1 is red, drop this slice and fix 0.1 instead.

Do not start any other slice. Do not wire WorkOS. Do not enforce Gate 11 order. Do not invent traces or catalogs.
```

---

## Founder cadence (this is the velocity)

| You | Agent |
|---|---|
| Once: Prompt A | Returns next ID |
| Once: Prompt B with that ID | Builds until the bar |
| 10 min: click the hosted URL or the test output | Accept / send back one defect |
| Repeat | |

Do **not** sit in the agent chat steering. If you are typing every 5 minutes, the slice card was too vague — tighten BUILD_PROGRAM, do not “collaborate” the implementation.

Parallel only: docs (0.3) vs backend gate (1.1) on different files. Never two agents on `OfferDesk*.tsx` or `genome_import.py`.

---

## What “professional grade” means here

- Live URL is the spec for Track 0.
- Tests are the spec for Track 1.
- A named CHRO / named file / named catalog reviewer is the spec for Tracks 3–5.
- Chat is for stop-gates and defects, not for designing the slice mid-flight.
