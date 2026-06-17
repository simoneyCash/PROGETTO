"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Mostra il link d'invito completo e lo copia negli appunti. Costruisce l'URL
// con l'origine corrente (window.location.origin), così funziona su qualunque
// dominio (localhost in sviluppo, dominio vero in produzione).
export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const fullUrl = () =>
    typeof window !== "undefined" ? window.location.origin + path : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // se la copia fallisce, l'utente può comunque selezionare il testo
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-300">
        {path}
      </code>
      <button
        type="button"
        onClick={copy}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-400" /> Copiato
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Copia
          </>
        )}
      </button>
    </div>
  );
}
