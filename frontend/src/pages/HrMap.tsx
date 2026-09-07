import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { LabelWithInfo } from "../components/InfoTooltip";

const GREY_SUB_FUNCTIONS = ["Talent acquisition", "Employer branding", "Workforce planning", "Total rewards"];

export default function HrMap() {
  return (
    <>
      <h2>
        HR · CHRO map <LabelWithInfo label="Scope" />
      </h2>
      <p className="lede">Sub-functions that move if the CHRO changes intent.</p>
      <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Link to="/hr/operations" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>HR operations</h3>
          <p className="hint">Live · 5 desks sit here</p>
        </Link>
        <Link to="/hr/hrbp" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>HR business partner</h3>
          <p className="hint">Needs follow-up sitting · Thamizh / Rajitha</p>
        </Link>
        {GREY_SUB_FUNCTIONS.map((name) => (
          <div key={name} className="card" style={{ opacity: 0.7 }}>
            <h3>{name}</h3>
            <p className="hint">On the map</p>
          </div>
        ))}
      </div>
      <IoPanes
        given="Function: HR."
        understood="Offer Desk is not recruiting. It is pre-onboarding work after a recruiter asks for an offer. HRBP is not HR operations — it is its own sub-function, with its own sitting, that overlaps with Onboarding and Offboarding rather than sitting under either."
        processed="We place Offer Desk, Onboarding, Offboarding, Vendor Mgmt, and US HR under HR operations, and HRBP as its own peer card."
        output="HR operations and HR business partner are both clickable. Talent acquisition, employer branding, workforce planning, and total rewards stay visible and unfinished."
      />
    </>
  );
}
