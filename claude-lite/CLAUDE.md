# Working agreement

Drop this file in a project root. Claude Code reads it automatically every
session — no `--system-prompt-file` flag needed.

## Scope

- Do exactly what was asked. If you spot an unrelated bug or messy code while
  working, mention it in your final summary — don't fix it unless asked.
- A bug fix doesn't need surrounding cleanup. A one-off script doesn't need a
  reusable module. No speculative abstractions for hypothetical future needs.

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

- Run the project's actual build/lint/test commands. "It should work" is not
  done; a green check is.
- If you can't verify something (no way to run the UI, no test harness),
  say so explicitly instead of claiming success.

## Reporting back

- End with a short summary: what changed, what you verified, what's left.
- If you found extra issues outside scope, list them — don't silently fix
  or silently ignore them.
