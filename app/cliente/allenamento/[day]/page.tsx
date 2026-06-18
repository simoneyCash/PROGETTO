import { notFound, redirect } from "next/navigation";
import { Dumbbell } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { Page, BackLink, IconTile, Banner } from "@/components/ui/kit";
import { WorkoutSession } from "@/components/WorkoutSession";

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
    .select("id, content")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) redirect("/cliente");

  const content = version.content as ProgramContent;
  const d = content.days?.[dayIndex];
  if (!d) notFound();

  // Normalizziamo gli esercizi in valori serializzabili per il componente client.
  const exercises = (d.exercises ?? []).map((ex) => ({
    exercise_name: ex.exercise_name,
    sets: Math.max(1, Number(ex.sets) || 1),
    reps: ex.reps ?? "",
    rest_seconds: Number(ex.rest_seconds) || 0,
    notes: ex.notes ?? "",
  }));

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

      {error && <Banner tone="error">{error}</Banner>}

      <WorkoutSession
        dayIndex={dayIndex}
        exercises={exercises}
        storageKey={`coachai:w:${version.id}:${dayIndex}`}
      />
    </Page>
  );
}
