import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Play,
  Dumbbell,
  Salad,
  MessageCircle,
  ClipboardCheck,
  LineChart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { LogoutButton } from "@/components/LogoutButton";

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

export default async function ClientHome({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const { logged } = await searchParams;

  const supabase = await createClient();

  const { data: versionData } = await supabase
    .from("program_versions")
    .select("id, content, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const program = versionData
    ? (versionData.content as ProgramContent)
    : null;
  const days = program?.days ?? [];
  const nextDay = days[0];

  const { data: planData } = await supabase
    .from("nutrition_plans")
    .select("id, title, content, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-400">
            Area Cliente
          </p>
          <h1 className="text-lg font-semibold">
            Ciao{profile.full_name ? `, ${profile.full_name}` : ""}
          </h1>
        </div>
        <LogoutButton />
      </header>

      {logged && (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Allenamento salvato. Ottimo lavoro! 💪
        </p>
      )}

      {/* Scheda */}
      <section className="mt-6">
        {!program ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 text-center">
            <Dumbbell className="mx-auto size-6 text-neutral-600" />
            <p className="mt-2 text-sm text-neutral-300">
              La tua scheda arriverà presto: il coach la sta preparando.
            </p>
          </div>
        ) : (
          <>
            {/* Card scheda */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-400">
                La tua scheda
              </p>
              <h2 className="mt-1 text-xl font-semibold">{program.title}</h2>

              {nextDay && (
                <>
                  <Link
                    href="/cliente/allenamento/0"
                    className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 transition-colors hover:border-emerald-600/40"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">Oggi · {nextDay.label}</p>
                      <p className="text-xs text-neutral-400">
                        {nextDay.focus}
                        {nextDay.exercises?.length
                          ? ` · ${nextDay.exercises.length} esercizi`
                          : ""}
                      </p>
                    </div>
                    <Play className="size-6 shrink-0 text-emerald-400" />
                  </Link>

                  <div className="mt-3 flex gap-2">
                    {days.map((d, i) => (
                      <Link
                        key={i}
                        href={`/cliente/allenamento/${i}`}
                        title={d.label}
                        className={`flex size-10 items-center justify-center rounded-xl font-medium ${
                          i === 0
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/5 text-neutral-400 hover:bg-white/10"
                        }`}
                      >
                        {dayLetter(i)}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Anteprima esercizi del prossimo allenamento */}
            {nextDay && nextDay.exercises?.length > 0 && (
              <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
                <ul className="flex flex-col gap-3">
                  {nextDay.exercises.map((ex, j) => (
                    <li
                      key={j}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {ex.exercise_name}
                      </span>
                      <span className="shrink-0 text-sm text-neutral-400">
                        {ex.sets}×{ex.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Nutrizione */}
      <Link
        href="/cliente/nutrizione"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-neutral-700"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400">
          <Salad className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">Piano alimentare</p>
          {planData ? (
            <p className="truncate text-xs text-neutral-400">
              {planData.title ?? "Piano"} · pubblicato
            </p>
          ) : (
            <p className="text-xs text-neutral-500">Nessun piano ancora</p>
          )}
        </div>
      </Link>

      {/* Messaggi */}
      <Link
        href="/cliente/messaggi"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-neutral-700"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400">
          <MessageCircle className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">Messaggi</p>
          <p className="text-xs text-neutral-500">Scrivi al tuo coach</p>
        </div>
      </Link>

      {/* Presto disponibili */}
      <section className="mt-6">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Presto disponibili
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { icon: ClipboardCheck, label: "Check-in" },
            { icon: LineChart, label: "Progressi" },
          ].map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-neutral-700 bg-neutral-900/40 px-3 py-1.5 text-xs text-neutral-400"
            >
              <s.icon className="size-3.5" />
              {s.label}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
