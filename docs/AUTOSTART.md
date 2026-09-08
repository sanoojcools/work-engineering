# Autostart (no “go”)

Laptop Claude and laptop Cursor **cannot** start themselves. Cloud can.

After this, **your job is merge**. Agents start when `docs/NEXT.md` changes (Grok does that).

---

## Once: Claude on GitHub

1. In a Claude Code terminal on this repo: `/install-github-app` (you are admin).
2. Repo **Settings → Secrets**: `ANTHROPIC_API_KEY`
3. Repo **Settings → Variables**: `AUTO_SLICES` = `true`

Workflow: `.github/workflows/next-claude.yml`  
Until step 3, it **does not run** (no red X).

Claude opens a PR. **You still squash-merge** (or turn on auto-merge on that PR).

---

## Once: Cursor cloud

Laptop Cursor will never wake on its own.

1. [cursor.com/automations](https://cursor.com/automations) (or `/automate` in Cursor)
2. Trigger: GitHub **push** to `main` **path** `docs/NEXT.md` (same as Claude)
3. Prompt: `Read docs/NEXT.md. Do only the Cursor section. If LOCKED, stop. Open a PR. Do not merge.`
4. Repo: `sanoojcools/work-engineering`. Spend cap you’re willing to burn.

---

## Loop guard

Agents must **not** edit `docs/NEXT.md`. Only Grok/you. That file is the starter pistol. If Claude rewrites NEXT, you get a fork bomb — reject that PR.
