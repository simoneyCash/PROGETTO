import { redirect } from "next/navigation";
import { CreditCard, Receipt } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  EmptyState,
  Banner,
} from "@/components/ui/kit";

type ClientRow = { id: string; full_name: string };
type SubRow = {
  id: string;
  client_id: string | null;
  status: string | null;
  current_period_end: string | null;
};
type PaymentRow = {
  id: string;
  client_id: string | null;
  amount_cents: number | null;
  currency: string;
  status: string | null;
  paid_at: string | null;
};

function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default async function CoachPayments() {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name");
  const clientName = new Map(
    ((clientsData ?? []) as ClientRow[]).map((c) => [c.id, c.full_name]),
  );

  const { data: subsData } = await supabase
    .from("subscriptions")
    .select("id, client_id, status, current_period_end")
    .order("created_at", { ascending: false });
  const subs = (subsData ?? []) as SubRow[];

  const { data: payData } = await supabase
    .from("payments")
    .select("id, client_id, amount_cents, currency, status, paid_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const payments = (payData ?? []) as PaymentRow[];

  return (
    <Page>
      <BackLink href="/coach">Dashboard</BackLink>

      <PageHeader
        eyebrow="Abbonamenti e incassi dei tuoi clienti"
        title="Pagamenti"
      />

      <Banner tone="info">
        Questa pagina si popola da sola quando colleghiamo <b>Stripe</b>. Per ora
        è la struttura, pronta a ricevere abbonamenti e pagamenti.
      </Banner>

      {/* Abbonamenti */}
      <section>
        <SectionLabel right={<span className="text-xs text-neutral-500">{subs.length}</span>}>
          Abbonamenti
        </SectionLabel>
        {subs.length === 0 ? (
          <EmptyState icon={CreditCard}>Nessun abbonamento ancora.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {subs.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center justify-between">
                  <span className="font-medium">
                    {s.client_id ? clientName.get(s.client_id) ?? "Cliente" : "—"}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {s.status ?? "—"}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pagamenti */}
      <section>
        <SectionLabel right={<span className="text-xs text-neutral-500">{payments.length}</span>}>
          Pagamenti recenti
        </SectionLabel>
        {payments.length === 0 ? (
          <EmptyState icon={Receipt}>Nessun pagamento ancora.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {payments.map((p) => (
              <li key={p.id}>
                <Card className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {formatAmount(p.amount_cents, p.currency)}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {p.client_id
                        ? clientName.get(p.client_id) ?? "Cliente"
                        : "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {p.status ?? "—"}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
