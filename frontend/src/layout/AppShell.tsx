import { NavLink, Outlet } from "react-router-dom";
import { ProgressTracker } from "../components/ProgressTracker";
import { useCompany } from "../company";
import { api } from "../api";

const links = [
  ["/", "Overview"],
  ["/ontology", "Ontology"],
  ["/work-units", "Work Units"],
  ["/work-graph", "Work Graph"],
  ["/verdict", "VERDICT"],
  ["/economics", "Economics"],
  ["/discovery", "Discovery"],
  ["/verification", "Verification"],
  ["/spec", "Spec API"],
  ["/projections", "Projections"],
] as const;

export default function AppShell() {
  const { clients, client, setClientId, reload } = useCompany();

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
        {client?.kind === "catalog" && (
          <p className="hint">Catalog is the test lab. Switch to Client A, then Overview → Prepare Client A HR demo.</p>
        )}
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            {label}
          </NavLink>
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
