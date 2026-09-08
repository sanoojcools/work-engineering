/** V10-2 FRONTEND: field-pointer claims for Census Evidence.
 *
 * Consumes GET /work-units/{id}/pointers. Does not write pointers, does
 * not resolve files, does not add a table. Guest never calls the API
 * (those 401 without a tenant) and never mints a key.
 *
 * Status on screen is always the resolver's `status`, not the caller's
 * `requested_status`. An unopened pointer is not a fact.
 */
import { useEffect, useMemo, useState } from "react";
import { apiFetch, NeedsApiKeyError } from "./apiFetch";
import { useIsGuest } from "./guestMode";
import { useCompany } from "../company";
import { withClient } from "./withClient";
import { DOCUMENT_CHECK_RECORD } from "./offerDeskWorkRecord";
import type { FieldPointer, Page, PointerStatus, UploadedFileOut, WorkUnit } from "../types";

export const POINTERABLE_FIELDS = [
  "current_condition",
  "desired_condition",
  "context",
  "trigger",
  "inputs",
  "authority",
  "actor_constraints",
  "acceptance_criteria",
  "evidence_required",
  "verification_method",
  "sla_hours",
  "failure_semantics",
] as const;

export type PointerableField = (typeof POINTERABLE_FIELDS)[number];

export const BINDING_FIELDS = new Set<string>([
  "authority",
  "acceptance_criteria",
  "actor_constraints",
]);

/** Customer words. Canon names (observed / declared / …) live in i-buttons. */
export const POINTER_STATUS_PLAIN: Record<PointerStatus, string> = {
  observed: "seen in records",
  declared: "said by a person",
  reconstructed: "pieced together",
  composed: "proposed by us",
  predicted: "predicted by a model",
};

export const FIELD_LABELS: Record<PointerableField, string> = {
  current_condition: "Where it is now",
  desired_condition: "Where it should get to",
  context: "Setting",
  trigger: "What starts it",
  inputs: "What it takes in",
  authority: "Who may decide",
  actor_constraints: "Who may not",
  acceptance_criteria: "What counts as done",
  evidence_required: "Proof a stranger could check",
  verification_method: "How it is checked",
  sla_hours: "How long it may take",
  failure_semantics: "What happens if it fails",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName as PointerableField] ?? fieldName.replace(/_/g, " ");
}

export function isBindingField(fieldName: string): boolean {
  return BINDING_FIELDS.has(fieldName);
}

/** The file actually opened. Broken pointers stay false. */
export function pointerOpened(pointer: FieldPointer | null): boolean {
  return pointer?.resolved === true;
}

/** A fact a stranger could check — not composed, not predicted, not unopened.
 * Binding fields are facts only as declared + quote on an opened cell. */
export function pointerIsFact(pointer: FieldPointer | null, fieldName: string): boolean {
  if (!pointer || !pointer.resolved) return false;
  if (isBindingField(fieldName)) {
    return pointer.status === "declared" && pointer.quote.trim().length > 0;
  }
  return pointer.status === "observed" || pointer.status === "declared" || pointer.status === "reconstructed";
}

/** Plain status for the list/detail. Binding fields never read as a model guess. */
export function plainStatusForDisplay(
  pointer: FieldPointer | null,
  fieldName: string,
  guest: boolean,
): string {
  if (guest) return "Walk-only — not this tenant's records";
  if (!pointer) return "No pointer recorded";
  if (isBindingField(fieldName)) {
    if (pointerIsFact(pointer, fieldName)) return POINTER_STATUS_PLAIN.declared;
    return "cannot open as a binding record";
  }
  return POINTER_STATUS_PLAIN[pointer.status];
}

export type EvidenceClaim = {
  id: string;
  workUnitCode: string;
  workUnitName: string;
  fieldName: string;
  fieldLabel: string;
  isBinding: boolean;
  guest: boolean;
  pointer: FieldPointer | null;
  fileName: string | null;
};

