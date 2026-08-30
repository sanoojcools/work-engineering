import { Route, Routes } from "react-router-dom";
import { GuidedTour } from "./components/GuidedTour";
import AppShell from "./layout/AppShell";
import Discovery from "./pages/Discovery";
import Economics from "./pages/Economics";
import Genome from "./pages/Genome";
import Ontology from "./pages/Ontology";
import Overview from "./pages/Overview";
import Projections from "./pages/Projections";
import ScoutInterview from "./pages/ScoutInterview";
import Spec from "./pages/Spec";
import Verdict from "./pages/Verdict";
import Verification from "./pages/Verification";
import WorkGraph from "./pages/WorkGraph";
import WorkUnits from "./pages/WorkUnits";

export default function App() {
  return (
    <>
      <GuidedTour />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/ontology" element={<Ontology />} />
          <Route path="/work-units" element={<WorkUnits />} />
          <Route path="/work-graph" element={<WorkGraph />} />
          <Route path="/verdict" element={<Verdict />} />
          <Route path="/economics" element={<Economics />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/spec" element={<Spec />} />
          <Route path="/projections" element={<Projections />} />
          <Route path="/scout/interview/:sessionId" element={<ScoutInterview />} />
          <Route path="/genome/:versionId" element={<Genome />} />
        </Route>
      </Routes>
    </>
  );
}
