# Idea versions

This repo is **one product**. V8, V9, V10 are **idea labels**, not separate apps and not stamps on the UI.

**What to run today:** `main` → census walk (README). Do not `git switch idea/v9` for a review.

| Label | Git | What it meant |
|---|---|---|
| V8 | origin paper + early factory | Concept in `docs/Work-Engineering-V8.md` |
| V9 | Offer Desk showroom on that factory | Now folded into `main` |
| V10 | Census + discovery program | Direction in `docs/V10_BUILD.md` / `docs/WEP_Discovery_Proposal.md` |

Frozen tags (if present): `git tag -l 'idea-*'`.

To inspect an old idea branch without changing what reviewers see:

```
git fetch origin
git log origin/main --oneline -5
```
