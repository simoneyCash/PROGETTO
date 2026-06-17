// Etichette + stile badge per lo stato di un check-in.
// (scheduled | sent | answered | skipped — vedi commento sulla tabella checkins)
export const CHECKIN_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  scheduled: { label: "Programmato", className: "bg-amber-500/15 text-amber-300" },
  sent: { label: "Inviato", className: "bg-sky-500/15 text-sky-300" },
  answered: { label: "Risposto", className: "bg-emerald-500/15 text-emerald-300" },
  skipped: { label: "Saltato", className: "bg-neutral-700/40 text-neutral-400" },
};
