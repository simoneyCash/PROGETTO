import { notFound, redirect } from "next/navigation";
import { Dumbbell } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { logWorkout } from "../../actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Page, BackLink, IconTile, Banner, btn } from "@/components/ui/kit";

type Exercise = {
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
};
type ProgramContent = {
  title: string;
  days: { label: string; focus: string; exercises: Exercise[] }[];
};

const inputClass =
  "w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-center text-base text-neutral-100 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

export default async function LogWorkout({
  params,
  searchParams,
}: {
  params: Promise<{ day: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const { day } = await params;
  const { error } = await searchParams;
  const dayIndex = Number(day);
  if (!Number.isInteger(dayIndex) || dayIndex < 0) notFound();

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("program_versions")
    .select("content")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) redirect("/cliente");

  const content = version.content as ProgramContent;
  const d = content.days?.[dayIndex];
  if (!d) notFound();

  return (
    <Page>
      <BackLink href="/cliente">La tua scheda</BackLink>

      <header className="flex items-center gap-3">
        <IconTile icon={Dumbbell} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{d.label}</h1>
          <p className="text-sm text-neutral-500">{d.focus}</p>
        </div>
      </header>

      <p className="-mt-3 text-xs text-neutral-500">
        Segna cosa hai fatto in ogni serie. Le serie vuote non vengono salvate.
      </p>

      {error && <Banner tone="error">{error}</Banner>}

      <form action={logWorkout} className="flex flex-col gap-4">
        <input type="hidden" name="day" value={dayIndex} />

        {d.exercises?.map((ex, i) => {
          const setCount = Math.max(1, Number(ex.sets) || 1);
          return (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{ex.exercise_name}</h2>
                <span className="text-xs text-neutral-500">
                  target {ex.sets}×{ex.reps}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-600">
                  <span className="w-14">Serie</span>
                  <span className="w-20 text-center">Ripetiz.</span>
                  <span className="w-20 text-center">Peso kg</span>
                </div>
                {Array.from({ length: setCount }).map((_, s0) => {
                  const s = s0 + 1;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className="w-14 text-sm text-neutral-400">
                        {s}
                      </span>
                      <input
                        name={`reps_${i}_${s}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder={ex.reps}
                        className={inputClass}
                      />
                      <input
                        name={`weight_${i}_${s}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        placeholder="—"
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </div>

              {ex.notes && (
                <p className="mt-3 rounded-xl border border-accent/20 bg-accent/[0.06] px-3 py-2 text-sm text-neutral-200">
                  {ex.notes}
                </p>
              )}
            </div>
          );
        })}

        <SubmitButton
          className={`sticky bottom-4 mt-2 ${btn.primary}`}
          pendingText="Salvataggio…"
        >
          Completa allenamento
        </SubmitButton>
      </form>
    </Page>
  );
}
