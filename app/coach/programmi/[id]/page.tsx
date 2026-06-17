import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { approveProgramVersion } from "../../actions";

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

const STATUS_LABEL: Record<string, string> = {
  draft: "Bozza",
  pending_review: "In revisione",
  approved: "Approvata",
  published: "Pubblicata",
  archived: "Archiviata",
};

export default async function ProgramReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { published, error } = await searchParams;

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
  const isPublished = version.status === "published";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href={`/coach/clienti/${version.client_id}`}
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ {client?.full_name ?? "Cliente"}
      </Link>

      <header className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{c.title}</h1>
          <p className="mt-1 text-sm text-neutral-400">{c.summary}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            isPublished
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {STATUS_LABEL[version.status] ?? version.status}
        </span>
      </header>

      {version.generated_by_ai && (
        <p className="mt-2 text-xs text-neutral-500">
          ✨ Bozza generata dall&apos;AI — rivedi prima di pubblicare.
        </p>
      )}

      {published && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Scheda pubblicata: ora è visibile al cliente.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

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

      {!isPublished && (
        <form action={approveProgramVersion} className="mt-6">
          <input type="hidden" name="version_id" value={version.id} />
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-500"
          >
            Approva e pubblica
          </button>
          <p className="mt-2 text-center text-xs text-neutral-500">
            Finché è una bozza, il cliente non la vede.
          </p>
        </form>
      )}
    </main>
  );
}
