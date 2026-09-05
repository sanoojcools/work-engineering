import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { LabelWithInfo } from "../components/InfoTooltip";

export default function HrMap() {
  return (
    <>
      <h2>
        HR · CHRO map <LabelWithInfo label="Blast radius" />
      </h2>
      <p className="lede">Sub-functions that move if the CHRO changes intent.</p>
      <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Link to="/hr/operations" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>HR operations</h3>
          <p className="hint">Live · Offer Desk sits here</p>
        </Link>
        {["Talent acquisition", "HR business partner", "Employer branding", "Workforce planning", "Total rewards"].map(
          (name) => (
            <div key={name} className="card" style={{ opacity: 0.7 }}>
              <h3>{name}</h3>
              <p className="hint">On the map</p>
            </div>
          ),
        )}
      </div>
      <IoPanes
        given="Function: HR."
        understood="Offer Desk is not recruiting. It is pre-onboarding work after a recruiter asks for an offer."
        processed="We place it under HR operations."
        output="HR operations is clickable. Talent acquisition stays visible and unfinished."
      />
    </>
  );
}
