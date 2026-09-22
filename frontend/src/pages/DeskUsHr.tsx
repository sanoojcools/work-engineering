import { SpecialistDoorCard } from "../components/trianz/SpecialistDoorCard";
import { specialistById } from "../lib/trianzPc";

export default function DeskUsHr() {
  return <SpecialistDoorCard door={specialistById("us-hr")} />;
}
