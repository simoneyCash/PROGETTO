import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "@/components/ui/icons";
import { Check } from "@/components/ui/icons";

// =============================================================================
// APP CLIENTE — UI KIT "consumer" (tema chiaro). Fonte UNICA dei mattoncini
// dell'app atleta. Indipendente dal kit del coach: qui tutto è pensato per il
// CHIARO (superfici bianche, ombre morbide reali, raggi ampi, palette dati).
//
// Va usato SOLO dentro l'area cliente (guscio .theme-cliente), dove i token
// (bg-surface-1, text-foreground/muted, border-border, text-accent…) sono chiari.
//
// LINGUAGGIO
//   Superfici  card = bg-surface-1 + shadow-soft, raggio ampio (rounded-3xl, 24px)
//   Tipografia titolo schermata 28px extrabold · sezione 15px bold · corpo 14-15px
//   Colore     azione/attivo = verde accento · dati = palette --c-* (blu/teal/viola/ambra)
//   Spazi      pagina px-4, gap-6 tra sezioni · card p-5
//   Tocco      controlli ≥44px, input 16px (anti-zoom iOS)
// =============================================================================

// --- Stringhe di stile riutilizzabili ---------------------------------------

export const cbtn = {
  // Azione primaria piena: verde + glow morbido.
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-[15px] font-semibold text-accent-fg shadow-[0_10px_28px_-10px_var(--accent-glow)] transition-[transform,background-color] duration-150 hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50",
  // Azione secondaria: card bianca con bordo + ombra morbida.
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface-1 px-5 py-3.5 text-[15px] font-semibold text-foreground shadow-[var(--shadow-soft)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50",
  // Pillola tenue verde (azione terziaria / link forte).
  soft: "inline-flex items-center justify-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-4 py-2 text-sm font-semibold text-accent transition-colors active:scale-[0.97]",
} as const;

// Campo input: 16px (anti-zoom iOS), pieno tenue, focus verde.
export const cfield =
  "w-full rounded-2xl border border-border bg-surface-1 px-4 py-3.5 text-[16px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent/40 focus:ring-4 focus:ring-[var(--ring)]";

// --- Layout -------------------------------------------------------------------

// Contenitore pagina standard (dentro il guscio con barra di navigazione).
export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-4 pb-10 pt-4 ${className}`}
    >
      {children}
    </main>
  );
}

// Intestazione "consumer": occhiello piccolo + titolo grande, azione opzionale.
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
        {eyebrow && (
          <p className="text-[13px] font-medium text-muted">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 truncate text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

// Link "indietro" coerente (riga sopra l'intestazione).
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      ‹ {children}
    </Link>
  );
}

// Etichetta di sezione (consumer: titolo leggibile + azione/“vedi tutto” verde).
export function SectionLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-bold tracking-tight text-foreground">
        {children}
      </h2>
      {right}
    </div>
  );
}

// --- Superfici ----------------------------------------------------------------

// Card morbida. tone: default (bianca) · accent (tinta verde) · dashed (vuoto).
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
      ? "bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-1))] ring-1 ring-[color-mix(in_srgb,var(--accent)_22%,transparent)]"
      : tone === "dashed"
        ? "border border-dashed border-border bg-surface-1/60"
        : "bg-surface-1 shadow-[var(--shadow-soft)]";
  const hover = href
    ? "transition-[transform,box-shadow] duration-150 hover:shadow-[var(--shadow-soft-lg)] active:scale-[0.99]"
    : "";
  const base = `rounded-3xl p-5 ${surface} ${hover} ${className}`;
  if (href)
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  return <div className={base}>{children}</div>;
}

// Tassello icona tondeggiante e tinto. `color` = una variabile/colore dati.
export function IconTile({
  icon: Icon,
  color = "var(--accent)",
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  color?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "sm" ? "size-9 rounded-xl" : "size-11 rounded-2xl";
  const ic = size === "sm" ? "size-[18px]" : "size-5";
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${box} ${className}`}
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      <Icon className={ic} />
    </span>
  );
}

