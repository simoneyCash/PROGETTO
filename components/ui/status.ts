// =============================================================================
// Coach AI — Fonte UNICA per etichette + stile dei badge di stato.
// Consolida le logiche prima sparse: app/coach/checkin/status.ts,
// app/coach/nutrizione/status.ts e le mappe inline in clienti/[id] e programmi/[id].
//
// Nota sul GENERE: l'enum artifact_status etichetta soggetti grammaticali diversi —
// la "scheda/versione" è femminile (Approvata), il "piano" nutrizione è maschile
// (Approvato). Per questo l'etichetta è parametrizzata e NON appiattita.
// I colori codificano significato, non sequenza.
// =============================================================================

export type StatusStyle = { label: string; className: string };
export type Gender = "f" | "m";

const AMBER = "bg-amber-500/15 text-amber-300";
const SKY = "bg-sky-500/15 text-sky-300";
const EMERALD = "bg-emerald-500/15 text-emerald-300";
const NEUTRAL = "bg-neutral-700/40 text-neutral-400";

const ARTIFACT: Record<string, { f: string; m: string; className: string }> = {
  draft: { f: "Bozza", m: "Bozza", className: AMBER },
  pending_review: { f: "In revisione", m: "In revisione", className: AMBER },
  approved: { f: "Approvata", m: "Approvato", className: SKY },
  published: { f: "Pubblicata", m: "Pubblicato", className: EMERALD },
  archived: { f: "Archiviata", m: "Archiviato", className: NEUTRAL },
};

// Stato di un artefatto (scheda/piano). gender: "f" scheda (default), "m" piano.
export function artifactStatus(status: string, gender: Gender = "f"): StatusStyle {
  const it = ARTIFACT[status];
  if (!it) return { label: status || "—", className: NEUTRAL };
  return { label: gender === "m" ? it.m : it.f, className: it.className };
}

// Back-compat: record maschile per la nutrizione (= "piano").
export const ARTIFACT_STATUS: Record<string, StatusStyle> = Object.fromEntries(
  Object.keys(ARTIFACT).map((k) => [k, artifactStatus(k, "m")]),
);

const CHECKIN: Record<string, StatusStyle> = {
  scheduled: { label: "Programmato", className: AMBER },
  sent: { label: "Inviato", className: SKY },
  answered: { label: "Risposto", className: EMERALD },
  skipped: { label: "Saltato", className: NEUTRAL },
};

// Back-compat per i consumatori esistenti dei check-in.
export const CHECKIN_STATUS = CHECKIN;

// Stato di un check-in.
export function checkinStatus(status: string): StatusStyle {
  return CHECKIN[status] ?? { label: status || "—", className: NEUTRAL };
}
