import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Empty } from "../ui";

/** Without this every unmatched URL rendered a blank white page — no heading,
 * no navigation, no way back except editing the address bar. `/scout` did it
 * (the real route is `/scout/interview/:sessionId`), and so did any typo.
 * Rendered inside AppShell so the sidebar is still there. */
export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div>
      <h2>Page not found</h2>
      <Empty
        title={`Nothing is routed at ${pathname}`}
        hint={
          <>
            Use the navigation on the left, or go back to the{" "}
            <Link to="/">Overview</Link>. To start a capture session, open{" "}
            <Link to="/scout/interview/new">Scout Interview</Link>.
          </>
        }
      />
    </div>
  );
}
