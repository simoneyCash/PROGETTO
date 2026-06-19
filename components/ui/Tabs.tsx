"use client";

// Linguette client-side: passa il contenuto già renderizzato lato server come
// `content` (anche con <form action={serverAction}> dentro: Next supporta i
// nodi RSC come prop di un componente client). Lo switch è istantaneo, niente
// navigazione. Il tab iniziale arriva da `defaultTab` (di solito derivato dai
// searchParams della pagina, così dopo un salvataggio si atterra sul tab giusto).
import { useState, type ReactNode } from "react";

export type TabDef = { key: string; label: string; content: ReactNode };

export function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: TabDef[];
  defaultTab?: string;
}) {
  const initial = tabs.some((t) => t.key === defaultTab)
    ? (defaultTab as string)
    : tabs[0]?.key;
  const [active, setActive] = useState(initial);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      {/* La barra estende la linea di fondo a tutta la larghezza della main (p-6). */}
      <div
        role="tablist"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4"
      >
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={`relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors ${
                on
                  ? "text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {on && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-6">{current?.content}</div>
    </div>
  );
}
