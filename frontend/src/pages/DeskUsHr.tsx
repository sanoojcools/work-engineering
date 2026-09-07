import { Link } from "react-router-dom";
import { DeskWalk } from "../components/DeskWalk";
import { US_HR_SPEC } from "../lib/desks/usHr";

export default function DeskUsHr() {
  return (
    <>
      <DeskWalk spec={US_HR_SPEC} />
      <p className="hint" style={{ marginTop: 12 }}>
        Rashmi KN also runs the India <Link to="/scout/offer-desk">Offer Desk</Link> — the same person, two real
        desks. US HR is its own parallel cluster (Job Vite, not Zwayam) and is not folded into the India desk.
      </p>
    </>
  );
}
