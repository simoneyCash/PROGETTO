import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Play,
  Dumbbell,
  Salad,
  MessageCircle,
  UtensilsCrossed,
  SmilePlus,
  ChevronRight,
  ClipboardCheck,
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
  EmptyState,
  Banner,
} from "@/components/ui/kit";

type Exercise = {
  exercise_name: string;
  sets: number;
  reps: string;
};
type ProgramContent = {
  title: string;
  summary: string;
  days: { label: string; focus: string; exercises: Exercise[] }[];
};

const dayLetter = (i: number) => String.fromCharCode(65 + i);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ClientHome({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const { logged } = await searchParams;
  const firstName = profile.full_name?.split(" ")[0] ?? "";
  const today = cap(
    new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  const supabase = await createClient();

  const { data: versionData } = await supabase
    .from("program_versions")
    .select("id, content, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const program = versionData ? (versionData.content as ProgramContent) : null;
  const days = program?.days ?? [];

  // "Oggi": ruotiamo il giorno consigliato in base all'ultimo allenamento
  // completato (il titolo della sessione = l'etichetta del giorno). Se non si
  // trova, si riparte da A. È una stima utile, non un calendario rigido.
  let todayIndex = 0;
  if (days.length > 0) {
    const { data: lastSession } = await supabase
      .from("sessions")
      .select("title")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSession?.title) {
      const prev = days.findIndex((d) => d.label === lastSession.title);
      if (prev >= 0) todayIndex = (prev + 1) % days.length;
    }
  }
  const todayDay = days[todayIndex];

  const { data: planData } = await supabase
    .from("nutrition_plans")
    .select("id, title, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Check-in in attesa di risposta (RPC sicura: solo i propri).
  const { data: checkinRows } = await supabase.rpc("client_list_checkins");
  const pendingCheckins = ((checkinRows ?? []) as { status: string }[]).filter(
    (c) => c.status === "scheduled" || c.status === "sent",
  ).length;

  return (
    <Page>
      <PageHeader
        eyebrow={today}
        title={`Ciao${firstName ? `, ${firstName}` : ""}`}
        action={<LogoutButton />}
      />

      {logged && (
        <Banner tone="success">Allenamento salvato. Ottimo lavoro! 💪</Banner>
      )}

      {/* Scheda / allenamento di oggi */}
      {!program ? (
        <EmptyState icon={Dumbbell}>
          La tua scheda arriverà presto: il coach la sta preparando.
        </EmptyState>
      ) : (
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            La tua scheda
          </p>
          <h2 className="mt-1.5 font-serif text-2xl font-medium tracking-tight">
            {program.title}
          </h2>

          {todayDay && (
            <>
              <Link
                href={`/cliente/allenamento/${todayIndex}`}
                className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-b from-accent-light to-accent px-5 py-3.5 text-accent-ink shadow-[0_18px_34px_-12px_rgba(231,191,112,0.45)] transition hover:brightness-[1.05]"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">
                    Oggi · {todayDay.label}
                  </span>
                  <span className="block truncate text-xs text-accent-ink/70">
                    {todayDay.focus}
                    {todayDay.exercises?.length
                      ? ` · ${todayDay.exercises.length} esercizi`
                      : ""}
                  </span>
                </span>
                <Play className="size-6 shrink-0 fill-current" />
              </Link>

              <div className="mt-3 flex gap-2">
                {days.map((d, i) => (
                  <Link
                    key={i}
                    href={`/cliente/allenamento/${i}`}
                    title={d.label}
                    className={`flex size-10 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                      i === todayIndex
                        ? "bg-accent/15 text-accent"
                        : "bg-white/5 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    {dayLetter(i)}
                  </Link>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Check-in da compilare */}
      {pendingCheckins > 0 && (
        <Card
          href="/cliente/checkin"
          tone="accent"
          className="flex items-center gap-3"
        >
          <IconTile icon={ClipboardCheck} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Check-in da compilare</p>
            <p className="text-xs text-neutral-400">
              {pendingCheckins === 1
                ? "1 domanda in attesa"
                : `${pendingCheckins} domande in attesa`}{" "}
              · tocca per rispondere
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-neutral-500" />
        </Card>
      )}

      {/* Azioni di oggi */}
      <section>
        <SectionLabel>Azioni di oggi</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Card
            href={`/cliente/allenamento/${todayIndex}`}
            className="flex flex-col gap-3"
          >
            <Dumbbell className="size-6 text-accent" />
            <span className="text-sm font-medium">Registra allenamento</span>
          </Card>
          <Card href="/cliente/messaggi" className="flex flex-col gap-3">
            <MessageCircle className="size-6 text-accent" />
            <span className="text-sm font-medium">Scrivi al coach</span>
          </Card>
          <Card tone="dashed" className="relative flex flex-col gap-3">
            <UtensilsCrossed className="size-6 text-neutral-600" />
            <span className="text-sm font-medium text-neutral-500">
              Segna un pasto
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-500">
              presto
            </span>
          </Card>
          <Card tone="dashed" className="relative flex flex-col gap-3">
            <SmilePlus className="size-6 text-neutral-600" />
            <span className="text-sm font-medium text-neutral-500">
              Come ti senti
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-500">
              presto
            </span>
          </Card>
        </div>
      </section>

      {/* Piano alimentare */}
      <Card href="/cliente/nutrizione" className="flex items-center gap-3">
        <IconTile icon={Salad} tone="muted" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Piano alimentare</p>
          {planData ? (
            <p className="truncate text-xs text-neutral-400">
              {planData.title ?? "Piano"} · pubblicato
            </p>
          ) : (
            <p className="text-xs text-neutral-500">Nessun piano ancora</p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-neutral-600" />
      </Card>
    </Page>
  );
}