// Riga lista universale (light): [leading] titolo + sottotitolo [trailing].
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
  const cls = `flex items-center gap-3.5 rounded-3xl bg-surface-1 p-3.5 shadow-[var(--shadow-soft)] ${
    href
      ? "transition-[transform,box-shadow] duration-150 hover:shadow-[var(--shadow-soft-lg)] active:scale-[0.99]"
      : ""
  } ${className}`;
  const body = (
    <>
      {leading != null && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-foreground">
          {title}
        </span>
        {subtitle != null && (
          <span className="mt-0.5 block truncate text-[13px] text-muted">
            {subtitle}
          </span>
        )}
      </span>
      {trailing != null && (
        <span className="flex shrink-0 items-center gap-2 text-faint">
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

// KPI: numero grande (tabular) + etichetta. tone accent = tinta verde.
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
  const cls = `flex flex-col rounded-3xl p-4 ${
    tone === "accent"
      ? "bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface-1))] ring-1 ring-[color-mix(in_srgb,var(--accent)_22%,transparent)]"
      : "bg-surface-1 shadow-[var(--shadow-soft)]"
  } ${href ? "transition-transform duration-150 active:scale-[0.99]" : ""}`;
  const body = (
    <>
      <span className="text-[26px] font-extrabold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      <span className="mt-0.5 text-[13px] font-medium text-muted">{label}</span>
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

// --- Stati --------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface-1/60 px-5 py-10 text-center">
      {Icon && (
        <span
          className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl"
          style={{
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: "var(--accent)",
          }}
        >
          <Icon className="size-6" />
        </span>
      )}
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface-1))] text-[color-mix(in_srgb,var(--success)_75%,var(--foreground))] ring-1 ring-[color-mix(in_srgb,var(--success)_30%,transparent)]"
      : tone === "error"
        ? "bg-[color-mix(in_srgb,var(--error)_12%,var(--surface-1))] text-[color-mix(in_srgb,var(--error)_70%,var(--foreground))] ring-1 ring-[color-mix(in_srgb,var(--error)_30%,transparent)]"
        : "bg-surface-1 text-foreground shadow-[var(--shadow-soft)]";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${cls}`}
    >
      {children}
    </p>
  );
}

// --- Componenti "consumer" specifici -----------------------------------------

export type DayState = "done" | "todayDone" | "today" | "future" | "past";
export type WeekDay = { letter: string; state: DayState };

// Striscia settimana: L M M G V S D con pallini ✓ (fatti) / anello (oggi).
// È l'elemento che rende "a colpo d'occhio" la costanza (come Calm / Cal AI).
export function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div className="flex items-center justify-between">
      {days.map((d, i) => {
        const filled = d.state === "done" || d.state === "todayDone";
        const isToday = d.state === "today" || d.state === "todayDone";
        const circle = filled
          ? "bg-accent text-accent-fg"
          : isToday
            ? "border-2 border-accent text-accent"
            : "border border-border text-faint";
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span
              className={`text-[11px] font-semibold ${
                isToday ? "text-foreground" : "text-faint"
              }`}
            >
              {d.letter}
            </span>
            <span
              className={`flex size-9 items-center justify-center rounded-full text-xs font-bold transition-colors ${circle}`}
            >
              {filled && <Check className="size-[18px]" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Barra macro colorata: etichetta + valore/target + progress pieno.
// `color` = una variabile dati (--c-carbs/--c-fat/--c-protein…).
export function MacroBar({
  label,
  value,
  target,
  unit = "g",
  color,
}: {
  label: string;
  value: number;
  target?: number;
  unit?: string;
  color: string;
}) {
  const pct =
    target && target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  return (
    <div>
      <p className="text-[13px] font-semibold text-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">
        {value}
        {unit}
        {target ? (
          <span className="font-medium text-faint"> / {target}</span>
        ) : null}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

// Misura di stile per il punto-colore usato nelle legende (consumer).
export function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2 rounded-full"
      style={{ background: color } as CSSProperties}
    />
  );
}
