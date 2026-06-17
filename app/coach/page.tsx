import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  ClipboardCheck,
  Salad,
  MessageCircle,
  CreditCard,
  LineChart,
  Sparkles,
  ChevronRight,
  CircleCheck,
  type LucideIcon,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { LogoutButton } from "@/components/LogoutButton";
import { Page, PageHeader, SectionLabel, Card, IconTile } from "@/components/ui/kit";

// Stati "bozza" di un artefatto: da rivedere/approvare (non ancora pubblicato).
const PENDING = ["draft", "pending_review", "approved"];

// Iniziali per l'avatar (max 2 lettere).
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

type Section = {
  href?: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  muted?: boolean;
};
type Todo = { href: string; icon: LucideIcon; label: string; count: number };

export default async function CoachHome() {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const firstName = profile.full_name?.split(" ")[0] ?? "";

  const supabase = await createClient();

  // Conteggi reali (in parallelo). head:true = solo il count, niente righe.
  const [
    clientsRes,
    checkinsRes,
    plansRes,
    pendingProgramsRes,
    pendingPlansRes,
    answeredCheckinsRes,
    clientsListRes,
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("checkins").select("id", { count: "exact", head: true }),
    supabase.from("nutrition_plans").select("id", { count: "exact", head: true }),
    supabase
      .from("program_versions")
      .select("id", { count: "exact", head: true })
      .in("status", PENDING),
    supabase
      .from("nutrition_plans")
      .select("id", { count: "exact", head: true })
      .in("status", PENDING),
    supabase
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("status", "answered"),
    supabase
      .from("clients")
      .select("id, full_name")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const clientCount = clientsRes.count ?? 0;
  const checkinCount = checkinsRes.count ?? 0;
  const planCount = plansRes.count ?? 0;
  const pendingPrograms = pendingProgramsRes.count ?? 0;
  const pendingPlans = pendingPlansRes.count ?? 0;
  const answeredCheckins = answeredCheckinsRes.count ?? 0;
  const clientList = (clientsListRes.data ?? []) as {
    id: string;
    full_name: string;
  }[];

  const todos: Todo[] = [
    pendingPrograms > 0 && {
      href: "/coach/clienti",
      icon: Sparkles,
      label: "Schede da approvare",
      count: pendingPrograms,
    },
    pendingPlans > 0 && {
      href: "/coach/nutrizione",
      icon: Salad,
      label: "Piani da approvare",
      count: pendingPlans,
    },
    answeredCheckins > 0 && {
      href: "/coach/checkin",
      icon: ClipboardCheck,
      label: "Check-in da rivedere",
      count: answeredCheckins,
    },
  ].filter(Boolean) as Todo[];

  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  const sections: Section[] = [
    {
      href: "/coach/clienti",
      icon: Users,
      title: "Clienti",
      subtitle: plural(clientCount, "cliente", "clienti"),
    },
    {
      href: "/coach/checkin",
      icon: ClipboardCheck,
      title: "Check-in",
      subtitle:
        checkinCount > 0 ? plural(checkinCount, "creato", "creati") : "Programma",
    },
    {
      href: "/coach/nutrizione",
      icon: Salad,
      title: "Nutrizione",
      subtitle:
        planCount > 0 ? plural(planCount, "piano", "piani") : "Crea un piano",
    },
    {
      href: "/coach/messaggi",
      icon: MessageCircle,
      title: "Messaggi",
      subtitle: "Chat clienti",
    },
    {
      href: "/coach/pagamenti",
      icon: CreditCard,
      title: "Pagamenti",
      subtitle: "In attesa di Stripe",
      muted: true,
    },
    {
      href: "/coach/progressi",
      icon: LineChart,
      title: "Progressi",
      subtitle: "In attesa di dati",
      muted: true,
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="Area coach"
        title={`Ciao${firstName ? `, ${firstName}` : ""}`}
        action={<LogoutButton />}
      />

      {/* Da fare */}
      {todos.length > 0 ? (
        <Card tone="accent">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Da fare</span>
            <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
              {todos.length}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {todos.map((t) => (
              <li key={t.label}>
                <Link
                  href={t.href}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    <t.icon className="size-4 text-accent" />
                    {t.label}
                  </span>
                  <span className="flex items-center gap-2 text-neutral-400">
                    <span className="font-semibold text-neutral-100">
                      {t.count}
                    </span>
                    <ChevronRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-2.5 text-sm text-neutral-400">
            <CircleCheck className="size-4 text-emerald-400" />
            Nessuna azione in sospeso.
          </div>
        </Card>
      )}

      {/* I tuoi clienti */}
      {clientList.length > 0 && (
        <section>
          <SectionLabel
            right={
              <Link
                href="/coach/clienti"
                className="text-xs text-accent transition-colors hover:text-white"
              >
                Tutti
              </Link>
            }
          >
            I tuoi clienti
          </SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {clientList.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/coach/clienti/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/20"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-medium text-neutral-300">
                    {initials(c.full_name)}
                  </span>
                  <span className="flex-1 truncate text-sm">{c.full_name}</span>
                  <ChevronRight className="size-4 text-neutral-600" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Strumenti */}
      <section>
        <SectionLabel>Strumenti</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {sections.map((s) => (
            <Card key={s.title} href={s.href ?? "#"} className="flex flex-col">
              <IconTile icon={s.icon} tone={s.muted ? "muted" : "accent"} />
              <span
                className={`mt-3 font-medium ${s.muted ? "text-neutral-400" : ""}`}
              >
                {s.title}
              </span>
              <span className="mt-0.5 text-xs text-neutral-500">
                {s.subtitle}
              </span>
            </Card>
          ))}
        </div>
      </section>
    </Page>
  );
}
