import {
  PREWORK_DESK,
  PREWORK_SPOC,
  PREWORK_START,
  PREWORK_STOP,
  PREWORK_SYSTEMS,
  SAMPLE_PACK_BANNER,
} from "../../lib/demoSampleSeats";

export function PreworkCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="prework-card">
      <div className="banner info" style={{ marginBottom: 12 }} data-testid="sample-pack-banner">
        {SAMPLE_PACK_BANNER}
      </div>
      <h3 style={{ marginTop: 0 }}>Pre-work</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        From Rashmi&apos;s Offer Desk sitting. Not a named leader.
      </p>
      <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 14 }}>
        <li>This desk: {PREWORK_DESK}</li>
        <li>{PREWORK_SPOC}</li>
        <li>Start: {PREWORK_START}</li>
        <li>Stop: {PREWORK_STOP}</li>
        <li>Systems: {PREWORK_SYSTEMS}</li>
      </ul>
      <button type="button" className="primary" onClick={onStart} data-testid="prework-start">
        Start sitting
      </button>
    </div>
  );
}
