import { notFound, redirect } from "next/navigation";
import {
  Sparkles,
  CircleCheck,
  TriangleAlert,
  ArrowUp,
  Dumbbell,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { approveProgressReport, generateProgressReport } from "@/app/coach/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { GenerateButton } from "@/components/GenerateButton";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  IconTile,
  Stat,
  Banner,
  btn,
} from "@/components/ui/kit";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

type StrengthChange = { exercise: string; change: string };
type ReportContent = {
  headline?: string;
  summary?: string;
  highlights?: string[];
  strength_changes?: StrengthChange[];
  adherence_note?: string;
  suggestions?: string[];
  concerns?: string[];
  workouts_completed?: number;
  checkins_answered?: number;
};

const fmt = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
    : "";

const STATUS_LABEL: Record<string, string> = {
  draft: "Bozza",
  pending_review: "Da rivedere",
  approved: "Approvato",
  published: "Pubblicato",
  archived: "Archiviato",
};

export default async function ProgressReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ approved?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { approved, error } = await searchParams;

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("progress_reports")
    .select("id, client_id, status, period_start, period_end, content, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!report) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", report.client_id)
    .maybeSingle();

  const c = (report.content ?? {}) as ReportContent;
  const isDraft = report.status === "draft";
  const concerns = c.concerns ?? [];
  const highlights = c.highlights ?? [];
  const strength = c.strength_changes ?? [];
  const suggestions = c.suggestions ?? [];

  return (
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach/progressi">Progressi</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader
            eyebrow={`${client?.full_name ?? "Cliente"} · ${fmt(
              report.period_start,
            )}–${fmt(report.period_end)}`}
            title="Report progressi"
            action={
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  report.status === "approved" || report.status === "published"
                    ? "bg-accent/15 text-accent"
                    : "bg-white/[0.06] text-muted"
                }`}
              >
                {STATUS_LABEL[report.status] ?? report.status}
              </span>
            }
          />
        </StaggerItem>

        {approved && (
          <StaggerItem>
            <Banner tone="success">Report approvato. ✓</Banner>
          </StaggerItem>
        )}
        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {/* Sintesi */}
        <StaggerItem>
          <Card tone="accent">
            <div className="flex items-start gap-3">
              <IconTile icon={Sparkles} />
              <div className="min-w-0">
                {c.headline && (
                  <h2 className="text-lg font-semibold tracking-tight">
                    {c.headline}
                  </h2>
                )}
                {c.summary && (
                  <p className="mt-1 text-sm text-muted">{c.summary}</p>
                )}
              </div>
            </div>
          </Card>
        </StaggerItem>

        {/* Aderenza (numeri dai dati) */}
        <StaggerItem>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Allenamenti"
              value={<AnimatedNumber value={c.workouts_completed ?? 0} />}
            />
            <Stat
              label="Check-in risposti"
              value={<AnimatedNumber value={c.checkins_answered ?? 0} />}
            />
          </div>
        </StaggerItem>
        {c.adherence_note && (
          <StaggerItem>
            <p className="-mt-3 text-sm text-muted">{c.adherence_note}</p>
          </StaggerItem>
        )}

        {/* Forza */}
        {strength.length > 0 && (
          <StaggerItem>
            <section>
              <SectionLabel>Forza</SectionLabel>
              <div className="flex flex-col gap-2">
                {strength.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-3 py-3"
                  >
                    <IconTile icon={ArrowUp} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.exercise}</p>
                      <p className="text-xs text-muted">{s.change}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </StaggerItem>
        )}

        {/* Punti di forza */}
        {highlights.length > 0 && (
          <StaggerItem>
            <section>
              <SectionLabel>Cosa va bene</SectionLabel>
              <Card>
                <ul className="flex flex-col gap-2.5">
                  {highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </StaggerItem>
        )}

        {/* Suggerimenti (decide il coach) */}
        {suggestions.length > 0 && (
          <StaggerItem>
            <section>
              <SectionLabel>Spunti da valutare</SectionLabel>
              <Card>
                <ul className="flex flex-col gap-2.5">
                  {suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-muted" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </StaggerItem>
        )}

        {/* Da attenzionare */}
        {concerns.length > 0 && (
          <StaggerItem>
            <section>
              <SectionLabel>Da attenzionare</SectionLabel>
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
                <ul className="flex flex-col gap-2">
                  {concerns.map((x, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm text-foreground"
                    >
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </StaggerItem>
        )}

        {/* Azioni: approva (se bozza) + rigenera */}
        <StaggerItem>
          <div className="flex flex-col gap-3">
            {isDraft && (
              <form action={approveProgressReport}>
                <input type="hidden" name="report_id" value={report.id} />
                <SubmitButton
                  className={`${btn.primary} w-full`}
                  pendingText="Approvazione…"
                >
                  <CircleCheck className="size-5" />
                  Approva report
                </SubmitButton>
              </form>
            )}
            <form action={generateProgressReport}>
              <input type="hidden" name="client_id" value={report.client_id} />
              <GenerateButton
                idleLabel="Rigenera analisi"
                pendingLabel="Analisi in corso…"
              />
            </form>
          </div>
        </StaggerItem>

        <StaggerItem>
          <p className="flex items-center gap-1.5 text-center text-xs text-faint">
            <Dumbbell className="size-3.5" />
            Bozza generata dall'AI sui dati di allenamento e check-in. Rivedila
            prima di considerarla valida.
          </p>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
