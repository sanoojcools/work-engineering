import { SpecialistDoorCard } from "../components/trianz/SpecialistDoorCard";
import { specialistById } from "../lib/trianzPc";

export default function DeskVendorMgmt() {
  return <SpecialistDoorCard door={specialistById("vendor")} />;
}
