# The pitch — guest walk first, setup second

## Look — no key, no sign-in

**https://work-engineering.onrender.com** → **Start the walk** (Home's primary button)

Home → Enterprise → HR → HR operations → Offer Desk → three seats (Function
leader, Sub-function lead, Offer Desk SME) → Playback → Spreadsheet → Save
talk-only → How we cut it → Gap → Document check → Hours → Spec deny →
Sitting record. 12 minutes, every screen renders, nothing needs a key.

Every screen carries **"Looking only — nothing is saved."** Every write on
this walk (save talk-only, Spec check, evidence upload/import) either shows
a preview of the real outcome or asks you to sign in first — none of it
writes anything without a key, and none of it fakes success to look finished.

## Set up the demo — for people who will save

Same URL, click **Set up the demo** (now secondary, tucked under a
disclosure on Home) instead. Mints a real key, signs the browser in, and the
same screens start actually writing: Save talk-only shows a real GQS score
(still denied — completeness isn't clearance), Spec deny's "attach evidence"
button really uploads a file and flips the check to allowed, and "What if
the evidence existed?" really imports the fabricated-but-real evidence pack.

## Three things this walk does not promise

- That a customer can log in and see only their own data — per-org keys
  exist; per-user login does not.
- That `offer-desk-inputs/` (the files behind "What if the evidence
  existed?") is Rashmi's real production month, or that any real
  Zwayam/Zoho/UAN integration exists — it's a fabricated test fixture
  proving the observed-evidence path, not real data or a real connector.
- That this product executes work, connects to a real ERP, or runs agents.
  It specifies work; execution systems consume the spec.

See `docs/STATUS.md` for the full list.
