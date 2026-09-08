/** V10 customer words. Canon names only in i-buttons. Do not invent terms. */

export const V10 = {
  pieceOfWork: {
    label: "Piece of work",
    term: "Work Unit",
    simple: "One small piece of work with a clear start and finish.",
    technical: "Work Unit — 18 contract attributes including authority, acceptance, evidence, verification.",
  },
  sittingComplete: {
    label: "How complete is this sitting",
    term: "Completeness",
    simple: "Every cell in the grid has something in it. Not the same as good enough in the files.",
    technical: "Scout session completeness_pct across the seven captured dimensions. Independent of GQS.",
  },
  saveDraft: {
    label: "Save as a draft of the work record",
    term: "Genome import + GQS",
    simple: "Turns this sitting into a draft. Talk-only drafts usually do not pass.",
    technical: "POST /scout/sessions/{id}/generate-genome uses existing import_genome. GQS gate; talk-only is declared provenance.",
  },
  filesNotEnough: {
    label: "Not enough in the files yet (talk-only). Needs a pass of 90.",
    term: "GQS",
    simple: "Quality gate on the draft. Sitting completeness can be 100% and this still fails. That is intended.",
    technical: "Genome Quality Score. Threshold 90. Observed% weights declared sittings under the gate.",
  },
  workRecord: {
    label: "Work record (draft)",
    term: "Genome",
    simple: "The set of pieces of work for this journey.",
    technical: "GenomeVersion produced by generate-genome / import_genome.",
  },
  draftPreview: {
    label: "What this sitting would add",
    term: "Future Preview",
    simple: "A locked look at the draft until the sitting is complete enough.",
    technical: "GET /scout/sessions/{id}/future-preview. Unlocks at 100% completeness.",
  },
  grid: {
    label: "Pieces captured",
    term: "Work Capture Grid",
    simple: "The table of pieces from this sitting.",
    technical: "scout_captured_units for this session.",
  },
  questions: {
    label: "Questions for this sitting",
    term: "Scout",
    simple: "The questions we ask in this seat. They are a fixed list, not an AI interviewer.",
    technical: "DiscoveryPartner QUESTION_BANK — hand-written, mapped in packs/hr/question_bank.yaml.",
  },
} as const;
