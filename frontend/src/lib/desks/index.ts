/** Registry of every desk in the HR family (HR-FAMILY v0). One entry per
 * desk sitting -- Offer Desk (adapted, not re-parsed) plus the five new
 * desks parsed from desks/*.xlsx. Used by HrOps.tsx, the desk-walk pages,
 * and the HR Function Work Graph so none of them hardcode a second list
 * that could drift from this one. */
import { HRBP_SPEC } from "./hrbp";
import { OFFBOARDING_SPEC } from "./offboarding";
import { OFFER_DESK_SPEC } from "./offerDesk";
import { ONBOARDING_SPEC } from "./onboarding";
import type { DeskSpec } from "./types";
import { US_HR_SPEC } from "./usHr";
import { VENDOR_MGMT_SPEC } from "./vendorMgmt";

export const ALL_DESKS: DeskSpec[] = [
  OFFER_DESK_SPEC,
  ONBOARDING_SPEC,
  OFFBOARDING_SPEC,
  VENDOR_MGMT_SPEC,
  US_HR_SPEC,
  HRBP_SPEC,
];

export const DESKS_BY_ID: Record<string, DeskSpec> = Object.fromEntries(ALL_DESKS.map((d) => [d.id, d]));

export {
  HRBP_SPEC,
  OFFBOARDING_SPEC,
  OFFER_DESK_SPEC,
  ONBOARDING_SPEC,
  US_HR_SPEC,
  VENDOR_MGMT_SPEC,
};
export type { DeskHandoff, DeskSpec, DeskStatus, DeskStep } from "./types";
