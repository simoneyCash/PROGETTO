import Link from "next/link";
import { Salad, ChevronRight } from "@/components/ui/icons";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { createNutritionPlan, generateNutritionDraft } from "./actions";
import { ArtifactBadge } from "@/components/ui/StatusBadge";
import { GenerateButton } from "@/components/GenerateButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";

type ClientRow = { id: string; full_name: string };
type PlanRow = {
  id: string;
  client_id: string;
  title: string | null;
  status: string;
  created_at: string;
};

export default async function CoachNutrition({
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
  const clientName = new Map(clients.map((c) => [c.id, c.full_name]));

  const { data: plansData } = await supabase
    .from("nutrition_plans")
    .select("id, client_id, title, status, created_at")
    .order("created_at", { ascending: false });
  const plans = (plansData ?? []) as PlanRow[];

  return (
    <Page>
      <BackLink href="/coach">Dashboard</BackLink>

      <PageHeader eyebrow="Area coach" title="Nutrizione" />
      <p className="-mt-4 text-xs text-neutral-500">
        Crea un piano come bozza, poi pubblicalo: solo allora diventa visibile
        al cliente.
      </p>

      {error && <Banner tone="error">{error}</Banner>}

      {/* Genera con AI */}
      {clients.length > 0 && (
        <section>
          <SectionLabel>Genera con AI</SectionLabel>
          <form action={generateNutritionDraft} className="flex flex-col gap-3">
            <select name="client_id" defaultValue="" className={field} required>
              <option value="" disabled>
                Scegli un cliente…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            <GenerateButton />
            <p className="text-xs text-neutral-500">
              L&apos;AI crea una bozza dal questionario del cliente (serve
              l&apos;anamnesi compilata). Tu la rivedi e pubblichi.
            </p>
          </form>
        </section>
      )}

      {/* Nuovo piano a mano */}
      <section>
        <SectionLabel>Oppure crea a mano</SectionLabel>

        {clients.length === 0 ? (
          <EmptyState>
            Aggiungi prima un cliente in{" "}
            <Link href="/coach/clienti" className="text-accent underline">
              Clienti
            </Link>
            .
          </EmptyState>
        ) : (
          <form action={createNutritionPlan} className="flex flex-col gap-4">
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
              <span className="font-medium text-neutral-300">Titolo</span>
              <input
                name="title"
                placeholder="Es. Piano alimentare — fase di definizione"
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-300">
                Contenuto del piano{" "}
                <span className="text-neutral-500">(opzionale ora)</span>
              </span>
              <textarea
                name="body"
                rows={6}
                placeholder="Colazione…&#10;Pranzo…&#10;Cena…&#10;Note e integrazioni…"
                className={field}
              />
            </label>

            <SubmitButton className={btn.primary} pendingText="Creo…">
              Crea bozza
            </SubmitButton>
          </form>
        )}
      </section>

      {/* Lista piani */}
      <section>
        <SectionLabel>Tutti i piani ({plans.length})</SectionLabel>
        <ul className="flex flex-col gap-1.5">
          {plans.length === 0 && (
            <li>
              <EmptyState icon={Salad}>Nessun piano ancora.</EmptyState>
            </li>
          )}
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/coach/nutrizione/${p.id}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/20"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {p.title ?? "Senza titolo"}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {clientName.get(p.client_id) ?? "Cliente"}
                  </span>
                </span>
                <ArtifactBadge status={p.status} gender="m" />
                <ChevronRight className="size-4 shrink-0 text-neutral-600" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
