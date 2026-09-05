import { apiFetch } from "./apiFetch";
import pack from "./offerDeskEvidencePack.json";

/** offer-desk-inputs/ — the fabricated (invented candidates, invented
 * transcripts, invented system-of-record exports) evidence set built to
 * prove the observed-evidence path works end to end, not Rashmi's real
 * production data. See offer-desk-inputs/README.md. This module embeds the
 * same 7 files and the same 11-unit genome that batch already proved clears
 * GQS (92.73/90) via a real HTTP round trip, so this page can reproduce
 * that proof live instead of only asserting it happened once, off to the
 * side, during development. */

type PackFile = { originalFileId: string; fileName: string; kind: "csv" | "xlsx"; content: string };
type PackData = { files: PackFile[]; genome: Record<string, unknown> };
const DATA = pack as unknown as PackData;

export type UploadedEvidenceFile = { file_id: string; sha256: string; file_name: string; size: number };

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function fileFromPack(f: PackFile): File {
  if (f.kind === "csv") {
    return new File([f.content], f.fileName, { type: "text/csv" });
  }
  const bytes = base64ToBytes(f.content);
  return new File([bytes], f.fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export const EVIDENCE_FILE_NAMES = DATA.files.map((f) => f.fileName);

/** Uploads all 7 files for real through POST /files/upload — server-computed
 * sha256 each time, not the original batch's recorded hashes (those should
 * match, since the bytes are identical, but nothing here trusts that; the
 * genome rewrite below uses whatever this tenant's upload actually returns). */
export async function uploadEvidencePack(
  onProgress?: (fileName: string, done: number, total: number) => void,
): Promise<Map<string, UploadedEvidenceFile>> {
  const byOriginalFileId = new Map<string, UploadedEvidenceFile>();
  let done = 0;
  for (const f of DATA.files) {
    const form = new FormData();
    form.append("file", fileFromPack(f));
    const uploaded = await apiFetch.postForm<UploadedEvidenceFile>("/files/upload", form);
    byOriginalFileId.set(f.originalFileId, uploaded);
    done += 1;
    onProgress?.(f.fileName, done, DATA.files.length);
  }
  return byOriginalFileId;
}

/** Rewrites the embedded genome's per-unit provenance.file_id/hash_sha256 to
 * point at THIS tenant's freshly uploaded files (the original batch's file
 * ids, e.g. "41", only ever existed in a throwaway tenant used to prove this
 * once — they mean nothing here). A unit the original batch left `declared`
 * (no file backs it) stays declared; nothing is upgraded that wasn't
 * genuinely re-uploaded. */
export function buildGenomePayload(byOriginalFileId: Map<string, UploadedEvidenceFile>): Record<string, unknown> {
  const genome = structuredClone(DATA.genome) as { work_units: Array<Record<string, any>> };
  for (const wu of genome.work_units) {
    const prov = wu.provenance as Record<string, unknown>;
    const originalFileId = prov.file_id as string | null;
    if (!originalFileId) continue;
    const fresh = byOriginalFileId.get(originalFileId);
    if (!fresh) continue;
    prov.file_id = fresh.file_id;
    prov.hash_sha256 = fresh.sha256;
  }
  return genome as unknown as Record<string, unknown>;
}

export function packDisclaimer(): string {
  const d = DATA.genome._disclaimer;
  return typeof d === "string" ? d : "";
}
