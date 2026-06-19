import Link from "next/link";
import { ClipboardCheck, ChevronRight } from "@/components/ui/icons";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { createCheckin } from "./actions";
import { CheckinBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  Row,
  Avatar,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

type ClientRow = { id: string; full_name: string };
type CheckinRow = {
  id: string;
  client_id: string;
  prompt: string | null;
  status: string;
  scheduled_for: string | null;
  created_at: string;
};

const DEFAULT_PROMPT = `Com'è andata questa settimana?
- Peso (kg):
- Aderenza ad allenamenti e dieta (1-10):
- Energia e sonno:
- Note o difficoltà:`;

function formatDate(value: string | null): string {
  if (!value) return "Senza data";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CoachCheckins({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { error, created } = await searchParams;

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  const clients = (clientsData ?? []) as ClientRow[];
  const clientName = new Map(clients.map((c) => [c.id, c.full_name]));

  const { data: checkinsData } = await supabase
    .from("checkins")
    .select("id, client_id, prompt, status, scheduled_for, created_at")
    .order("created_at", { ascending: false });
  const checkins = (checkinsData ?? []) as CheckinRow[];

  return (
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach">Dashboard</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader eyebrow="Area coach" title="Check-in" />
          <p className="-mt-4 text-xs text-muted">
            Programma una domanda periodica. Il cliente risponderà dal suo
            portale (in arrivo); poi l&apos;AI riassumerà e tu approverai.
          </p>
        </StaggerItem>

        {created && (
          <StaggerItem>
            <Banner tone="success">Check-in programmato.</Banner>
          </StaggerItem>
        )}
        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {/* Nuovo check-in */}
        <StaggerItem>
          <section>
            <SectionLabel>Nuovo check-in</SectionLabel>

            {clients.length === 0 ? (
              <EmptyState>
                Aggiungi prima un cliente in{" "}
                <Link
                  href="/coach/clienti"
                  className="text-foreground underline"
                >
                  Clienti
                </Link>
                .
              </EmptyState>
            ) : (
              <Card>
                <form action={createCheckin} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      Cliente
                    </span>
                    <select name="client_id" defaultValue="" className={field}>
                      <option value="" disabled>
                        Scegli un cliente…
                      </option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      Domanda del check-in
                    </span>
                    <textarea
                      name="prompt"
                      defaultValue={DEFAULT_PROMPT}
                      rows={6}
                      className={field}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      Data programmata{" "}
                      <span className="text-muted">(opzionale)</span>
                    </span>
                    <input type="date" name="scheduled_for" className={field} />
                  </label>

                  <SubmitButton className={btn.primary} pendingText="Programmo…">
                    Programma check-in
                  </SubmitButton>
                </form>
              </Card>
            )}
          </section>
        </StaggerItem>

        {/* Lista check-in */}
        <StaggerItem>
          <section>
            <SectionLabel>
              Tutti i check-in (<AnimatedNumber value={checkins.length} />)
            </SectionLabel>
            {checkins.length === 0 ? (
              <EmptyState icon={ClipboardCheck}>
                Nessun check-in ancora.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {checkins.map((c) => {
                  const name = clientName.get(c.client_id) ?? "Cliente";
                  return (
                    <Row
                      key={c.id}
                      href={`/coach/checkin/${c.id}`}
                      leading={<Avatar name={name} />}
                      title={name}
                      subtitle={formatDate(c.scheduled_for)}
                      trailing={
                        <>
                          <CheckinBadge status={c.status} />
                          <ChevronRight className="size-4" />
                        </>
                      }
                    />
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
