import { notFound, redirect } from "next/navigation";
import { Sparkles, TriangleAlert, Dumbbell } from "@/components/ui/icons";
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
  IconTile,
  Row,
} from "@/components/ui/kit";
import { Stagger, StaggerItem } from "@/components/ui/motion";

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
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href={`/coach/clienti/${version.client_id}`}>
            {client?.full_name ?? "Cliente"}
          </BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader
            eyebrow={isEditable ? "Revisione scheda" : "Scheda"}
            title={isEditable ? "Revisiona la bozza" : c.title}
            action={<ArtifactBadge status={version.status} />}
          />
        </StaggerItem>

        {version.generated_by_ai && isEditable && (
          <StaggerItem>
            <Card tone="accent" className="-mt-3 flex items-start gap-3">
              <IconTile icon={Sparkles} />
              <p className="text-sm text-muted">
                Bozza AI — modifica liberamente, poi pubblica. Il cliente non
                vede nulla finché non pubblichi.
              </p>
            </Card>
          </StaggerItem>
        )}

        {published && (
          <StaggerItem>
            <Banner tone="success">
              Scheda pubblicata: ora è visibile al cliente.
            </Banner>
          </StaggerItem>
        )}
        {saved && (
          <StaggerItem>
            <Banner tone="success">
              Modifiche salvate. Resta una bozza finché non pubblichi.
            </Banner>
          </StaggerItem>
        )}
        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {isEditable ? (
          <StaggerItem>
            <ProgramEditor
              versionId={version.id}
              initialContent={c}
              exercises={exercises}
            />
          </StaggerItem>
        ) : (
          <ReadOnlyProgram content={c} />
        )}
      </Stagger>
    </Page>
  );
}

// Vista sola-lettura per le schede già pubblicate/archiviate.
function ReadOnlyProgram({ content: c }: { content: ProgramContent }) {
  return (
    <Stagger className="flex flex-col gap-6">
      {c.summary && (
        <StaggerItem>
          <p className="-mt-3 text-sm text-muted">{c.summary}</p>
        </StaggerItem>
      )}

      {c.health_flags?.length > 0 && (
        <StaggerItem>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <TriangleAlert className="size-4 shrink-0" />
              Da verificare (salute)
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-200/90 marker:text-amber-400/60">
              {c.health_flags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </StaggerItem>
      )}

      <StaggerItem>
        <section>
          <SectionLabel>Giorni</SectionLabel>
          <div className="flex flex-col gap-3">
            {c.days?.map((day, i) => (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">
                    {day.label}
                  </h2>
                  <span className="shrink-0 text-xs text-faint">
                    {day.focus}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {day.exercises?.map((ex, j) => (
                    <Row
                      key={j}
                      leading={<IconTile icon={Dumbbell} tone="muted" />}
                      title={ex.exercise_name}
                      subtitle={ex.notes || undefined}
                      trailing={
                        <span className="text-xs tabular-nums text-muted">
                          {ex.sets}×{ex.reps} · rec {ex.rest_seconds}s
                        </span>
                      }
                    />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </StaggerItem>

      {c.coach_notes && (
        <StaggerItem>
          <Card>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Note per il coach
            </p>
            <p className="mt-2 text-sm text-foreground">{c.coach_notes}</p>
          </Card>
        </StaggerItem>
      )}

      <StaggerItem>
        <p className="text-center text-xs text-faint">
          Scheda pubblicata e visibile al cliente.
        </p>
      </StaggerItem>
    </Stagger>
  );
}
