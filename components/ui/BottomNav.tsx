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
  return (
    <nav className="shrink-0 border-t border-white/10 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-stretch">
        {items.map((it) => {
          const base = it.match ?? it.href;
          const active = it.exact
            ? pathname === it.href
            : pathname === base || pathname.startsWith(base + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                active
                  ? "font-medium text-accent"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {active && (
                <span className="absolute inset-x-[30%] top-0 h-0.5 rounded-full bg-accent" />
              )}
              <it.icon className="size-5" aria-hidden="true" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
