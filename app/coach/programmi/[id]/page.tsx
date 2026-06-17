import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { ProgramEditor } from "@/components/ProgramEditor";
import { ArtifactBadge } from "@/components/ui/StatusBadge";

type Exercise = {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
};
type ProgramContent = {
  title: string;
  summary: string;
  coach_notes: string;
  health_flags: string[];
  days: { label: string; focus: string; exercises: Exercise[] }[];
};

export default async function ProgramReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; saved?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { published, saved, error } = await searchParams;

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("program_versions")
    .select("id, status, content, client_id, generated_by_ai")
    .eq("id", id)
    .maybeSingle();
  if (!version) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("id", version.client_id)
    .maybeSingle();

  const c = version.content as ProgramContent;
  const isEditable = !["published", "archived"].includes(version.status);

  // Libreria esercizi del tenant per il menu a tendina dell'editor (grounding).
  let exercises: { id: string; name: string; muscle_group: string | null }[] = [];
  if (isEditable) {
    const { data } = await supabase
      .from("exercises")
      .select("id, name, muscle_group")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("name");
    exercises = data ?? [];
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href={`/coach/clienti/${version.client_id}`}
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ {client?.full_name ?? "Cliente"}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          {isEditable ? "Revisiona la bozza" : c.title}
        </h1>
        <ArtifactBadge status={version.status} />
      </div>

      {version.generated_by_ai && isEditable && (
        <p className="mt-2 text-xs text-neutral-500">
          ✨ Bozza AI — modifica liberamente, poi pubblica. Il cliente non vede
          nulla finché non pubblichi.
        </p>
      )}

      {published && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Scheda pubblicata: ora è visibile al cliente.
        </p>
      )}
      {saved && (
        <p className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">
          Modifiche salvate. Resta una bozza finché non pubblichi.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {isEditable ? (
        <ProgramEditor
          versionId={version.id}
          initialContent={c}
          exercises={exercises}
        />
      ) : (
        <ReadOnlyProgram content={c} />
      )}
    </main>
  );
}

// Vista sola-lettura per le schede già pubblicate/archiviate.
function ReadOnlyProgram({ content: c }: { content: ProgramContent }) {
  return (
    <>
      {c.summary && <p className="mt-3 text-sm text-neutral-400">{c.summary}</p>}

      {c.health_flags?.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm font-medium text-amber-300">
            ⚠️ Da verificare (salute)
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-200/90">
            {c.health_flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-6 flex flex-col gap-4">
        {c.days?.map((day, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{day.label}</h2>
              <span className="text-xs text-neutral-500">{day.focus}</span>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {day.exercises?.map((ex, j) => (
                <li key={j} className="text-sm">
                  <span className="font-medium">{ex.exercise_name}</span>
                  <span className="text-neutral-400">
                    {" "}
                    — {ex.sets}×{ex.reps}, rec {ex.rest_seconds}s
                  </span>
                  {ex.notes && (
                    <span className="block text-xs text-neutral-500">
                      {ex.notes}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {c.coach_notes && (
        <div className="mt-4 rounded-xl border border-neutral-800 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Note per il coach
          </p>
          <p className="mt-1 text-sm text-neutral-300">{c.coach_notes}</p>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-neutral-500">
        Scheda pubblicata e visibile al cliente.
      </p>
    </>
  );
}
