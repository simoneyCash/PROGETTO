"use client";

import { useState } from "react";
import { Copy, Check } from "@/components/ui/icons";
import { btn } from "@/components/ui/kit";

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
      <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-foreground">
        {path}
      </code>
      <button
        type="button"
        onClick={copy}
        className={`${btn.secondary} shrink-0 px-3 py-2 text-xs`}
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
