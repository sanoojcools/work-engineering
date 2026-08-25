import { Link } from "react-router-dom";
import { useCompany } from "../company";

export function CompanyBanner() {
  const { client } = useCompany();
  if (!client) return null;
  const catalog = client.kind === "catalog";
  return (
    <p className={catalog ? "banner warn" : "banner ok"} style={{ marginBottom: 16 }}>
      Viewing <strong>{client.name}</strong>
      {catalog
        ? " — test lab. Mixed samples. Not a client census. Switch to Client A to demo one employer × HR."
        : " — one employer. Numbers on this page are this company only. VERDICT and hours may still be inferred drafts."}
      {" "}
      <Link to="/">Overview</Link>
    </p>
  );
}
