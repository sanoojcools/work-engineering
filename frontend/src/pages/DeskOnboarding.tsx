import { SpecialistDoorCard } from "../components/trianz/SpecialistDoorCard";
import { specialistById } from "../lib/trianzPc";

export default function DeskOnboarding() {
  return <SpecialistDoorCard door={specialistById("onboarding")} />;
}
