import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { generateCheckinSummary, approveCheckinSummary } from "../actions";
import { CheckinBadge, ArtifactBadge } from "@/components/ui/StatusBadge";
import { GenerateButton } from "@/components/GenerateButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  Banner,
  btn,
} from "@/components/ui/kit";

type Checkin = {
  id: string;
  client_id: string;
  prompt: string | null;
  status: string;
  scheduled_for: string | null;
  response: unknown;
  responded_at: string | null;
  ai_summary: string | null;
  summary_status: string;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// La risposta del cliente è jsonb di forma libera. Una sola chiave (es. { text })
// la mostriamo come paragrafo pulito; più chiavi -> elenco chiave→valore.
function renderResponse(response: unknown) {
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const entries = Object.entries(response as Record<string, unknown>);
    if (entries.length === 0) return null;
    if (entries.length === 1) {
      return (
        <p className="whitespace-pre-wrap text-sm text-neutral-200">
          {String(entries[0][1])}
        </p>
      );
    }
    return (
      <dl className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs text-neutral-500">{key}</dt>
            <dd className="text-sm text-neutral-200">{String(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-neutral-200">
      {String(response)}
    </p>
  );
}

export default async function CheckinDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ summarized?: string; approved?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { summarized, approved, error } = await searchParams;
  const supabase = await createClient();

  const { data: checkin } = await supabase
    .from("checkins")
    .select(
      "id, client_id, prompt, status, scheduled_for, response, responded_at, ai_summary, summary_status",
    )
    .eq("id", id)
    .maybeSingle();

  if (!checkin) notFound();
  const c = checkin as Checkin;

  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", c.client_id)
    .maybeSingle();

  const isAnswered = c.status === "answered";
  const hasResponse =
    c.response !== null &&
    c.response !== undefined &&
    !(typeof c.response === "object" && Object.keys(c.response).length === 0);

  return (
    <Page>
      <BackLink href="/coach/checkin">Tutti i check-in</BackLink>

      <PageHeader
        eyebrow={`Programmato per ${formatDate(c.scheduled_for)}`}
        title={client?.full_name ?? "Cliente"}
        action={<CheckinBadge status={c.status} />}
      />

      {summarized && <Banner tone="success">Sintesi AI generata come bozza.</Banner>}
      {approved && <Banner tone="success">Sintesi approvata.</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {/* Domanda */}
      <section>
        <SectionLabel>Domanda</SectionLabel>
        <Card>
          <p className="whitespace-pre-wrap text-sm text-neutral-200">{c.prompt}</p>
        </Card>
      </section>

      {/* Risposta del cliente */}
      <section>
        <SectionLabel>Risposta del cliente</SectionLabel>
        <Card>
          {hasResponse ? (
            <>
              {renderResponse(c.response)}
              {c.responded_at && (
                <p className="mt-3 text-xs text-neutral-500">
                  Risposto il {formatDate(c.responded_at)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              In attesa di risposta dal cliente.
            </p>
          )}
        </Card>
      </section>

      {/* Sintesi AI */}
      <section>
        <SectionLabel
          right={
            c.ai_summary ? <ArtifactBadge status={c.summary_status} gender="f" /> : undefined
          }
        >
          Sintesi AI
        </SectionLabel>

        {!isAnswered ? (
          <Card tone="dashed">
            <p className="text-sm text-neutral-500">
              La sintesi sarà disponibile quando il cliente avrà risposto.
            </p>
          </Card>
        ) : !c.ai_summary ? (
          <form action={generateCheckinSummary}>
            <input type="hidden" name="checkin_id" value={c.id} />
            <GenerateButton />
            <p className="mt-2 text-xs text-neutral-500">
              L&apos;AI riassume la risposta in pochi secondi. La rivedi e approvi.
            </p>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <Card>
              <p className="whitespace-pre-wrap text-sm text-neutral-200">
                {c.ai_summary}
              </p>
            </Card>
            {c.summary_status !== "approved" && (
              <div className="flex gap-2">
                <form action={generateCheckinSummary} className="flex-1">
                  <input type="hidden" name="checkin_id" value={c.id} />
                  <SubmitButton className={`${btn.secondary} w-full`} pendingText="Rigenero…">
                    Rigenera
                  </SubmitButton>
                </form>
                <form action={approveCheckinSummary} className="flex-1">
                  <input type="hidden" name="checkin_id" value={c.id} />
                  <SubmitButton className={`${btn.primary} w-full`} pendingText="Attendi…">
                    Approva sintesi
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>
        )}
      </section>
    </Page>
  );
}
