import { NavLink, Outlet } from "react-router-dom";
import { OrgKeyControl } from "../components/OrgKeyControl";
import { ProgressTracker } from "../components/ProgressTracker";
import { useCompany } from "../company";
import { api } from "../api";

/** Grouped so the two halves of the product read as two halves: what Scout
 * captures, then what the specification layer does with it. As one flat list
 * this was eleven equal-weight links, and Genome had no entry at all — the
 * delivery side of the Scout handoff was reachable only by typing a URL. */
const SECTIONS = [
  { label: null, links: [["/", "Overview"]] },
  {
    label: "Capture",
    links: [
      ["/scout/blast-radius", "Function Scope"],
      ["/scout/interview/new", "Scout Interview"],
      ["/discovery", "Discovery"],
    ],
  },
  {
    label: "Specification",
    links: [["/genome", "Genome"], ["/ontology", "Ontology"], ["/work-units", "Work Units"], ["/work-graph", "Work Graph"]],
  },
  {
    label: "Analysis",
    links: [["/verdict", "VERDICT"], ["/economics", "Economics"], ["/verification", "Verification"], ["/projections", "Projections"]],
  },
  { label: "Integration", links: [["/spec", "Spec API"]] },
] as const;

export default function AppShell() {
  const { clients, client, keyClientId, setClientId, reload } = useCompany();
  // RLS scopes every tenant-read to the key's client, so viewing a different
  // company renders empty tables that look like missing data. Say so instead.
  const keyMismatch = keyClientId !== null && client !== null && client.id !== keyClientId;
  const keyCompany = clients.find((c) => c.id === keyClientId);

  return (
    <div className="shell">
      <nav className="nav">
        <h1>Work Engineering</h1>
        <p>V8 · specification layer</p>
        <label className="company-switch">
          <span>Company</span>
          <select
            value={client?.id ?? ""}
            onChange={(e) => setClientId(Number(e.target.value))}
            aria-label="Company"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.work_unit_count})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="company-new"
          onClick={async () => {
            const name = window.prompt("Company name");
            if (!name?.trim()) return;
            const industry = window.prompt("Industry (optional)") || "";
            const created = await api.post<{ id: number }>("/clients/", { name: name.trim(), industry });
            reload();
            setClientId(created.id);
          }}
        >
          New company
        </button>
        <OrgKeyControl />
        {keyMismatch && keyCompany && (
          <p className="hint" style={{ color: "var(--warn)" }}>
            Your API key belongs to <strong>{keyCompany.name}</strong>, so tenant-scoped pages will look
            empty while <strong>{client?.name}</strong> is selected.{" "}
            <button
              type="button"
              onClick={() => setClientId(keyCompany.id)}
              style={{ padding: "2px 8px", fontSize: 12, marginTop: 4 }}
            >
              Switch to {keyCompany.name}
            </button>
          </p>
        )}
        {!keyMismatch && client?.kind === "catalog" && (
          <p className="hint">Catalog is the test lab. Switch to Client A, then Overview → Prepare Client A HR demo.</p>
        )}
        {SECTIONS.map((section) => (
          <div key={section.label ?? "root"}>
            {section.label && <div className="nav-section">{section.label}</div>}
            {section.links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="workspace">
        <ProgressTracker />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
