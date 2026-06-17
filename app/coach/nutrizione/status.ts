// Etichette + stile badge per lo stato di un artefatto (artifact_status).
export const ARTIFACT_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  draft: { label: "Bozza", className: "bg-amber-500/15 text-amber-300" },
  pending_review: {
    label: "In revisione",
    className: "bg-amber-500/15 text-amber-300",
  },
  approved: { label: "Approvato", className: "bg-sky-500/15 text-sky-300" },
  published: {
    label: "Pubblicato",
    className: "bg-emerald-500/15 text-emerald-300",
  },
  archived: {
    label: "Archiviato",
    className: "bg-neutral-700/40 text-neutral-400",
  },
};
