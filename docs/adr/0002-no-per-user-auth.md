# No per-user auth; Spec API uses a shared secret

Spec routes (the governance-enforcement surface) authenticate execution systems with a shared `X-Spec-Key`, not per-user tokens. UI and inventory APIs are open on the local network. This is fine for a prototype validating the Work Unit / VERDICT model, but it means the system has no accountability at the *human* level yet — only at the Work Unit level. Do not deploy this beyond a local/trusted network without adding real auth first.
