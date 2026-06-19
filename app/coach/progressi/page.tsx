import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { generateProgressReport } from "@/app/coach/actions";
import { GenerateButton } from "@/components/GenerateButton";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Stat,
  Card,
  Avatar,
  EmptyState,
  Banner,
  btn,
} from "@/components/ui/kit";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

type ClientRow = { id: string; full_name: string };

export default async function CoachProgress({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  const clients = (clientsData ?? []) as ClientRow[];

  const { data: logsData } = await supabase
    .from("workout_logs")
    .select("client_id")
    .limit(2000);
  const workoutsByClient = new Map<string, number>();
  for (const r of (logsData ?? []) as { client_id: string }[]) {
    workoutsByClient.set(r.client_id, (workoutsByClient.get(r.client_id) ?? 0) + 1);
  }

  const { data: checkinsData } = await supabase
    .from("checkins")
    .select("client_id, status")
    .limit(2000);
  const answeredByClient = new Map<string, number>();
  for (const r of (checkinsData ?? []) as { client_id: string; status: string }[]) {
    if (r.status === "answered") {
      answeredByClient.set(r.client_id, (answeredByClient.get(r.client_id) ?? 0) + 1);
    }
  }

  // Ultimo report progressi per cliente (per il link "vedi report").
  const { data: reportsData } = await supabase
    .from("progress_reports")
    .select("id, client_id, status, created_at")
    .order("created_at", { ascending: false });
  const latestReport = new Map<string, { id: string; status: string }>();
  for (const r of (reportsData ?? []) as {
    id: string;
    client_id: string;
    status: string;
  }[]) {
    if (!latestReport.has(r.client_id)) {
      latestReport.set(r.client_id, { id: r.id, status: r.status });
    }
  }

  const totalWorkouts = clients.reduce(
    (sum, c) => sum + (workoutsByClient.get(c.id) ?? 0),
    0,
  );
  const totalAnswered = clients.reduce(
    (sum, c) => sum + (answeredByClient.get(c.id) ?? 0),
    0,
  );

  return (
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach">Dashboard</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader eyebrow="Attività e analisi AI" title="Progressi" />
        </StaggerItem>

        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        <StaggerItem>
          <Banner tone="info">
            L'AI analizza allenamenti e check-in di un cliente e prepara una{" "}
            <b>bozza di report</b> che tu revisioni e approvi.
          </Banner>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Clienti" value={<AnimatedNumber value={clients.length} />} />
            <Stat label="Allenamenti" value={<AnimatedNumber value={totalWorkouts} />} />
            <Stat label="Check-in" value={<AnimatedNumber value={totalAnswered} />} />
          </div>
        </StaggerItem>

        <StaggerItem>
          <section>
            <SectionLabel>Per cliente</SectionLabel>
            {clients.length === 0 ? (
              <EmptyState icon={LineChart}>
                Aggiungi prima un cliente in{" "}
                <Link href="/coach/clienti" className="text-foreground underline">
                  Clienti
                </Link>
                .
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {clients.map((c) => {
                  const report = latestReport.get(c.id);
                  return (
                    <Card key={c.id}>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.full_name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {c.full_name}
                          </p>
                          <p className="text-xs text-muted">
                            <b className="text-foreground">
                              {workoutsByClient.get(c.id) ?? 0}
                            </b>{" "}
                            allenamenti
                            <span className="px-1.5 text-faint">·</span>
                            <b className="text-foreground">
                              {answeredByClient.get(c.id) ?? 0}
                            </b>{" "}
                            check-in
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <form action={generateProgressReport} className="flex-1">
                          <input type="hidden" name="client_id" value={c.id} />
                          <GenerateButton
                            idleLabel="Analizza con AI"
                            pendingLabel="Analisi in corso…"
                          />
                        </form>
                        {report && (
                          <Link
                            href={`/coach/progressi/${report.id}`}
                            className={`${btn.secondary} shrink-0`}
                          >
                            Ultimo report
                          </Link>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
