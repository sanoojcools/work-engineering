import { Link } from "react-router-dom";
import { useIsGuest } from "../../lib/guestMode";
import type { TrianzLeader } from "../../lib/trianzPc";

/** One room for every P&C leader. Read-only. Guide answers are not saved. */
export function LeaderRoom({ leader }: { leader: TrianzLeader }) {
  const isGuest = useIsGuest();
  return (
    <div data-testid="leader-room" data-leader={leader.id}>
      <p className="hint" style={{ marginBottom: 4 }}>
        Trianz P&C
      </p>
      <h2 data-testid="leader-room-name">{leader.name}</h2>
      <p className="lede">{leader.role}</p>

      <div className="card" data-testid="leader-portfolio">
        <h3>Portfolio</h3>
        <p style={{ fontSize: 14, marginBottom: 0 }}>{leader.portfolio}</p>
      </div>

      <div className="stack" style={{ gap: 10 }} data-testid="leader-qa">
        {leader.qa.map((item, index) => (
          <div key={item.block} className="card" style={{ margin: 0 }} data-testid={`leader-qa-${index + 1}`}>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
              {item.block}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }} data-testid={`leader-question-${index + 1}`}>
              {item.question}
            </p>
            {item.answer ? (
              <p style={{ fontSize: 14, margin: 0 }} data-testid={`leader-answer-${index + 1}`}>
                {item.answer}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {isGuest && (
        <p className="hint" data-testid="leader-guest">
          Looking only.
        </p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link to="/">← Trianz P&C</Link>
      </p>
    </div>
  );
}
