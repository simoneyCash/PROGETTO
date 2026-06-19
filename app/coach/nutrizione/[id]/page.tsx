import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { publishNutritionPlan } from "../actions";
import { ArtifactBadge } from "@/components/ui/StatusBadge";
import { NutritionEditor, type NutritionContent } from "@/components/NutritionEditor";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Salad } from "@/components/ui/icons";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  Banner,
  Stat,
  Row,
  EmptyState,
  btn,
} from "@/components/ui/kit";
import { Stagger, StaggerItem } from "@/components/ui/motion";

type Plan = {
  id: string;
  client_id: string;
  title: string | null;
  status: string;
  content: unknown;
};

// Piano "strutturato" = generato dall'AI / editor (ha l'array meals). Altrimenti
// è un vecchio piano a testo libero ({ text }).
function asStructured(content: unknown): NutritionContent | null {
  if (
    content &&
    typeof content === "object" &&
    Array.isArray((content as { meals?: unknown }).meals)
  ) {
    return content as NutritionContent;
  }
  return null;
}

function planText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const t = (content as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

// Vista in sola lettura del piano strutturato (per i piani già pubblicati).
function PlanView({ c }: { c: NutritionContent }) {
  const macros = [
    c.daily_calories ? { label: "Kcal", value: String(c.daily_calories) } : null,
    c.protein_g ? { label: "Proteine", value: `${c.protein_g} g` } : null,
    c.carbs_g ? { label: "Carbo", value: `${c.carbs_g} g` } : null,
    c.fat_g ? { label: "Grassi", value: `${c.fat_g} g` } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="flex flex-col gap-6">
      {c.summary && <p className="text-sm text-muted">{c.summary}</p>}

      {macros.length === 0 && c.meals.length === 0 && (
        <EmptyState icon={Salad}>Questo piano è ancora vuoto.</EmptyState>
      )}

      {macros.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {macros.map((m) => (
            <Stat key={m.label} label={m.label} value={m.value} />
          ))}
        </div>
      )}

      {c.meals.length > 0 && (
        <div className="flex flex-col gap-3">
          {c.meals.map((meal, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">{meal.name || "Pasto"}</h3>
              <div className="flex flex-col gap-2">
                {meal.items.map((it, j) => (
                  <Row
                    key={j}
                    title={it.food}
                    trailing={
                      <span className="text-sm tabular-nums text-muted">
                        {it.quantity}
                      </span>
                    }
                  />
                ))}
              </div>
              {meal.notes && (
                <p className="border-t border-border pt-3 text-xs text-muted">
                  {meal.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {c.coach_notes && (
        <Card className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Note del coach (private)
          </p>
          <p className="whitespace-pre-wrap text-sm text-muted">{c.coach_notes}</p>
        </Card>
      )}
    </div>
  );
}

export default async function NutritionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; saved?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { published, saved, error } = await searchParams;

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, client_id, title, status, content")
    .eq("id", id)
    .maybeSingle();

  if (!plan) notFound();
  const p = plan as Plan;

  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", p.client_id)
    .maybeSingle();

  const structured = asStructured(p.content);
  const body = planText(p.content);
  const isPublished = p.status === "published";

  return (
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach/nutrizione">Tutti i piani</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader
            eyebrow={client?.full_name ?? "Cliente"}
            title={p.title ?? "Senza titolo"}
            action={<ArtifactBadge status={p.status} gender="m" />}
          />
        </StaggerItem>

        {published && (
          <StaggerItem>
            <Banner tone="success">Piano pubblicato: ora è visibile al cliente.</Banner>
          </StaggerItem>
        )}
        {saved && (
          <StaggerItem>
            <Banner tone="success">Modifiche salvate.</Banner>
          </StaggerItem>
        )}
        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {/* Bozza strutturata (AI o editor): editor se modificabile, sola lettura se pubblicato */}
        {structured ? (
          isPublished ? (
            <StaggerItem>
              <section>
                <SectionLabel>Piano</SectionLabel>
                <PlanView c={structured} />
              </section>
            </StaggerItem>
          ) : (
            <StaggerItem>
              <NutritionEditor planId={p.id} initialContent={structured} />
            </StaggerItem>
          )
        ) : (
          // Vecchio piano a testo libero
          <>
            <StaggerItem>
              <section>
                <SectionLabel>Contenuto</SectionLabel>
                {body ? (
                  <Card>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{body}</p>
                  </Card>
                ) : (
                  <EmptyState icon={Salad}>
                    Nessun contenuto. Genera una bozza con l&apos;AI dalla pagina
                    Nutrizione.
                  </EmptyState>
                )}
              </section>
            </StaggerItem>

            {!isPublished && (
              <StaggerItem>
                <form action={publishNutritionPlan} className="flex flex-col gap-2">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <SubmitButton className={`${btn.primary} w-full`} pendingText="Pubblico…">
                    Approva e pubblica
                  </SubmitButton>
                  <p className="text-xs text-faint">
                    Finché è una bozza, il cliente non la vede.
                  </p>
                </form>
              </StaggerItem>
            )}
          </>
        )}
      </Stagger>
    </Page>
  );
}
