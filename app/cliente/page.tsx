import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Play,
  Dumbbell,
  Salad,
  MessageCircle,
  UtensilsCrossed,
  SmilePlus,
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
    .select("id, title, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-400">Oggi</p>
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

      {/* Scheda / allenamento di oggi */}
      <section className="mt-6">
        {!program ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 text-center">
            <Dumbbell className="mx-auto size-6 text-neutral-600" />
            <p className="mt-2 text-sm text-neutral-300">
              La tua scheda arriverà presto: il coach la sta preparando.
            </p>
          </div>
        ) : (
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
        )}
      </section>

      {/* Azioni di oggi */}
      <section className="mt-5">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Azioni di oggi
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Link
            href="/cliente/allenamento/0"
            className="flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-emerald-600/40"
          >
            <Dumbbell className="size-6 text-emerald-400" />
            <span className="text-sm font-medium">Registra allenamento</span>
          </Link>
          <Link
            href="/cliente/messaggi"
            className="flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-emerald-600/40"
          >
            <MessageCircle className="size-6 text-emerald-400" />
            <span className="text-sm font-medium">Scrivi al coach</span>
          </Link>
          <div className="relative flex flex-col gap-2 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-4">
            <UtensilsCrossed className="size-6 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-400">
              Segna un pasto
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-500">
              presto
            </span>
          </div>
          <div className="relative flex flex-col gap-2 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-4">
            <SmilePlus className="size-6 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-400">
              Come ti senti
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-500">
              presto
            </span>
          </div>
        </div>
      </section>

      {/* Piano alimentare */}
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
    </main>
  );
}
