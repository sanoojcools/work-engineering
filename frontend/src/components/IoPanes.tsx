/** Four-pane playback used on every V9 screen. */
export function IoPanes({
  given,
  understood,
  processed,
  output,
}: {
  given: string;
  understood: string;
  processed: string;
  output: string;
}) {
  const cells = [
    ["Given", given],
    ["How we understand it", understood],
    ["What the platform does", processed],
    ["Output you can see", output],
  ];
  return (
    <div
      className="split"
      style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}
    >
      {cells.map(([h, b]) => (
        <div key={h} className="card" style={{ margin: 0 }}>
          <div className="hint" style={{ marginTop: 0, fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>
            {h}
          </div>
          <p style={{ fontSize: 13, margin: 0 }}>{b}</p>
        </div>
      ))}
    </div>
  );
}
