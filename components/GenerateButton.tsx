"use client";

import { useFormStatus } from "react-dom";
import { Sparkles } from "@/components/ui/icons";
import { btn } from "@/components/ui/kit";

// Pulsante AI con feedback di caricamento: mentre la server action gira (~30s)
// mostra una rotella e si disabilita per evitare doppi invii. useFormStatus
// legge lo stato del <form> genitore. Le etichette sono personalizzabili
// (default = generazione scheda) così lo stesso pulsante serve più automazioni.
export function GenerateButton({
  disabled,
  idleLabel = "Genera bozza con l'AI",
  pendingLabel = "Generazione in corso…",
}: {
  disabled?: boolean;
  idleLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${btn.primary} w-full disabled:cursor-not-allowed`}
    >
      {pending ? (
        <>
          <svg
            className="size-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
            />
          </svg>
          {pendingLabel}
        </>
      ) : (
        <>
          <Sparkles className="size-4" />
          {idleLabel}
        </>
      )}
    </button>
  );
}
