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
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";

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
      <BackLink href="/coach">Dashboard</BackLink>

      <PageHeader eyebrow="Area coach" title="Check-in" />
      <p className="-mt-4 text-xs text-neutral-500">
        Programma una domanda periodica. Il cliente risponderà dal suo portale
        (in arrivo); poi l&apos;AI riassumerà e tu approverai.
      </p>

      {created && <Banner tone="success">Check-in programmato.</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {/* Nuovo check-in */}
      <section>
        <SectionLabel>Nuovo check-in</SectionLabel>

        {clients.length === 0 ? (
          <EmptyState>
            Aggiungi prima un cliente in{" "}
            <Link href="/coach/clienti" className="text-accent underline">
              Clienti
            </Link>
            .
          </EmptyState>
        ) : (
          <form action={createCheckin} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-300">Cliente</span>
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

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-300">
                Domanda del check-in
              </span>
              <textarea
                name="prompt"
                defaultValue={DEFAULT_PROMPT}
                rows={6}
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-300">
                Data programmata{" "}
                <span className="text-neutral-500">(opzionale)</span>
              </span>
              <input type="date" name="scheduled_for" className={field} />
            </label>

            <SubmitButton className={btn.primary} pendingText="Programmo…">
              Programma check-in
            </SubmitButton>
          </form>
        )}
      </section>

      {/* Lista check-in */}
      <section>
        <SectionLabel>Tutti i check-in ({checkins.length})</SectionLabel>
        <ul className="flex flex-col gap-1.5">
          {checkins.length === 0 && (
            <li>
              <EmptyState icon={ClipboardCheck}>
                Nessun check-in ancora.
              </EmptyState>
            </li>
          )}
          {checkins.map((c) => (
            <li key={c.id}>
              <Link
                href={`/coach/checkin/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/20"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {clientName.get(c.client_id) ?? "Cliente"}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {formatDate(c.scheduled_for)}
                  </span>
                </span>
                <CheckinBadge status={c.status} />
                <ChevronRight className="size-4 shrink-0 text-neutral-600" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
