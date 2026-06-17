import { redirect } from "next/navigation";
import { Salad } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { Page, BackLink, PageHeader, Card, EmptyState } from "@/components/ui/kit";

type Item = { food: string; quantity: string };
type Meal = { name: string; items: Item[]; notes: string };
type NutritionContent = {
  title?: string;
  summary?: string;
  daily_calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  meals?: Meal[];
};

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

export default async function ClientNutrition() {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, title, content, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const structured = plan ? asStructured(plan.content) : null;
  const body = plan ? planText(plan.content) : "";

  const macros = structured
    ? ([
        structured.daily_calories
          ? { label: "Kcal", value: String(structured.daily_calories) }
          : null,
        structured.protein_g
          ? { label: "Proteine", value: `${structured.protein_g} g` }
          : null,
        structured.carbs_g
          ? { label: "Carbo", value: `${structured.carbs_g} g` }
          : null,
        structured.fat_g ? { label: "Grassi", value: `${structured.fat_g} g` } : null,
      ].filter(Boolean) as { label: string; value: string }[])
    : [];

  return (
    <Page>
      <BackLink href="/cliente">La tua scheda</BackLink>

      <PageHeader title="Piano alimentare" />

      {!plan ? (
        <EmptyState icon={Salad}>
          Nessun piano alimentare pubblicato ancora. Comparirà qui quando il coach
          lo pubblica.
        </EmptyState>
      ) : structured ? (
        <>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {structured.title ?? plan.title ?? "Piano"}
            </h2>
            {structured.summary && (
              <p className="mt-1.5 text-sm text-neutral-400">{structured.summary}</p>
            )}
          </div>

          {macros.length === 0 && (structured.meals ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">
              Questo piano è ancora vuoto.
            </p>
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

          {(structured.meals ?? []).map((meal, i) => (
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
        </>
      ) : (
        <Card>
          <h2 className="font-semibold">{plan.title ?? "Piano"}</h2>
          {body ? (
            <p className="mt-3 whitespace-pre-wrap border-t border-white/10 pt-3 text-sm text-neutral-300">
              {body}
            </p>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">
              Il coach non ha ancora aggiunto il contenuto.
            </p>
          )}
        </Card>
      )}
    </Page>
  );
}
