import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "@/components/ui/icons";

// =============================================================================
// Coach AI — UI KIT: fonte UNICA di misure, spaziature e componenti.
// Ogni schermata si monta con questi mattoncini, così le voci sono SEMPRE della
// stessa grandezza e allineate.
//
// IDENTITÀ "Linear" base scura + ACCENTO VERDE energia (premium, animata).
//   Colore   accento = verde elettrico (bg-accent/text-accent, CTA/progressi/attivo)
//            azione primaria = btn.primary (verde+glow) · neutra = btn.secondary (chiaro)
//            testo: foreground / muted / faint · success=verde · error=rosso
//   Motion   ricca (Framer Motion): vedi components/ui/motion.tsx (Reveal/Stagger/
//            TapScale/AnimatedNumber/ProgressRing) + PageTransition + Confetti.
//   Font     UI/testo = Inter (font-sans) · dati mono = Berkeley→ui-monospace (font-mono)
//
// SCALA TIPOGRAFICA (Inter, pesi 300/510/590)
//   Titolo schermata   text-3xl font-semibold tracking-tight
//   Etichetta sezione  text-xs font-medium uppercase tracking-wide text-muted
//   Titolo card        text-base/text-lg font-semibold
//   Corpo              text-sm  (foreground/muted)
//   Meta / caption     text-xs  (faint)
// SPAZIATURE (base 8px — solo multipli di 8; controlli 12px per ergonomia touch)
//   Pagina   p-4 (16px) · max-w-md · min-h-full · gap tra sezioni 24px (gap-6)
//   Card     p-4 (16px) · gap interno 12px (gap-3)
// SUPERFICI  card = bg-surface-1 + border-border (hairline) + shadow-card
// RAGGI  card rounded-xl (12px) · input rounded-md (6px) · tasselli rounded-lg (8px) · pill rounded-full
// ICONE (Solar linear) — misure COERENTI ovunque, mai a caso:
//   size-4 (16px)  meta inline · chevron · icona dentro a una riga di testo
//   size-5 (20px)  navigazione · tasselli strumenti (IconTile) · icone nei bottoni
//   size-6 (24px)  feature/azione grande · illustrazione empty-state
// PRIMITIVE LISTE/DATI  Row (riga lista: leading→titolo/sottotitolo→trailing) ·
//   Stat (KPI: numero grande + label) · Avatar (iniziali). Le liste si fanno con Row.
// =============================================================================

// --- Stringhe di stile riutilizzabili ---------------------------------------

export const btn = {
  // Azione primaria: VERDE energia + glow + feedback al tocco (active:scale).
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-fg shadow-[0_10px_30px_-8px_var(--accent-glow)] transition-[transform,background-color,box-shadow] duration-150 hover:bg-accent-hover hover:shadow-[0_16px_44px_-8px_var(--accent-glow)] active:scale-[0.97] disabled:opacity-50",
  // Azione secondaria: superficie glass neutra + bordo hairline.
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/[0.05] px-4 py-3 text-sm font-medium text-foreground transition-[transform,background-color] duration-150 hover:bg-white/[0.08] active:scale-[0.98] disabled:opacity-50",
  // Link/azione terziaria: testo verde.
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-accent transition-colors hover:text-accent-hover",
} as const;

// Campo di input. 16px (text-[16px]) per NON far zoomare iOS al focus
// (text-base ora vale 14px). Raggio 6px (rounded-md) come da DESIGN.md.
export const field =
  "w-full rounded-md border border-border bg-white/[0.03] px-3.5 py-3 text-[16px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-white/20 focus:ring-2 focus:ring-ring";

// --- Componenti --------------------------------------------------------------

// Contenitore pagina standard (dentro al guscio con barra di navigazione).
// Ritmo verticale uniforme tra le sezioni (gap-6 = 24px).
export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto flex min-h-full w-full max-w-md flex-col gap-6 p-4 ${className}`}
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
      className="-mb-3 text-sm text-muted transition-colors hover:text-foreground"
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
        {eyebrow && <p className="text-xs text-faint">{eyebrow}</p>}
        <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
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
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
        {children}
      </h2>
      {right}
    </div>
  );
}

// Card: presentazionale o cliccabile (se passi href). tone "accent" = card
// neutra leggermente più chiara (niente colore d'accento).
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
      ? "border border-accent/25 bg-accent/[0.07]"
      : tone === "dashed"
        ? "border border-dashed border-border"
        : "border border-border bg-surface-1 shadow-card";
  const hover = href
    ? "transition-[transform,border-color] duration-150 hover:border-white/20 active:scale-[0.99]"
    : "";
  const base = `rounded-xl p-4 ${surface} ${hover} ${className}`;
  if (href)
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  return <div className={base}>{children}</div>;
}

// Tassello icona standard (size-10). tone: accent (in evidenza) | muted (neutro).
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
      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
        tone === "muted"
          ? "bg-white/[0.05] text-muted"
          : "bg-accent/15 text-accent"
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
    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
      {Icon && (
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-white/5">
          <Icon className="size-6 text-muted" />
        </span>
      )}
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

// Banner di esito (success verde / error rosso / info neutro).
export function Banner({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "error"
        ? "border-error/30 bg-error/10 text-error"
        : "border-border bg-white/[0.04] text-foreground";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${cls}`}
    >
      {children}
    </p>
  );
}

// Iniziali da un nome completo (max 2 lettere). Usato dagli Avatar.
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

// Avatar a iniziali, coerente ovunque. size: md (size-9, default) | sm (size-8).
export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={`flex ${
        size === "sm" ? "size-8" : "size-9"
      } shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-muted ${className}`}
    >
      {initials(name)}
    </span>
  );
}

// KPI compatto: numero grande (tabular) + etichetta. Per le strisce di sintesi
// in cima alla dashboard. tone "accent" lo evidenzia leggermente.
export function Stat({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: "default" | "accent";
}) {
  const cls = `flex flex-col rounded-xl border p-3.5 ${
    tone === "accent"
      ? "border-accent/30 bg-accent/10"
      : "border-border bg-surface-1"
  } ${href ? "transition-[transform,border-color] duration-150 hover:border-white/20 active:scale-[0.99]" : ""}`;
  const body = (
    <>
      <span className="text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </span>
      <span className="mt-0.5 text-xs text-muted">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// Riga lista universale: [leading] titolo + sottotitolo opzionale [trailing].
// Standardizza TUTTE le liste (clienti, to-do, voci) → stessa altezza/icone.
// leading: passa un <IconTile>, <Avatar> o un'icona. trailing: chevron o valore.
export function Row({
  href,
  leading,
  title,
  subtitle,
  trailing,
  className = "",
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const cls = `flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-3 py-3 ${
    href
      ? "transition-[transform,border-color] duration-150 hover:border-white/20 active:scale-[0.99]"
      : ""
  } ${className}`;
  const body = (
    <>
      {leading != null && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {title}
        </span>
        {subtitle != null && (
          <span className="mt-0.5 block truncate text-xs text-muted">
            {subtitle}
          </span>
        )}
      </span>
      {trailing != null && (
        <span className="flex shrink-0 items-center gap-2 text-muted">
          {trailing}
        </span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
