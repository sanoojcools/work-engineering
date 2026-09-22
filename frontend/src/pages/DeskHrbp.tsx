import { SpecialistDoorCard } from "../components/trianz/SpecialistDoorCard";
import { specialistById } from "../lib/trianzPc";

export default function DeskHrbp() {
  return <SpecialistDoorCard door={specialistById("hrbp")} />;
}
