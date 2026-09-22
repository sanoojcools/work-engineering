import { Link } from "react-router-dom";
import { TRIANZ_LEADERS } from "../../lib/trianzPc";

/** Home company frame. Leader names and specialist doors. Guide copy stays on the room. */
export function TrianzStrip() {
  return (
    <section data-testid="trianz-pc" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 10 }}>Trianz P&C</h3>
      <div className="stack" style={{ gap: 10 }}>
        {TRIANZ_LEADERS.map((leader) => (
          <div key={leader.id} className="card" data-testid={`leader-strip-${leader.id}`} style={{ margin: 0 }}>
            <p style={{ margin: leader.doors.length ? "0 0 8px" : 0, fontSize: 15 }}>
              <Link to={`/trianz/${leader.id}`} data-testid={`leader-link-${leader.id}`}>
                {leader.name}
              </Link>
              {" — "}
              {leader.role}
            </p>
            {leader.doors.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13 }}>
                {leader.doors.map((door) =>
                  door.to ? (
                    <Link key={door.label} to={door.to}>
                      {door.label}
                    </Link>
                  ) : (
                    <span key={door.label} data-testid="no-specialist-sheet">
                      {door.label}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