export const GUEST_EVIDENCE_CLAIMS: EvidenceClaim[] = [
  {
    id: "guest-authority",
    workUnitCode: "Walk · document check",
    workUnitName: DOCUMENT_CHECK_RECORD.name,
    fieldName: "authority",
    fieldLabel: FIELD_LABELS.authority,
    isBinding: true,
    guest: true,
    pointer: null,
    fileName: null,
  },
  {
    id: "guest-current",
    workUnitCode: "Walk · document check",
    workUnitName: DOCUMENT_CHECK_RECORD.name,
    fieldName: "current_condition",
    fieldLabel: FIELD_LABELS.current_condition,
    isBinding: false,
    guest: true,
    pointer: null,
    fileName: null,
  },
  {
    id: "guest-evidence",
    workUnitCode: "Walk · document check",
    workUnitName: DOCUMENT_CHECK_RECORD.name,
    fieldName: "evidence_required",
    fieldLabel: FIELD_LABELS.evidence_required,
    isBinding: false,
    guest: true,
    pointer: null,
    fileName: null,
  },
];

export async function listPointers(workUnitId: number): Promise<FieldPointer[]> {
  const page = await apiFetch.get<Page<FieldPointer>>(`/work-units/${workUnitId}/pointers`);
  return page.items;
}

function claimFromPointer(unit: WorkUnit, pointer: FieldPointer, fileName: string | null): EvidenceClaim {
  return {
    id: `${unit.code}-${pointer.field_name}`,
    workUnitCode: unit.code,
    workUnitName: unit.name,
    fieldName: pointer.field_name,
    fieldLabel: fieldLabel(pointer.field_name),
    isBinding: isBindingField(pointer.field_name),
    guest: false,
    pointer,
    fileName,
  };
}

export function useEvidenceClaims() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const unitsPath = isGuest ? null : withClient("/work-units/", keyClientId);
  const filesPath = isGuest ? null : "/files";

  const [units, setUnits] = useState<WorkUnit[]>([]);
  const [files, setFiles] = useState<UploadedFileOut[]>([]);
  const [pointersByUnit, setPointersByUnit] = useState<Record<number, FieldPointer[]>>({});
  const [loading, setLoading] = useState(!isGuest);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
    if (isGuest || !unitsPath || !filesPath) {
      setUnits([]);
      setFiles([]);
      setPointersByUnit({});
      setLoading(false);
      setError(null);
      setNeedsKey(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch.get<Page<WorkUnit>>(unitsPath),
      apiFetch.get<Page<UploadedFileOut>>(filesPath),
    ])
      .then(async ([unitsPage, filesPage]) => {
        if (cancelled) return;
        const unitItems = unitsPage.items;
        const fileItems = filesPage.items;
        const pairs = await Promise.all(
          unitItems.map(async (u) => [u.id, await listPointers(u.id)] as const),
        );
        if (cancelled) return;
        const map: Record<number, FieldPointer[]> = {};
        for (const [id, items] of pairs) map[id] = items;
        setUnits(unitItems);
        setFiles(fileItems);
        setPointersByUnit(map);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
        else setError(err instanceof Error ? err.message : "Could not load claims");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, unitsPath, filesPath, keyClientId]);

  const claims = useMemo(() => {
    if (isGuest) return GUEST_EVIDENCE_CLAIMS;
    const filesById = new Map(files.map((f) => [f.id, f.file_name]));
    const out: EvidenceClaim[] = [];
    for (const unit of units) {
      for (const pointer of pointersByUnit[unit.id] ?? []) {
        if (!(POINTERABLE_FIELDS as readonly string[]).includes(pointer.field_name)) continue;
        const fileName = pointer.file_id != null ? (filesById.get(pointer.file_id) ?? null) : null;
        out.push(claimFromPointer(unit, pointer, fileName));
      }
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }, [isGuest, units, files, pointersByUnit]);

  return { isGuest, claims, loading, error, needsKey, setNeedsKey };
}
