# How we work

Agents **read `docs/NEXT.md` themselves** (`CLAUDE.md` + `.cursor/rules/v10.mdc`).

You:

```
git pull origin main
Claude + New  →  type: go
Cursor + New  →  type: go
When CI green →  Squash and merge
git pull
```

Do not paste long prompts. Do not ask Grok “what’s next?”
Grok only: CI still red after one fix, or change the 14-slice list.
