import { useState } from "react";
import { InfoTooltip } from "../InfoTooltip";
import { ApiKeyBanner } from "../ApiKeyBanner";
import {
  POINTER_STATUS_PLAIN,
  pointerIsFact,
  pointerOpened,
  plainStatusForDisplay,
  useEvidenceClaims,
  type EvidenceClaim,
} from "../../lib/pointers";

function ClaimBadges({ claim }: { claim: EvidenceClaim }) {
  return (
    <>
      {claim.isBinding && (
        <span className="badge" data-testid="evidence-binding-badge">
          Must be said by a person
        </span>
      )}
      {!claim.isBinding && claim.pointer?.status === "composed" && (
        <span className="badge" data-testid="evidence-composed-badge">
          Composed
        </span>
      )}
    </>
  );
}

function ClaimDetail({ claim }: { claim: EvidenceClaim }) {
  const pointer = claim.pointer;
  const opened = pointerOpened(pointer);
  const asFact = pointerIsFact(pointer, claim.fieldName);
  const status = plainStatusForDisplay(pointer, claim.fieldName, claim.guest);
  const downgraded =
    pointer != null && pointer.requested_status !== pointer.status && !pointer.resolved;

  return (
    <div className="card" data-testid="evidence-claim-detail" style={{ marginTop: 12, marginBottom: 0 }}>
      <h4 style={{ marginTop: 0, marginBottom: 6 }}>
        {claim.fieldLabel}{" "}
        <InfoTooltip
          term="Field pointer"
          simple="The file and cell, page, or line this claim points at — or an honest cannot open if that location does not exist."
          technical="GET /work-units/{id}/pointers. status is post-resolver; requested_status is what the caller claimed. Binding fields (authority, acceptance_criteria, actor_constraints) may only stand as declared + verified quote."
        />
      </h4>
      <p className="hint" style={{ marginTop: 0 }}>
        {claim.workUnitCode} — {claim.workUnitName}
      </p>
      <p style={{ fontSize: 13, margin: "0 0 8px" }}>
        <span data-testid="evidence-detail-status">{status}</span>{" "}
        <ClaimBadges claim={claim} />
      </p>
      {claim.isBinding && (
        <p className="hint" data-testid="evidence-binding-note" style={{ marginTop: 0 }}>
          This field must be said by a person, with their words in a file. It is never written by a
          model.
        </p>
      )}
      {!claim.isBinding && pointer?.status === "composed" && (
        <p className="hint" style={{ marginTop: 0 }}>
          Proposed by us — a composed badge until someone adopts it as a record. Not a sitting, and
          not a file.
        </p>
      )}
      {downgraded && (
        <p className="hint" data-testid="evidence-downgraded" style={{ marginTop: 0 }}>
          Claimed as {POINTER_STATUS_PLAIN[pointer.requested_status]}; the pointer could not be
          opened, so it is not a fact.
        </p>
      )}
      {asFact && opened && pointer ? (
        <div data-testid="evidence-pointer">
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            File: <span data-testid="evidence-pointer-file">{claim.fileName ?? `file ${pointer.file_id}`}</span>
          </p>
          {pointer.cell && (
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>
              Cell: <span data-testid="evidence-pointer-cell">{pointer.cell}</span>
            </p>
          )}
          {pointer.page != null && (
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>
              Page: <span data-testid="evidence-pointer-page">{pointer.page}</span>
            </p>
          )}
          {pointer.line != null && (
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>
              Line: <span data-testid="evidence-pointer-line">{pointer.line}</span>
            </p>
          )}
          {pointer.quote.trim() !== "" && (
            <p style={{ fontSize: 13, margin: 0 }}>
              Their words: <q data-testid="evidence-pointer-quote">{pointer.quote}</q>
            </p>
          )}
        </div>
      ) : (
        <p data-testid="evidence-cannot-open" style={{ fontSize: 13, margin: 0 }}>
          cannot open
          {claim.guest
            ? " — no live pointers in this walk. Looking does not mint a key."
            : pointer?.resolution_note
              ? ` — ${pointer.resolution_note}`
              : " — no file location stands for this claim."}
        </p>
      )}
    </div>
  );
}

/** Census step 3: click a claim → pointer or cannot open. Guest is walk-only. */
export function EvidenceClaims() {
  const { isGuest, claims, loading, error, needsKey, setNeedsKey } = useEvidenceClaims();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = claims.find((c) => c.id === selectedId) ?? null;

  return (
    <div
      className="card"
      data-testid="evidence-claims"
      aria-busy={!isGuest && loading ? "true" : "false"}
      style={{ marginBottom: 16 }}
    >
      <h3 style={{ marginTop: 0 }}>
        How we know each claim{" "}
        <InfoTooltip
          term="How we know it"
          simple="Click a claim to see the file and cell, page, or line — or an honest cannot open. Status is in plain words: seen in records, said by a person, pieced together, proposed by us, predicted by a model."
          technical="observed / declared / reconstructed / composed / predicted on field_pointers. GET only; the resolver already ran on write. Composed is a badge until adopted. Binding fields refuse predicted/composed on the API."
        />
      </h3>
      <p className="lede" style={{ marginTop: 0 }}>
        A claim is not a fact until its pointer opens. Composed stays a badge. Who-may-decide,
        what-counts-as-done, and who-may-not must be said by a person.
      </p>
      {needsKey && !isGuest && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}
      {loading && !isGuest && (
        <p className="hint" data-testid="evidence-claims-loading">
          Loading this tenant's field claims…
        </p>
      )}
      {!loading && claims.length === 0 && (
        <p className="hint" style={{ marginBottom: 0 }}>
          No field claims recorded yet on this tenant. Zero is an honest answer — nothing here is
          invented to look complete.
        </p>
      )}
      {!loading && claims.length > 0 && (
        <ul className="claim-list">
          {claims.map((claim) => {
            const active = claim.id === selectedId;
            return (
              <li key={claim.id}>
                <button
                  type="button"
                  className={active ? "claim-item active" : "claim-item"}
                  data-testid={`evidence-claim-${claim.id}`}
                  aria-pressed={active}
                  onClick={() => setSelectedId(claim.id)}
                >
                  <div>
                    <strong>
                      {claim.fieldLabel}{" "}
                      <InfoTooltip
                        term={claim.fieldLabel}
                        simple={
                          claim.isBinding
                            ? "A binding field — it must be said by a person, with their words in a file."
                            : "One recorded claim on this piece of work."
                        }
                        technical={claim.fieldName}
                      />
                    </strong>
                    <ClaimBadges claim={claim} />
                  </div>
                  <div className="claim-item-meta">
                    {claim.workUnitCode}
                    {" · "}
                    <span data-testid={`evidence-claim-status-${claim.id}`}>
                      {plainStatusForDisplay(claim.pointer, claim.fieldName, claim.guest)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && <ClaimDetail claim={selected} />}
      <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
        {isGuest
          ? "Guest: walk-only claims, not Client A's files. Clicking does not mint a key."
          : "Read from this tenant's own field pointers. An unopened pointer is not shown as a fact."}
      </p>
    </div>
  );
}
