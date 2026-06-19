"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  ClipboardCheck,
  Salad,
  MessageCircle,
  Dumbbell,
  type LucideIcon,
} from "@/components/ui/icons";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean; // attivo solo su match esatto (es. home)
  match?: string; // prefisso per l'attivazione, se diverso da href
};

const COACH_ITEMS: NavItem[] = [
  { href: "/coach", label: "Oggi", icon: Home, exact: true },
  { href: "/coach/clienti", label: "Clienti", icon: Users },
  { href: "/coach/checkin", label: "Check-in", icon: ClipboardCheck },
  { href: "/coach/nutrizione", label: "Nutrizione", icon: Salad },
  { href: "/coach/messaggi", label: "Messaggi", icon: MessageCircle },
];

const CLIENTE_ITEMS: NavItem[] = [
  { href: "/cliente", label: "Oggi", icon: Home, exact: true },
  {
    href: "/cliente/allenamento/0",
    match: "/cliente/allenamento",
    label: "Allenamento",
    icon: Dumbbell,
  },
  { href: "/cliente/nutrizione", label: "Nutrizione", icon: Salad },
  { href: "/cliente/messaggi", label: "Messaggi", icon: MessageCircle },
];

// Barra di navigazione mobile condivisa. Le voci (con le loro icone) vivono QUI
// dentro il componente client: niente funzioni/componenti attraversano il
// confine server→client. È un elemento in flusso (non "fixed"): non copre il
// contenuto né si scontra con barre azioni interne alle pagine.
export function BottomNav({ variant }: { variant: "coach" | "cliente" }) {
  const pathname = usePathname();
  const items = variant === "coach" ? COACH_ITEMS : CLIENTE_ITEMS;
  const cliente = variant === "cliente";
  // Tema scuro (coach): pillola bianca tenue, attivo = foreground.
  // Tema chiaro (cliente): pillola verde tenue, attivo = accento verde.
  const navCls = cliente
    ? "shrink-0 border-t border-border bg-surface-1/85 backdrop-blur-xl"
    : "shrink-0 border-t border-border bg-background/90 backdrop-blur";
  return (
    <nav className={navCls} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex w-full max-w-md items-stretch">
        {items.map((it) => {
          const base = it.match ?? it.href;
          const active = it.exact
            ? pathname === it.href
            : pathname === base || pathname.startsWith(base + "/");
          const labelCls = active
            ? cliente
              ? "text-accent"
              : "text-foreground"
            : "text-faint hover:text-muted";
          const pillCls = active
            ? cliente
              ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
              : "bg-white/[0.08]"
            : "";
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors ${labelCls}`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${pillCls}`}
              >
                <it.icon className="size-5" aria-hidden="true" />
              </span>
              <span
                className={
                  active ? (cliente ? "font-semibold" : "font-medium") : ""
                }
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
