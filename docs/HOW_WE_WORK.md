# How we work (friction-free)

You are not the project manager. You **paste** and **merge**.

```
You     →  open docs/NEXT.md  →  paste Claude  →  paste Cursor
GitHub  →  CI green  →  Squash and merge  (2 clicks)
PC      →  git pull origin main
Grok    →  only if NEXT says STOP, or CI still red after one fix, or you want to change the 14-slice list
```

**Do not** message Grok “what’s next?”  
**Do not** wait between Claude and Cursor when NEXT says both are UNLOCKED.  
**Do not** open the BNP review chat for builds.

Folder always: `C:\Users\dell\Documents\work-engineering` on **`main`** then the agent’s branch.

Claude = new chat every slice (never “what’s next” on the old one).  
Cursor = new chat every slice. Extra High. `@docs/NEXT.md` `@docs/contracts/…`

If CI red: paste the failing job into **that same** agent chat: “fix this PR only.” Merge when green.

Grok’s job (without you asking): keep `docs/NEXT.md` + `docs/contracts/` true. Review diffs when you dump a PR here.
