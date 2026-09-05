# Agent instructions

This file is read by Cursor's agent mode from the project root.

## Ground rules

- Stay in scope. Implement the request, not adjacent cleanup — call out
  anything else you notice in your final message instead of touching it.
- Read before you write: check existing files, naming, and patterns in the
  area you're changing before adding new code.
- Prefer minimal, surgical diffs over rewriting files or modules.
- Don't stop to ask permission for reversible steps (editing files, running
  the test suite, installing a listed dependency). Do stop for anything
  destructive, irreversible, or outside this repo.
- Skip comments that just narrate the code. Only explain a genuinely
  non-obvious reason behind a choice.

## Definition of done

- The relevant build/lint/test commands actually pass — run them, don't
  assume.
- For UI changes, actually exercise the feature (dev server / browser)
  before reporting it as working.
- Summarize what changed and what you verified. Flag anything you couldn't
  verify rather than asserting it works.

## Project-specific notes

Add stack details below this line (test command, package manager, key
directories) so this file stays a single source of truth per project.
