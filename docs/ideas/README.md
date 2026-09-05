# Idea versions

This repo is the product. V8, V9, V10 are idea labels, not separate apps.

| Label | Git | What it means |
|---|---|---|
| V8 | `main` today, tag `idea-v8` when you freeze it | Factory we already built |
| V9 | branch `idea/v9` | Showroom + honesty rules on that factory |
| V10+ | branch `idea/v10` when needed | Next idea. Same pattern |

Demo V8: `git switch main` then `docker compose up --build` → http://localhost:5173

Demo V9 (after Cursor lands the walk): `git switch idea/v9` → same app, default path is Enterprise → HR Ops → Offer Desk.

To freeze a version:

```
git tag idea-v9
git push origin idea-v9
```

To open an old version later:

```
git switch -c revive/v9 idea/v9
# or: git switch idea-v9   if you tagged it
```
