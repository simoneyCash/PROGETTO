"use client";

import { btn } from "@/components/ui/kit";

// Boundary d'errore a livello di rotta (dentro il guscio). Mostra un messaggio
// pulito + "Riprova" invece dell'errore grezzo di Next.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Qualcosa è andato storto
      </h1>
      <p className="text-sm text-muted">
        Riprova tra un istante. Se il problema continua, ricarica la pagina.
      </p>
      <button type="button" onClick={reset} className={btn.primary}>
        Riprova
      </button>
    </main>
  );
}
