import { Navigate, Route, Routes } from "react-router-dom";
import { GuidedTour } from "./components/GuidedTour";
import AppShell from "./layout/AppShell";
import BlastRadius from "./pages/BlastRadius";
import Discovery from "./pages/Discovery";
import Economics from "./pages/Economics";
import Enterprise from "./pages/Enterprise";
import Genome from "./pages/Genome";
import GenomeVersions from "./pages/GenomeVersions";
import HrMap from "./pages/HrMap";
import HrOps from "./pages/HrOps";
import NotFound from "./pages/NotFound";
import OfferDesk from "./pages/OfferDesk";
import OfferDeskFunctionLeader from "./pages/OfferDeskFunctionLeader";
import OfferDeskPlayback from "./pages/OfferDeskPlayback";
import OfferDeskRashmi from "./pages/OfferDeskRashmi";
import OfferDeskSaveTalkOnly from "./pages/OfferDeskSaveTalkOnly";
import OfferDeskSheet from "./pages/OfferDeskSheet";
import OfferDeskSubFunctionLead from "./pages/OfferDeskSubFunctionLead";
import Ontology from "./pages/Ontology";
import Overview from "./pages/Overview";
import Projections from "./pages/Projections";
import ScoutInterview from "./pages/ScoutInterview";
import Spec from "./pages/Spec";
import Start from "./pages/Start";
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
          <Route path="/" element={<Start />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/hr" element={<HrMap />} />
          <Route path="/hr/operations" element={<HrOps />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/ontology" element={<Ontology />} />
          <Route path="/work-units" element={<WorkUnits />} />
          <Route path="/work-graph" element={<WorkGraph />} />
          <Route path="/verdict" element={<Verdict />} />
          <Route path="/economics" element={<Economics />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/scout/blast-radius" element={<BlastRadius />} />
          <Route path="/scout/offer-desk" element={<OfferDesk />} />
          <Route path="/scout/offer-desk/function-leader" element={<OfferDeskFunctionLeader />} />
          <Route path="/scout/offer-desk/sub-function-lead" element={<OfferDeskSubFunctionLead />} />
          <Route path="/scout/offer-desk/rashmi" element={<OfferDeskRashmi />} />
          <Route path="/scout/offer-desk/playback" element={<OfferDeskPlayback />} />
          <Route path="/scout/offer-desk/sheet" element={<OfferDeskSheet />} />
          <Route path="/scout/offer-desk/save-talk-only" element={<OfferDeskSaveTalkOnly />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/spec" element={<Spec />} />
          <Route path="/projections" element={<Projections />} />
          <Route path="/scout/interview/:sessionId" element={<ScoutInterview />} />
          <Route path="/scout" element={<Navigate to="/scout/interview/new" replace />} />
          <Route path="/scout/interview" element={<Navigate to="/scout/interview/new" replace />} />
          <Route path="/genome" element={<GenomeVersions />} />
          <Route path="/genome/:versionId" element={<Genome />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
