import { BottomNav } from "@/components/ui/BottomNav";

// Guscio dell'area cliente: stessa struttura del coach (contenuto scorrevole +
// navigazione in basso).
export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <BottomNav variant="cliente" />
    </div>
  );
}
