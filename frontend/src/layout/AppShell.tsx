import { NavLink, Outlet } from "react-router-dom";
import { ProgressTracker } from "../components/ProgressTracker";

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
  return (
    <div className="shell">
      <nav className="nav">
        <h1>Work Engineering</h1>
        <p>V8 · specification layer</p>
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
