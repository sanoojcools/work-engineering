# How we work

You are in the loop **only** for exceptions (`needs-founder` on GitHub).

Normal path (after [`AUTOSTART.md`](AUTOSTART.md) + **Allow auto-merge**):

```
Grok writes docs/NEXT.md  →  cloud Claude + Cursor open PRs
CI green  →  squash-merge happens without you
```

You get a GitHub mail only if:
- label **needs-founder** (NEXT.md / contracts / workflows / login vendor / STOP-GATE)
- CI red twice

Until autostart is on: `git pull` → type `go` in two New chats. Merge is still automatic for `claude/*` and `cursor/*` PRs once **Allow auto-merge** is on.
