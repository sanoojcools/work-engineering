# Working agreement

## Scope

- Do exactly what was asked. If you spot an unrelated bug or messy code while
  working, mention it in your final summary — don't fix it unless asked.
- A bug fix doesn't need surrounding cleanup. A one-off script doesn't need a
  reusable module. No speculative abstractions for hypothetical future needs.
- If `CURSOR.md` at the repo root points to an idea brief (currently
  `docs/CURSOR_V9.md`), read that first — it may narrow scope further (e.g.
  "don't rewrite this repository").

## Before writing code

- Search the codebase for existing patterns (naming, error handling, test
  style, folder layout) and match them. Don't invent a new convention when
  one already exists.
- Read the file you're about to edit in full, not just the region you think
  is relevant.

## While editing

- Prefer the smallest diff that correctly solves the problem. Surgical edits
  over rewrites.
- Don't ask for permission mid-task for reversible, local actions (editing
  files, running tests, reading code). Just do them.
- Do stop and ask before anything hard to reverse or outside the local repo:
  force-push, `rm -rf`, dropping data, touching CI/infra, sending anything
  external.
- No comments explaining *what* the code does — name things well instead.
  A comment is only worth it for a non-obvious *why* (a workaround, a
  constraint, a gotcha).

## Before calling it done

Run the real commands, not "should work" (first run needs deps installed:
`pip install -r backend/requirements.txt` and `npm install --prefix frontend`):

- Backend: `cd backend && pytest`
- Frontend: `cd frontend && npm run build` (runs `tsc --noEmit` then
  `vite build` — this is the type-check; there is no separate lint script)

If you can't verify something (no way to run the UI, no test harness for
that path), say so explicitly instead of claiming success.

## Reporting back

- End with a short summary: what changed, what you verified, what's left.
- If you found extra issues outside scope, list them — don't silently fix
  or silently ignore them.
