import type { Viewport } from "next";
import { BottomNav } from "@/components/ui/BottomNav";

// Status bar chiara per l'area cliente (override del tema scuro globale).
export const viewport: Viewport = { themeColor: "#f5f6f8" };

// Guscio dell'area cliente: TEMA CHIARO (consumer). Lo scope `.theme-cliente`
// ridefinisce i token solo qui dentro; il coach resta scuro. Contenuto
// scorrevole + barra di navigazione in basso (in flusso, non copre il contenuto).
export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-cliente flex h-dvh flex-col bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <BottomNav variant="cliente" />
    </div>
  );
}
