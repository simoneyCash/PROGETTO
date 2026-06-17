import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Dashboard
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">Pagamenti</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Abbonamenti e incassi dei tuoi clienti.
        </p>
      </header>

      <div className="mt-5 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-xs text-sky-300/90">
        Questa pagina si popola da sola quando colleghiamo <b>Stripe</b>. Per ora
        è la struttura, pronta a ricevere abbonamenti e pagamenti.
      </div>

      {/* Abbonamenti */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">
          Abbonamenti <span className="text-neutral-500">({subs.length})</span>
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {subs.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
              Nessun abbonamento ancora.
            </li>
          )}
          {subs.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3"
            >
              <span className="font-medium">
                {s.client_id ? clientName.get(s.client_id) ?? "Cliente" : "—"}
              </span>
              <span className="text-xs text-neutral-400">{s.status ?? "—"}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Pagamenti */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">
          Pagamenti recenti{" "}
          <span className="text-neutral-500">({payments.length})</span>
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {payments.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
              Nessun pagamento ancora.
            </li>
          )}
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3"
            >
              <span className="min-w-0">
                <span className="block font-medium">
                  {formatAmount(p.amount_cents, p.currency)}
                </span>
                <span className="block text-xs text-neutral-500">
                  {p.client_id ? clientName.get(p.client_id) ?? "Cliente" : "—"}
                </span>
              </span>
              <span className="text-xs text-neutral-400">{p.status ?? "—"}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
