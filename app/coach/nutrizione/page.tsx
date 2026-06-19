import Link from "next/link";
import { Salad, Sparkles, ChevronRight } from "@/components/ui/icons";
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
  Card,
  IconTile,
  Row,
  Avatar,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach">Dashboard</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader eyebrow="Area coach" title="Nutrizione" />
          <p className="-mt-4 text-xs text-muted">
            Crea un piano come bozza, poi pubblicalo: solo allora diventa
            visibile al cliente.
          </p>
        </StaggerItem>

        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {/* Genera con AI */}
        {clients.length > 0 && (
          <StaggerItem>
            <section>
              <SectionLabel>Genera con AI</SectionLabel>
              <Card>
                <div className="mb-3 flex items-start gap-3">
                  <IconTile icon={Sparkles} />
                  <p className="text-xs text-muted">
                    L&apos;AI crea una bozza dal questionario del cliente (serve
                    l&apos;anamnesi compilata). Tu la rivedi e pubblichi.
                  </p>
                </div>
                <form
                  action={generateNutritionDraft}
                  className="flex flex-col gap-3"
                >
                  <select
                    name="client_id"
                    defaultValue=""
                    className={field}
                    required
                  >
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
                </form>
              </Card>
            </section>
          </StaggerItem>
        )}

        {/* Nuovo piano a mano */}
        <StaggerItem>
          <section>
            <SectionLabel>Oppure crea a mano</SectionLabel>

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
                <form
                  action={createNutritionPlan}
                  className="flex flex-col gap-4"
                >
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-foreground">Cliente</span>
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
                    <span className="font-medium text-foreground">Titolo</span>
                    <input
                      name="title"
                      placeholder="Es. Piano alimentare — fase di definizione"
                      className={field}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-foreground">
                      Contenuto del piano{" "}
                      <span className="text-muted">(opzionale ora)</span>
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
              </Card>
            )}
          </section>
        </StaggerItem>

        {/* Lista piani */}
        <StaggerItem>
          <section>
            <SectionLabel>
              Tutti i piani (<AnimatedNumber value={plans.length} />)
            </SectionLabel>
            {plans.length === 0 ? (
              <EmptyState icon={Salad}>Nessun piano ancora.</EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {plans.map((p) => (
                  <Row
                    key={p.id}
                    href={`/coach/nutrizione/${p.id}`}
                    leading={
                      <Avatar name={clientName.get(p.client_id) ?? "Cliente"} />
                    }
                    title={p.title ?? "Senza titolo"}
                    subtitle={clientName.get(p.client_id) ?? "Cliente"}
                    trailing={
                      <>
                        <ArtifactBadge status={p.status} gender="m" />
                        <ChevronRight className="size-4" />
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
