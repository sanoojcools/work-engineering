import { SpecialistDoorCard } from "../components/trianz/SpecialistDoorCard";
import { specialistById } from "../lib/trianzPc";

export default function DeskOffboarding() {
  return <SpecialistDoorCard door={specialistById("offboarding")} />;
}
