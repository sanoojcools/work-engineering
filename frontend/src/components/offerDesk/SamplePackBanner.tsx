import {
  PREWORK_DESK,
  PREWORK_SPOC,
  PREWORK_START,
  PREWORK_STOP,
  PREWORK_SYSTEMS,
  SAMPLE_PACK_BANNER,
} from "../../lib/demoSampleSeats";

export function SamplePackBanner({ facts = false }: { facts?: boolean }) {
  return (
    <div className="banner info" style={{ marginBottom: 12 }}>
      <p style={{ margin: 0 }} data-testid="sample-pack-banner">
        {SAMPLE_PACK_BANNER}
      </p>
      {facts && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 14 }}>
          <li>This desk: {PREWORK_DESK}</li>
          <li>{PREWORK_SPOC}</li>
          <li>Start: {PREWORK_START}</li>
          <li>Stop: {PREWORK_STOP}</li>
          <li>Systems: {PREWORK_SYSTEMS}</li>
        </ul>
      )}
    </div>
  );
}
