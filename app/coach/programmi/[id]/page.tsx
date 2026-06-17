import { notFound, redirect } from "next/navigation";
import { Sparkles, TriangleAlert } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { ProgramEditor } from "@/components/ProgramEditor";
import { ArtifactBadge } from "@/components/ui/StatusBadge";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  Banner,
} from "@/components/ui/kit";

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
    <Page>
      <BackLink href={`/coach/clienti/${version.client_id}`}>
        {client?.full_name ?? "Cliente"}
      </BackLink>

      <PageHeader
        eyebrow={isEditable ? "Revisione scheda" : "Scheda"}
        title={isEditable ? "Revisiona la bozza" : c.title}
        action={<ArtifactBadge status={version.status} />}
      />

      {version.generated_by_ai && isEditable && (
        <Card tone="accent" className="-mt-3 flex items-start gap-3">
          <Sparkles className="size-5 shrink-0 text-accent" />
          <p className="text-sm text-neutral-300">
            Bozza AI — modifica liberamente, poi pubblica. Il cliente non vede
            nulla finché non pubblichi.
          </p>
        </Card>
      )}

      {published && (
        <Banner tone="success">
          Scheda pubblicata: ora è visibile al cliente.
        </Banner>
      )}
      {saved && (
        <Banner tone="success">
          Modifiche salvate. Resta una bozza finché non pubblichi.
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}

      {isEditable ? (
        <ProgramEditor
          versionId={version.id}
          initialContent={c}
          exercises={exercises}
        />
      ) : (
        <ReadOnlyProgram content={c} />
      )}
    </Page>
  );
}

// Vista sola-lettura per le schede già pubblicate/archiviate.
function ReadOnlyProgram({ content: c }: { content: ProgramContent }) {
  return (
    <>
      {c.summary && (
        <p className="-mt-3 text-sm text-neutral-400">{c.summary}</p>
      )}

      {c.health_flags?.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <TriangleAlert className="size-4" />
            Da verificare (salute)
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-200/90">
            {c.health_flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <SectionLabel>Giorni</SectionLabel>
        {c.days?.map((day, i) => (
          <Card key={i}>
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
          </Card>
        ))}
      </section>

      {c.coach_notes && (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Note per il coach
          </p>
          <p className="mt-1 text-sm text-neutral-300">{c.coach_notes}</p>
        </Card>
      )}

      <p className="text-center text-xs text-neutral-500">
        Scheda pubblicata e visibile al cliente.
      </p>
    </>
  );
}
