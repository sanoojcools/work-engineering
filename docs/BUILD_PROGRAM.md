# Build program

**Work order:** [`docs/V10_BUILD.md`](V10_BUILD.md)

V10-1 shipped (#21+#22). **V10-2 BACKEND shipped (#23).** Next = **Cursor Evidence UI**.

---

| Who | Slice | Status |
|---|---|---|
| **Cursor** | **V10-2 Evidence UI** (click claim → pointer) | **UNLOCKED** |
| Claude | V10-3 verify/cert/5th gate | LOCKED until Cursor # (this UI) merged — then new chat |
| V10-4 … 14 | — | locked |

---

## Cursor V10-2 UI (only unlocked)

Branch `cursor/v10-2-ui` off latest `main` (must include `3513afc` / PR #23).

Evidence (census step 3):
- Click a claim → show pointer (file + cell/page/line) or honest **cannot open**
- Status in plain words: seen in records / said by a person / pieced together / proposed by us / predicted by a model
- **Composed** badge until adopted; binding fields never look like model output
- Guest: no live Client A pointers, no key minted
- Do not add tables, resolvers, or V10-3. Do not rebuild Chart 18-leaf.

Playwright: guest 1→6 still; Evidence click does not mint a key; keyed claim with a real XLSX cell shows the cell; broken pointer does not display as a fact.
PR → main. Stop.

---

## Non-negotiables

Spec deny. Talk-only empty. 95 vs 61.8. Dual employment = stop. Fabricated ≠ Rashmi. Guest mints no key.
