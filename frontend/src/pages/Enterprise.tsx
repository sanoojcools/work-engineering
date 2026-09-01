import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";

const FUNCTIONS = [
  { name: "HR", live: true, to: "/hr" },
  { name: "Finance", live: false, to: null },
  { name: "Legal", live: false, to: null },
  { name: "Operations", live: false, to: null },
];

export default function Enterprise() {
  return (
    <>
      <h2>Enterprise</h2>
      <p className="lede">Only HR is live. The others stay on the map so HR is not the whole company.</p>
      <div className="split" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {FUNCTIONS.map((f) =>
          f.live && f.to ? (
            <Link key={f.name} to={f.to} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <h3>{f.name}</h3>
              <p className="hint">Live</p>
            </Link>
          ) : (
            <div key={f.name} className="card" style={{ opacity: 0.7 }}>
              <h3>{f.name}</h3>
              <p className="hint">Listed</p>
            </div>
          ),
        )}
      </div>
      <IoPanes
        given="Door: Enterprise."
        understood="Functions of a company, not a product catalogue."
        processed="HR is enabled. Others are placeholders."
        output="CHRO map next."
      />
    </>
  );
}
