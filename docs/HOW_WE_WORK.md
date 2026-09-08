# How we work

**Laptop agents cannot start themselves.** Cloud can: [`docs/AUTOSTART.md`](AUTOSTART.md) (once).

After that:

```
Grok updates docs/NEXT.md  →  Claude + Cursor cloud start  →  PRs open
You: Squash and merge when CI green
```

Until you flip `AUTO_SLICES=true`: `git pull` then type `go` in each New chat.
