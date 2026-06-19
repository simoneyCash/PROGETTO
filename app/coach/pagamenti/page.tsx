import { redirect } from "next/navigation";
import { CreditCard, Receipt } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  EmptyState,
  Banner,
  Stat,
  Row,
  IconTile,
  Avatar,
} from "@/components/ui/kit";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach">Dashboard</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader
            eyebrow="Abbonamenti e incassi dei tuoi clienti"
            title="Pagamenti"
          />
        </StaggerItem>

        <StaggerItem>
          <Banner tone="info">
            Questa pagina si popola da sola quando colleghiamo <b>Stripe</b>. Per
            ora è la struttura, pronta a ricevere abbonamenti e pagamenti.
          </Banner>
        </StaggerItem>

        {/* KPI di sintesi */}
        <StaggerItem>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Abbonamenti" value={<AnimatedNumber value={subs.length} />} />
            <Stat
              label="Pagamenti recenti"
              value={<AnimatedNumber value={payments.length} />}
            />
          </div>
        </StaggerItem>

        {/* Abbonamenti */}
        <StaggerItem>
          <section>
            <SectionLabel right={<span className="text-xs text-faint">{subs.length}</span>}>
              Abbonamenti
            </SectionLabel>
            {subs.length === 0 ? (
              <EmptyState icon={CreditCard}>Nessun abbonamento ancora.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {subs.map((s) => {
                  const name = s.client_id
                    ? clientName.get(s.client_id) ?? "Cliente"
                    : "—";
                  return (
                    <li key={s.id}>
                      <Row
                        leading={
                          name === "—" ? (
                            <IconTile icon={CreditCard} tone="muted" />
                          ) : (
                            <Avatar name={name} />
                          )
                        }
                        title={name}
                        trailing={
                          <span className="text-xs text-muted">{s.status ?? "—"}</span>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </StaggerItem>

        {/* Pagamenti */}
        <StaggerItem>
          <section>
            <SectionLabel right={<span className="text-xs text-faint">{payments.length}</span>}>
              Pagamenti recenti
            </SectionLabel>
            {payments.length === 0 ? (
              <EmptyState icon={Receipt}>Nessun pagamento ancora.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {payments.map((p) => (
                  <li key={p.id}>
                    <Row
                      leading={<IconTile icon={Receipt} tone="muted" />}
                      title={formatAmount(p.amount_cents, p.currency)}
                      subtitle={
                        p.client_id ? clientName.get(p.client_id) ?? "Cliente" : "—"
                      }
                      trailing={
                        <span className="text-xs text-muted">{p.status ?? "—"}</span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
