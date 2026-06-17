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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { LogoutButton } from "@/components/LogoutButton";

// Stati "bozza" di un artefatto: da rivedere/approvare (non ancora pubblicato).
const PENDING = ["draft", "pending_review", "approved"];

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

  const supabase = await createClient();

  // Conteggi reali (in parallelo). head:true = solo il count, niente righe.
  const [
    clientsRes,
    checkinsRes,
    plansRes,
    pendingProgramsRes,
    pendingPlansRes,
    answeredCheckinsRes,
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
  ]);

  const clientCount = clientsRes.count ?? 0;
  const checkinCount = checkinsRes.count ?? 0;
  const planCount = plansRes.count ?? 0;
  const pendingPrograms = pendingProgramsRes.count ?? 0;
  const pendingPlans = pendingPlansRes.count ?? 0;
  const answeredCheckins = answeredCheckinsRes.count ?? 0;

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
      subtitle: checkinCount > 0 ? plural(checkinCount, "creato", "creati") : "Programma",
    },
    {
      href: "/coach/nutrizione",
      icon: Salad,
      title: "Nutrizione",
      subtitle: planCount > 0 ? plural(planCount, "piano", "piani") : "Crea un piano",
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-400">
            Area Coach
          </p>
          <h1 className="text-lg font-semibold">
            Ciao{profile.full_name ? `, ${profile.full_name}` : ""}
          </h1>
        </div>
        <LogoutButton />
      </header>

      {/* Da fare */}
      <section className="mt-6">
        {todos.length > 0 ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-300">
                Da fare
              </span>
              <span className="text-xs text-emerald-400/80">{todos.length}</span>
            </div>
            <ul className="mt-3 flex flex-col gap-2.5">
              {todos.map((t) => (
                <li key={t.label}>
                  <Link
                    href={t.href}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2.5 text-sm">
                      <t.icon className="size-4 text-emerald-400" />
                      {t.label}
                    </span>
                    <span className="flex items-center gap-2 text-neutral-400">
                      <span className="font-medium text-neutral-200">
                        {t.count}
                      </span>
                      <ChevronRight className="size-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
            <CircleCheck className="size-4 text-emerald-400" />
            Nessuna azione in sospeso.
          </div>
        )}
      </section>

      {/* Sezioni */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        {sections.map((s) => (
          <Link
            key={s.title}
            href={s.href ?? "#"}
            className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-emerald-600/40"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-xl ${
                s.muted
                  ? "bg-white/5 text-neutral-400"
                  : "bg-emerald-500/12 text-emerald-400"
              }`}
            >
              <s.icon className="size-5" />
            </span>
            <span
              className={`mt-3 font-medium ${
                s.muted ? "text-neutral-300" : ""
              }`}
            >
              {s.title}
            </span>
            <span className="mt-0.5 text-xs text-neutral-500">
              {s.subtitle}
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
