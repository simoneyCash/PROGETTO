import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { generateCheckinSummary, approveCheckinSummary } from "../actions";
import { CheckinBadge, ArtifactBadge } from "@/components/ui/StatusBadge";
import { GenerateButton } from "@/components/GenerateButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { MessageCircle, SmilePlus, Sparkles } from "@/components/ui/icons";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  IconTile,
  Avatar,
  Banner,
  btn,
} from "@/components/ui/kit";
import { Stagger, StaggerItem } from "@/components/ui/motion";

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
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {String(entries[0][1])}
        </p>
      );
    }
    return (
      <dl className="flex flex-col gap-3">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-faint">
              {key}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">{String(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-foreground">
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
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach/checkin">Tutti i check-in</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader
            eyebrow={`Programmato per ${formatDate(c.scheduled_for)}`}
            title={client?.full_name ?? "Cliente"}
            action={<CheckinBadge status={c.status} />}
          />
        </StaggerItem>

        {summarized && (
          <StaggerItem>
            <Banner tone="success">Sintesi AI generata come bozza.</Banner>
          </StaggerItem>
        )}
        {approved && (
          <StaggerItem>
            <Banner tone="success">Sintesi approvata.</Banner>
          </StaggerItem>
        )}
        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {/* Domanda */}
        <StaggerItem>
          <section>
            <SectionLabel>Domanda</SectionLabel>
            <Card className="flex items-start gap-3">
              <IconTile icon={MessageCircle} tone="muted" />
              <p className="min-w-0 flex-1 whitespace-pre-wrap pt-1.5 text-sm text-foreground">
                {c.prompt}
              </p>
            </Card>
          </section>
        </StaggerItem>

        {/* Risposta del cliente */}
        <StaggerItem>
          <section>
            <SectionLabel>Risposta del cliente</SectionLabel>
            <Card>
              {hasResponse ? (
                <div className="flex items-start gap-3">
                  <Avatar name={client?.full_name ?? "Cliente"} />
                  <div className="min-w-0 flex-1">
                    {renderResponse(c.response)}
                    {c.responded_at && (
                      <p className="mt-3 text-xs text-faint">
                        Risposto il {formatDate(c.responded_at)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <IconTile icon={SmilePlus} tone="muted" />
                  <p className="text-sm text-muted">
                    In attesa di risposta dal cliente.
                  </p>
                </div>
              )}
            </Card>
          </section>
        </StaggerItem>

        {/* Sintesi AI */}
        <StaggerItem>
          <section>
            <SectionLabel
              right={
                c.ai_summary ? <ArtifactBadge status={c.summary_status} gender="f" /> : undefined
              }
            >
              Sintesi AI
            </SectionLabel>

            {!isAnswered ? (
              <Card tone="dashed" className="flex items-center gap-3">
                <IconTile icon={Sparkles} tone="muted" />
                <p className="text-sm text-muted">
                  La sintesi sarà disponibile quando il cliente avrà risposto.
                </p>
              </Card>
            ) : !c.ai_summary ? (
              <form action={generateCheckinSummary}>
                <input type="hidden" name="checkin_id" value={c.id} />
                <GenerateButton />
                <p className="mt-2 text-xs text-faint">
                  L&apos;AI riassume la risposta in pochi secondi. La rivedi e approvi.
                </p>
              </form>
            ) : (
              <div className="flex flex-col gap-3">
                <Card className="flex items-start gap-3">
                  <IconTile icon={Sparkles} />
                  <p className="min-w-0 flex-1 whitespace-pre-wrap pt-1.5 text-sm text-foreground">
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
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
