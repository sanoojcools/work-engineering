import { Link, useParams } from "react-router-dom";
import { InfoTooltip } from "../components/InfoTooltip";
import { IoPanes } from "../components/IoPanes";
import { OBJECT_CARDS, OBJECTS_BY_ID } from "../lib/desks/objects";

const DESK_ROUTE: Record<string, string> = {
  "offer-desk": "/scout/offer-desk",
  onboarding: "/hr/operations/onboarding",
  offboarding: "/hr/operations/offboarding",
  "vendor-mgmt": "/hr/operations/vendor-mgmt",
  "us-hr": "/hr/operations/us-hr",
  hrbp: "/hr/hrbp",
};

export default function HrObjectCard() {
  const { objectId } = useParams<{ objectId: string }>();
  const card = objectId ? OBJECTS_BY_ID[objectId] : undefined;

  if (!card) {
    return (
      <>
        <h2>Object not found</h2>
        <p className="lede">
          There are three object cards in this slice: {OBJECT_CARDS.map((o) => o.name).join(", ")}.
        </p>
        <p>
          <Link to="/hr/function-graph">← HR function graph</Link>
        </p>
      </>
    );
  }

  const totalUnits = card.deskRefs.reduce((sum, r) => sum + r.unitCodes.length, 0);

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Box 1 lite · reference card · declared sitting, not observed ERP state
      </p>
      <h2>
        {card.name}{" "}
        <InfoTooltip
          term="Object card"
          simple="A reference card for one business object, built from the same desk sittings already on this walk — not a live read of any system of record, and not the real Ontology backend (Box 1, later/refuse)."
          technical="Client-side only, lib/desks/objects.ts. No entity_types/entities row, no endpoint."
        />
      </h2>
      <p className="lede">
        <strong>Type:</strong> {card.type}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Current condition{" "}
          <InfoTooltip
            term="Current condition (declared)"
            simple="Plain-English paraphrase of what each contributing desk's own sheet says happens to this object — not a status code, not a live ERP state."
          />
        </h3>
        <p style={{ fontSize: 14, margin: 0 }}>{card.currentCondition}</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Which desks/units reference it</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          {totalUnits} Work Units across {card.deskRefs.length} desk{card.deskRefs.length > 1 ? "s" : ""} —
          read from the same family-genome payload the import screen posts, not a second hand-typed list.
        </p>
        {card.deskRefs.map((ref) => (
          <div key={ref.deskId} style={{ marginBottom: 10 }}>
            <Link to={DESK_ROUTE[ref.deskId] ?? "/hr/operations"}>{ref.deskName}</Link> —{" "}
            <code>
              {ref.unitCodes[0]} .. {ref.unitCodes[ref.unitCodes.length - 1]}
            </code>{" "}
            ({ref.unitCodes.length} unit{ref.unitCodes.length !== 1 ? "s" : ""})
            {ref.note && <div className="hint" style={{ marginTop: 2 }}>{ref.note}</div>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          As-of{" "}
          <InfoTooltip
            term="As-of = sitting"
            simple="Dated to when each interview happened, not to a live system snapshot — every line below is declared, none is observed."
          />
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {card.asOf.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <IoPanes
        given="The desk sittings already named on this walk — DeskSpec's own outcome/steps, nothing new interviewed."
        understood="A business object here is a reference grouping, not a live record. 'Current condition' is a paraphrase of stated outcomes, not a status this platform observed."
        processed="Built client-side from lib/desks/objects.ts, sourced from the same buildFamilyGenomePayload() the family-genome import screen posts."
        output={`${totalUnits} Work Units across ${card.deskRefs.length} desks, ${card.asOf.length} cited sitting date(s).`}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/hr/function-graph">← HR function graph</Link>
        {" · "}
        <Link to="/hr/function-hours">Function hours →</Link>
        {" · "}
        {OBJECT_CARDS.filter((o) => o.id !== card.id).map((o, i) => (
          <span key={o.id}>
            {i > 0 && " · "}
            <Link to={`/hr/objects/${o.id}`}>{o.name} →</Link>
          </span>
        ))}
      </p>
    </>
  );
}
