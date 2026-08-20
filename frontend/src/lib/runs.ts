import { api } from "../api";

export function preferOnb04<T extends { code: string }>(items: T[]): T | undefined {
  return items.find((u) => u.code === "WU-ONB-04") ?? items[0];
}

export function isPromotionFriction(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("verification") || text.includes("one level") || text.includes("pass rate");
}

export async function bulkCreatePassingRuns(workUnitId: number, count = 5): Promise<void> {
  for (let i = 1; i <= count; i += 1) {
    await api.post("/verification/runs", {
      work_unit_id: workUnitId,
      method: "deterministic_rule",
      independent: true,
      outcome: "passed",
      evidence_ref: `MSG-${100 + i}`,
      notes: `Bulk passing run ${i}/${count}`,
    });
  }
}

export function passedCountFor(runs: { work_unit_id: number; outcome: string }[], workUnitId: number): number {
  return runs.filter((r) => r.work_unit_id === workUnitId && r.outcome === "passed").length;
}

export function simpleDeny(reason: string, expectedApprover: string): string {
  const text = reason.toLowerCase();
  if (text.includes("authority") || text.includes("approver")) {
    return `You used the wrong approver. This work needs ${expectedApprover || "HR Ops SPOC"}, not Order Desk.`;
  }
  if (text.includes("evidence")) {
    return "You left proof empty. Add MSG-123 (or the evidence the contract asks for).";
  }
  if (text.includes("pre-state") || text.includes("condition")) {
    return "Object is not ready to START. Paste the Current Condition from the Work Unit into Object state.";
  }
  if (text.includes("desired")) {
    return "Object is not DONE. Paste the Desired Condition from the Work Unit into Object state.";
  }
  return reason;
}
