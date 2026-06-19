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
import {
  Page,
  PageHeader,
  SectionLabel,
  Card,
  IconTile,
  Stat,
  Row,
  Avatar,
} from "@/components/ui/kit";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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

  const pendingArtifacts = pendingPrograms + pendingPlans;

  return (
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <PageHeader
            eyebrow="Area coach"
            title={`Ciao${firstName ? `, ${firstName}` : ""}`}
            action={<LogoutButton />}
          />
        </StaggerItem>

        {/* Sintesi (KPI) */}
        <StaggerItem className="grid grid-cols-3 gap-3">
          <Stat
            href="/coach/clienti"
            label="Clienti"
            value={<AnimatedNumber value={clientCount} />}
          />
          <Stat
            href="/coach/clienti"
            label="Da approvare"
            value={<AnimatedNumber value={pendingArtifacts} />}
            tone={pendingArtifacts > 0 ? "accent" : "default"}
          />
          <Stat
            href="/coach/checkin"
            label="Da rivedere"
            value={<AnimatedNumber value={answeredCheckins} />}
            tone={answeredCheckins > 0 ? "accent" : "default"}
          />
        </StaggerItem>

      {/* Da fare */}
      <StaggerItem><section>
        <SectionLabel>Da fare</SectionLabel>
        {todos.length > 0 ? (
          <div className="flex flex-col gap-2">
            {todos.map((t) => (
              <Row
                key={t.label}
                href={t.href}
                leading={<IconTile icon={t.icon} />}
                title={t.label}
                trailing={
                  <>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {t.count}
                    </span>
                    <ChevronRight className="size-4" />
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <Row
            leading={<IconTile icon={CircleCheck} tone="muted" />}
            title="Tutto in pari"
            subtitle="Nessuna azione in sospeso"
          />
        )}
      </section></StaggerItem>

      {/* I tuoi clienti */}
      {clientList.length > 0 && (
        <StaggerItem><section>
          <SectionLabel
            right={
              <Link
                href="/coach/clienti"
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                Tutti
              </Link>
            }
          >
            I tuoi clienti
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {clientList.map((c) => (
              <Row
                key={c.id}
                href={`/coach/clienti/${c.id}`}
                leading={<Avatar name={c.full_name} />}
                title={c.full_name}
                trailing={<ChevronRight className="size-4" />}
              />
            ))}
          </div>
        </section></StaggerItem>
      )}

      {/* Strumenti */}
      <StaggerItem><section>
        <SectionLabel>Strumenti</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {sections.map((s) => (
            <Card key={s.title} href={s.href ?? "#"} className="flex flex-col gap-3">
              <IconTile icon={s.icon} tone={s.muted ? "muted" : "accent"} />
              <span>
                <span
                  className={`block text-sm font-medium ${
                    s.muted ? "text-muted" : "text-foreground"
                  }`}
                >
                  {s.title}
                </span>
                <span className="mt-0.5 block text-xs text-faint">
                  {s.subtitle}
                </span>
              </span>
            </Card>
          ))}
        </div>
      </section></StaggerItem>
      </Stagger>
    </Page>
  );
}
