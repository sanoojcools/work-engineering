import { Link } from "react-router-dom";
import type { SpecialistDoor } from "../../lib/trianzPc";

/** One card. Desk name, boss, and the sheet line. No steps and no hours. */
export function SpecialistDoorCard({ door }: { door: SpecialistDoor }) {
  return (
    <div data-testid="specialist-door">
      <p className="hint" style={{ marginBottom: 4 }}>
        Trianz P&C
      </p>
      <div className="card" data-testid="specialist-card">
        <h2 data-testid="specialist-name" style={{ marginTop: 0 }}>
          {door.name}
        </h2>
        <p style={{ fontSize: 15, margin: "0 0 8px" }} data-testid="specialist-boss">
          {door.boss}
        </p>
        <p style={{ fontSize: 14, margin: 0 }} data-testid="specialist-status">
          Sheet exists. Not sat here.
        </p>
      </div>
      <p style={{ marginTop: 20 }}>
        <Link to="/">← Trianz P&C</Link>
      </p>
    </div>
  );
}
