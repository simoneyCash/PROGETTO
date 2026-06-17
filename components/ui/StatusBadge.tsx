// Badge di stato presentazionali (server-safe: nessuna interattività).
// Leggono etichetta + colore dalla fonte unica components/ui/status.ts.
import { artifactStatus, checkinStatus, type Gender } from "./status";

const base =
  "inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium";

// Stato di una scheda/piano. gender: "f" scheda (default), "m" piano.
export function ArtifactBadge({
  status,
  gender = "f",
}: {
  status: string;
  gender?: Gender;
}) {
  const { label, className } = artifactStatus(status, gender);
  return <span className={`${base} ${className}`}>{label}</span>;
}

// Stato di un check-in.
export function CheckinBadge({ status }: { status: string }) {
  const { label, className } = checkinStatus(status);
  return <span className={`${base} ${className}`}>{label}</span>;
}
