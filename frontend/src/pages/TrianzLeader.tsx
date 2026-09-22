import { useParams } from "react-router-dom";
import { LeaderRoom } from "../components/trianz/LeaderRoom";
import { leaderById } from "../lib/trianzPc";
import NotFound from "./NotFound";

export default function TrianzLeader() {
  const { leaderId } = useParams();
  const leader = leaderById(leaderId);
  if (!leader) return <NotFound />;
  return <LeaderRoom leader={leader} />;
}
