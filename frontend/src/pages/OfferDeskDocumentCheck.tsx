import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { DOCUMENT_CHECK_RECORD, MISSING_DOC_STARTER, step2 } from "../lib/offerDeskWorkRecord";

export default function OfferDeskDocumentCheck() {
  const rec = DOCUMENT_CHECK_RECORD;
  const sheet = step2();
  const [items, setItems] = useState<string[]>(MISSING_DOC_STARTER);
  const [draft, setDraft] = useState("");
  const [dualEmployment, setDualEmployment] = useState(true);

  function addItem() {
    const next = draft.trim();
    if (!next) return;
    setItems((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setDraft("");
  }

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · helper list · local only
      </p>
      <h2>
        Document check{" "}
        <InfoTooltip
          term="Helper"
          simple="A helper may draft a missing-document list. It may not release the offer. Dual employment is a stop. Appetite does not lift it."
        />
      </h2>
      <p className="lede">
        {sheet.timePerCase} of the day on the sheet. Helper drafts the list. Release stays disabled.
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{rec.name}</h3>
        <p style={{ fontSize: 13 }}>{sheet.whatHappens}</p>
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          Helper may: {rec.helperMay} Helper may not: {rec.helperMayNot}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={dualEmployment}
            onChange={(e) => setDualEmployment(e.target.checked)}
          />
          Dual employment flagged on UAN — stop rule on
        </label>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a missing document"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <button type="button" onClick={addItem}>Add to helper list</button>
        </div>
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }}>
          {items.map((item) => (
            <li key={item}>
              {item}{" "}
              <button
                type="button"
                style={{ padding: "0 6px", fontSize: 12 }}
                onClick={() => setItems((prev) => prev.filter((x) => x !== item))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="primary" disabled>
          Release offer — disabled
        </button>
        <p className="hint" style={{ marginBottom: 0 }}>
          {dualEmployment
            ? rec.stopRule
            : "Stop rule off for this click only. The workbook still names dual employment as a stop. The button stays disabled either way — this screen does not release offers."}
          {" "}List is local React state. It is not evidence_ref. It is not a Work Unit.
        </p>
      </div>

      <IoPanes
        given={`Sheet step ${rec.sheetStep} and the hire-type checklist language.`}
        understood="Missing documents are a list. Dual employment is a veto. Those are different."
        processed="Helper may draft the list in the browser. Release is not wired. No agent autonomy."
        output="A list you can edit. A disabled release. A stop that appetite does not lift."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/hours">Hours 95 / 61.8 →</Link>
      </p>
    </>
  );
}
