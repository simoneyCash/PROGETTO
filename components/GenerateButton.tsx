"use client";

import { useFormStatus } from "react-dom";

// Pulsante "Genera bozza" con feedback di caricamento: mentre la server action
// gira (~30s) mostra una rotella e "Generazione in corso…", e si disabilita per
// evitare doppi invii. useFormStatus legge lo stato del <form> genitore.
export function GenerateButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-2.5 font-medium text-emerald-300 hover:bg-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <svg
            className="h-4 w-4 animate-spin"
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
          Generazione in corso…
        </>
      ) : (
        "✨ Genera bozza con l'AI"
      )}
    </button>
  );
}
