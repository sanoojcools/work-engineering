# Autostart + automerge

Laptop agents cannot wake themselves. Cloud can. Merge can too.

## One-time (you)

**A. GitHub repo → Settings → General**
- [ ] Allow auto-merge
- [ ] Automatically delete head branches (optional)

**B. Claude cloud**
1. Claude Code: `/install-github-app`
2. Settings → Secrets: `ANTHROPIC_API_KEY`
3. Settings → Variables: `AUTO_SLICES` = `true`

**C. Cursor cloud**  
[cursor.com/automations](https://cursor.com/automations) — trigger push `docs/NEXT.md`, prompt: do Cursor section of NEXT.md, open PR, do not merge (automerge job does).

Until B+C: you still type `go`. **A alone** already removes squash-and-merge for `claude/*` and `cursor/*` PRs.

## Exceptions (you still decide)

PR gets **needs-founder** and will **not** merge if it touches:
`docs/NEXT.md`, contracts, `V10_BUILD`, workflows, `hire_leaves.yaml`, login/Clerk/WorkOS, or says STOP-GATE.

Unlabel after you read it → automerge resumes.
