/** T7. Customer label + known filenames for the fabricated offer-desk-inputs
 * pack. Lives here so Census Evidence / markdown export do not pull the
 * embedded files. Do not call these observed traces. */

export const SAMPLE_FABRICATED_LABEL = "Sample — fabricated test pack";

export const SAMPLE_PACK_FILENAMES = [
  "zwayam-candidate-export.csv",
  "zoho-signing-log.csv",
  "uan-service-history-sample.csv",
  "onedrive-placement-log.csv",
  "master-joining-sheet.xlsx",
  "email-id-creation-tracker.xlsx",
  "payroll-report-17th.xlsx",
] as const;

export function isSamplePackFileName(name: string): boolean {
  return (SAMPLE_PACK_FILENAMES as readonly string[]).includes(name);
}
