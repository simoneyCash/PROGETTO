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
import { signOut } from "@/app/actions";
import {
  Page,
  PageHeader,
  SectionLabel,
  Card,
  IconTile,
  EmptyState,
  Banner,
  Row,
  WeekStrip,
  type WeekDay,
  type DayState,
} from "@/components/ui/client";
import {
  Stagger,
  StaggerItem,
  AnimatedNumber,
  ProgressRing,
  Confetti,
} from "@/components/ui/motion";

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
// Chiave giorno locale (yyyy-m-d) per confrontare le date senza fuso.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

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

  // Settimana corrente (lun→dom): per ogni giorno guardiamo se c'è un
  // allenamento completato → pallino ✓. Dà il colpo d'occhio sulla costanza.
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const mondayOffset = (now.getDay() + 6) % 7; // 0 = lunedì
  const monday = new Date(startOfToday);
  monday.setDate(startOfToday.getDate() - mondayOffset);

  const { data: weekSessions } = await supabase
    .from("sessions")
    .select("completed_at")
    .eq("status", "completed")
    .gte("completed_at", monday.toISOString());
  const doneKeys = new Set(
    ((weekSessions ?? []) as { completed_at: string | null }[])
      .map((s) => (s.completed_at ? dayKey(new Date(s.completed_at)) : null))
      .filter(Boolean) as string[],
  );

  const letters = ["L", "M", "M", "G", "V", "S", "D"];
  const todayKeyStr = dayKey(now);
  const weekDays: WeekDay[] = letters.map((letter, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const k = dayKey(d);
    const isToday = k === todayKeyStr;
    const done = doneKeys.has(k);
    let state: DayState;
    if (done) state = isToday ? "todayDone" : "done";
    else if (isToday) state = "today";
    else if (d.getTime() > startOfToday.getTime()) state = "future";
    else state = "past";
    return { letter, state };
  });

  const weekDone = doneKeys.size; // giorni distinti allenati questa settimana
  const weekTarget = Math.max(1, days.length || 3);

  return (
    <Page>
      {logged && <Confetti />}
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <PageHeader
            eyebrow={today}
            title={`Ciao${firstName ? `, ${firstName}` : ""}`}
            action={
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-3.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-foreground active:scale-95"
                >
                  Esci
                </button>
              </form>
            }
          />
        </StaggerItem>

        {logged && (
          <StaggerItem>
            <Banner tone="success">Allenamento salvato. Ottimo lavoro! 💪</Banner>
          </StaggerItem>
        )}

        {/* Costanza della settimana: anello + striscia coi ✓ */}
        {program && (
          <StaggerItem>
            <Card>
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={weekDone / weekTarget}
                  size={64}
                  stroke={6}
                  color="var(--accent)"
                  trackColor="color-mix(in srgb, var(--foreground) 8%, transparent)"
                >
                  <span className="text-[15px] font-extrabold tabular-nums text-foreground">
                    <AnimatedNumber value={weekDone} />
                    <span className="text-faint">/{weekTarget}</span>
                  </span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-foreground">
                    Questa settimana
                  </p>
                  <p className="text-[13px] text-muted">
                    {weekDone >= weekTarget
                      ? "Obiettivo raggiunto 🔥"
                      : `${weekTarget - weekDone} ${
                          weekTarget - weekDone === 1
                            ? "allenamento"
                            : "allenamenti"
                        } al traguardo`}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-border pt-5">
                <WeekStrip days={weekDays} />
              </div>
            </Card>
          </StaggerItem>
        )}

        {/* Allenamento di oggi */}
        <StaggerItem>
          {!program ? (
            <EmptyState icon={Dumbbell}>
              La tua scheda arriverà presto: il coach la sta preparando.
            </EmptyState>
          ) : (
            <Card>
              <p className="text-[13px] font-semibold text-muted">
                La tua scheda
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">
                {program.title}
              </h2>

              {todayDay && (
                <>
                  <Link
                    href={`/cliente/allenamento/${todayIndex}`}
                    className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-4 text-accent-fg shadow-[0_12px_28px_-10px_var(--accent-glow)] transition-[transform] duration-150 active:scale-[0.99]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold">
                        Oggi · {todayDay.label}
                      </span>
                      <span className="block truncate text-[13px] text-accent-fg/80">
                        {todayDay.focus}
                        {todayDay.exercises?.length
                          ? ` · ${todayDay.exercises.length} esercizi`
                          : ""}
                      </span>
                    </span>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Play className="size-5 fill-current" />
                    </span>
                  </Link>

                  <div className="mt-3 flex gap-2">
                    {days.map((d, i) => (
                      <Link
                        key={i}
                        href={`/cliente/allenamento/${i}`}
                        title={d.label}
                        className={`flex size-11 items-center justify-center rounded-2xl text-sm font-bold transition-colors ${
                          i === todayIndex
                            ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent"
                            : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] text-muted"
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
        </StaggerItem>

        {/* Check-in da compilare */}
        {pendingCheckins > 0 && (
          <StaggerItem>
            <Row
              href="/cliente/checkin"
              leading={<IconTile icon={ClipboardCheck} color="var(--c-fat)" />}
              title="Check-in da compilare"
              subtitle={`${
                pendingCheckins === 1
                  ? "1 domanda in attesa"
                  : `${pendingCheckins} domande in attesa`
              } · tocca per rispondere`}
              trailing={<ChevronRight className="size-5" />}
            />
          </StaggerItem>
        )}

        {/* Azioni di oggi */}
        <StaggerItem>
          <section>
            <SectionLabel>Azioni di oggi</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Card
                href={`/cliente/allenamento/${todayIndex}`}
                className="flex flex-col gap-3"
              >
                <IconTile icon={Dumbbell} color="var(--accent)" />
                <span className="text-[14px] font-semibold text-foreground">
                  Registra allenamento
                </span>
              </Card>
              <Card href="/cliente/messaggi" className="flex flex-col gap-3">
                <IconTile icon={MessageCircle} color="var(--c-cal)" />
                <span className="text-[14px] font-semibold text-foreground">
                  Scrivi al coach
                </span>
              </Card>
              <Card tone="dashed" className="relative flex flex-col gap-3">
                <IconTile icon={UtensilsCrossed} color="var(--faint)" />
                <span className="text-[14px] font-semibold text-muted">
                  Segna un pasto
                </span>
                <span className="absolute right-3.5 top-3.5 rounded-full bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-faint">
                  presto
                </span>
              </Card>
              <Card tone="dashed" className="relative flex flex-col gap-3">
                <IconTile icon={SmilePlus} color="var(--faint)" />
                <span className="text-[14px] font-semibold text-muted">
                  Come ti senti
                </span>
                <span className="absolute right-3.5 top-3.5 rounded-full bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-faint">
                  presto
                </span>
              </Card>
            </div>
          </section>
        </StaggerItem>

        {/* Piano alimentare */}
        <StaggerItem>
          <Row
            href="/cliente/nutrizione"
            leading={<IconTile icon={Salad} color="var(--c-carbs)" />}
            title="Piano alimentare"
            subtitle={
              planData
                ? `${planData.title ?? "Piano"} · pubblicato`
                : "Nessun piano ancora"
            }
            trailing={<ChevronRight className="size-5" />}
          />
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
