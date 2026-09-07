import { Link } from "react-router-dom";
import { InfoTooltip } from "../components/InfoTooltip";
import { IoPanes } from "../components/IoPanes";
import { deskHoursSummary, formatHoursRange, sumDeclaredHours } from "../lib/desks/functionHours";

const DESK_ROUTE: Record<string, string> = {
  "offer-desk": "/scout/offer-desk/hours",
  onboarding: "/hr/operations/onboarding",
  offboarding: "/hr/operations/offboarding",
  "vendor-mgmt": "/hr/operations/vendor-mgmt",
  "us-hr": "/hr/operations/us-hr",
  hrbp: "/hr/hrbp",
};

const rows = deskHoursSummary();
const sum = sumDeclaredHours(rows);

export default function HrFunctionHours() {
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        HR function · declared hours, six desks
      </p>
      <h2>
        Function hours{" "}
        <InfoTooltip
          term="Declared hours"
          simple="Each desk's own stated TOTAL ESTIMATED SAVINGS line, verbatim. Not a measurement, not a defended case — the sheet's own claim, same idiom Offer Desk's own 95 already uses."
        />
      </h2>
      <p className="lede">
        Offer Desk's own Hours page keeps its declared 95 vs. defended 61.8 — untouched by this panel. No other desk
        gets a second, defended figure invented for it: this screen shows exactly one number per desk, the sheet's
        own stated <code>hrs/mo</code> claim, and nothing more.
      </p>

      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th>Desk</th>
            <th>Declared hrs/mo</th>
            <th>Sheet's own line (verbatim)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.desk.id}>
              <td>
                <Link to={DESK_ROUTE[r.desk.id] ?? "/hr/operations"}>{r.desk.name}</Link>
              </td>
              <td>{r.parsed ? formatHoursRange(r.parsed) : "— (not stated in this shape)"}</td>
              <td className="hint">{r.raw}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card" style={{ marginBottom: 16, borderColor: "#b8860b" }}>
        <strong>
          Sum: {sum ? formatHoursRange(sum) : "— none parsed"} hrs/mo — stated across sittings, not defended.
        </strong>
        <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
          This adds six independent sheet claims together. It is not a defended case the way Offer Desk's 61.8 is
          (four costing disciplines applied to one desk) — nobody has checked these six numbers for double-counted
          steps, unobserved volume, or overlapping SPOC time the way that page's own discipline does. HRBP's own
          line states two figures ("~30-50 hrs/mo per HRBP" and "~90-150 hrs/mo across team") — the team-wide figure
          is the one summed here, to stay comparable with every other desk's own desk-wide number.
          {sum && sum.unparsedDeskNames.length > 0 && (
            <> Not included in the sum ({sum.unparsedDeskNames.join(", ")}): stated in a shape this panel doesn't parse.</>
          )}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Verbatim monthly effort{" "}
          <InfoTooltip
            term="Monthly effort profile"
            simple="Each SPOC's own free-text description of how their time breaks down — quoted, not summarized into a single number."
          />
        </h3>
        {rows.map((r) => (
          <div key={r.desk.id} style={{ marginBottom: 10 }}>
            <strong>{r.desk.name}</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {r.desk.monthlyEffortProfile.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <IoPanes
        given="Six DeskSpecs' own TOTAL ESTIMATED SAVINGS and monthly effort profile lines, verbatim."
        understood="A stated hrs/mo claim is not a defended case — no costing discipline has been applied across desks the way Offer Desk's own 61.8 was applied to one."
        processed="Parsed from each desk's own line (same sourcing Offer Desk's declared 95 already uses), summed as stated. No workforce simulator, no invented per-person allocation."
        output={`${rows.filter((r) => r.parsed).length}/${rows.length} desks parsed; sum ${sum ? formatHoursRange(sum) : "—"} hrs/mo, stated not defended.`}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/hr/function-graph">← HR function graph</Link>
        {" · "}
        <Link to="/hr/objects/employee">Employee object card</Link>
        {" · "}
        <Link to="/scout/offer-desk/hours">Offer Desk's own 95 vs 61.8 →</Link>
      </p>
    </>
  );
}
