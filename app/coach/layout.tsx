import { BottomNav } from "@/components/ui/BottomNav";

// Guscio dell'area coach: contenuto scorrevole + barra di navigazione in basso
// (in flusso, non "fixed": il contenuto non finisce mai sotto la barra).
export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <BottomNav variant="coach" />
    </div>
  );
}
