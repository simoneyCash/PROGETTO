import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { publishNutritionPlan } from "../actions";
import { ArtifactBadge } from "@/components/ui/StatusBadge";
import { NutritionEditor, type NutritionContent } from "@/components/NutritionEditor";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Page, BackLink, PageHeader, SectionLabel, Card, Banner, btn } from "@/components/ui/kit";

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
    <div className="flex flex-col gap-3">
      {c.summary && <p className="text-sm text-neutral-300">{c.summary}</p>}

      {macros.length === 0 && c.meals.length === 0 && (
        <p className="text-sm text-neutral-500">Questo piano è ancora vuoto.</p>
      )}

      {macros.length > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {macros.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-3"
            >
              <div className="text-base font-semibold">{m.value}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {c.meals.map((meal, i) => (
        <Card key={i}>
          <h3 className="font-semibold">{meal.name || "Pasto"}</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {meal.items.map((it, j) => (
              <li key={j} className="flex justify-between gap-3 text-sm">
                <span className="text-neutral-200">{it.food}</span>
                <span className="shrink-0 text-neutral-500">{it.quantity}</span>
              </li>
            ))}
          </ul>
          {meal.notes && (
            <p className="mt-2 border-t border-white/10 pt-2 text-xs text-neutral-400">
              {meal.notes}
            </p>
          )}
        </Card>
      ))}

      {c.coach_notes && (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Note del coach (private)
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-300">
            {c.coach_notes}
          </p>
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
      <BackLink href="/coach/nutrizione">Tutti i piani</BackLink>

      <PageHeader
        eyebrow={client?.full_name ?? "Cliente"}
        title={p.title ?? "Senza titolo"}
        action={<ArtifactBadge status={p.status} gender="m" />}
      />

      {published && (
        <Banner tone="success">Piano pubblicato: ora è visibile al cliente.</Banner>
      )}
      {saved && <Banner tone="success">Modifiche salvate.</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {/* Bozza strutturata (AI o editor): editor se modificabile, sola lettura se pubblicato */}
      {structured ? (
        isPublished ? (
          <section>
            <SectionLabel>Piano</SectionLabel>
            <PlanView c={structured} />
          </section>
        ) : (
          <NutritionEditor planId={p.id} initialContent={structured} />
        )
      ) : (
        // Vecchio piano a testo libero
        <>
          <section>
            <SectionLabel>Contenuto</SectionLabel>
            <Card>
              {body ? (
                <p className="whitespace-pre-wrap text-sm text-neutral-200">{body}</p>
              ) : (
                <p className="text-sm text-neutral-500">
                  Nessun contenuto. Genera una bozza con l&apos;AI dalla pagina
                  Nutrizione.
                </p>
              )}
            </Card>
          </section>

          {!isPublished && (
            <form action={publishNutritionPlan}>
              <input type="hidden" name="plan_id" value={p.id} />
              <SubmitButton className={`${btn.primary} w-full`} pendingText="Pubblico…">
                Approva e pubblica
              </SubmitButton>
              <p className="mt-2 text-xs text-neutral-500">
                Finché è una bozza, il cliente non la vede.
              </p>
            </form>
          )}
        </>
      )}
    </Page>
  );
}
