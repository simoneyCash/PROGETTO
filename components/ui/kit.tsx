import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "@/components/ui/icons";

// =============================================================================
// Coach AI — UI KIT: fonte UNICA di misure, spaziature e componenti.
// Ogni schermata si monta con questi mattoncini, così le voci sono SEMPRE della
// stessa grandezza e allineate. Stile: scuro, minimal, un solo accento viola.
//
// SCALA TIPOGRAFICA (Inter)
//   Titolo schermata   text-2xl font-semibold tracking-tight
//   Etichetta sezione  text-xs font-medium uppercase tracking-wide text-neutral-500
//   Titolo card        text-base/text-lg font-semibold
//   Corpo              text-sm  (neutral-300)
//   Meta / caption     text-xs  (neutral-500)
// SPAZIATURE
//   Pagina   p-6 · max-w-md · min-h-full · gap verticale tra sezioni 28px (gap-7)
//   Card     p-4 (feature p-5) · gap interno 12px (gap-3)
// SUPERFICI
//   Card        border-white/10 bg-white/[0.02]  (hover interattivo: border-white/20)
//   Accento     border-accent/20 bg-accent/[0.06]
// RAGGI  card rounded-2xl · controlli/tasselli rounded-xl · pill/avatar rounded-full
// COLORE  viola = brand/azione · verde = solo "successo" · neutro = tutto il resto
// =============================================================================

// --- Stringhe di stile riutilizzabili ---------------------------------------

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-accent-light to-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-[0_18px_34px_-10px_rgba(231,191,112,0.45)] transition hover:brightness-[1.05] active:brightness-95 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/[0.08] disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-accent transition-colors hover:text-white",
} as const;

export const field =
  "w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-base text-white outline-none backdrop-blur transition-colors placeholder:text-white/35 focus:border-accent focus:ring-1 focus:ring-accent";

// --- Componenti --------------------------------------------------------------

// Contenitore pagina standard (dentro al guscio con barra di navigazione).
// Ritmo verticale uniforme tra le sezioni (gap-7 = 28px).
export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto flex min-h-full w-full max-w-md flex-col gap-7 p-6 ${className}`}
    >
      {children}
    </main>
  );
}

// Link "indietro" coerente (riga sopra l'intestazione).
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-mb-3 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
    >
      ‹ {children}
    </Link>
  );
}

// Intestazione schermata: occhiello (piccolo) + titolo, azione opzionale a dx.
export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs text-neutral-500">{eyebrow}</p>}
        <h1 className="mt-1 truncate font-serif text-3xl font-medium tracking-tight">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

// Etichetta di sezione (uniforme ovunque), con eventuale azione a destra.
export function SectionLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {children}
      </h2>
      {right}
    </div>
  );
}

// Card: presentazionale o cliccabile (se passi href). tone "accent" = card brand.
export function Card({
  children,
  href,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  tone?: "default" | "accent" | "dashed";
  className?: string;
}) {
  const surface =
    tone === "accent"
      ? "border border-accent/25 bg-accent/[0.08]"
      : tone === "dashed"
        ? "border border-dashed border-white/12"
        : "border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_54px_-20px_rgba(0,0,0,0.55)]";
  const hover = href ? "transition-colors hover:border-white/25" : "";
  const base = `rounded-[28px] p-5 backdrop-blur-xl ${surface} ${hover} ${className}`;
  if (href)
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  return <div className={base}>{children}</div>;
}

// Tassello icona standard (size-10). tone: accent (brand) | muted (neutro).
export function IconTile({
  icon: Icon,
  tone = "accent",
  className = "",
}: {
  icon: LucideIcon;
  tone?: "accent" | "muted";
  className?: string;
}) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
        tone === "muted"
          ? "bg-white/[0.06] text-white/55"
          : "bg-accent/12 text-accent"
      } ${className}`}
    >
      <Icon className="size-5" />
    </span>
  );
}

// Stato vuoto coerente.
export function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center">
      {Icon && (
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/5">
          <Icon className="size-6 text-neutral-500" />
        </span>
      )}
      <p className="text-sm text-neutral-400">{children}</p>
    </div>
  );
}

// Banner di esito (success verde / error rosso / info viola).
export function Banner({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-300"
        : "border-accent/30 bg-accent/10 text-accent";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}
    >
      {children}
    </p>
  );
}
