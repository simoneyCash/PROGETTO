import { redirect } from "next/navigation";
import { Salad, UtensilsCrossed } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  IconTile,
  EmptyState,
  Dot,
} from "@/components/ui/client";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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

  // Macro come "quota" sul totale grammi → barre colorate (stile consumer).
  const macros = structured
    ? ([
        { label: "Carboidrati", grams: structured.carbs_g, color: "var(--c-carbs)" },
        { label: "Grassi", grams: structured.fat_g, color: "var(--c-fat)" },
        { label: "Proteine", grams: structured.protein_g, color: "var(--c-protein)" },
      ].filter((m) => typeof m.grams === "number" && m.grams! > 0) as {
        label: string;
        grams: number;
        color: string;
      }[])
    : [];
  const totalGrams = macros.reduce((s, m) => s + m.grams, 0);
  const hasGoals =
    !!structured &&
    (typeof structured.daily_calories === "number" || macros.length > 0);

  return (
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/cliente">Oggi</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader title="Piano alimentare" />
        </StaggerItem>

        {!plan ? (
          <StaggerItem>
            <EmptyState icon={Salad}>
              Nessun piano alimentare pubblicato ancora. Comparirà qui quando il
              coach lo pubblica.
            </EmptyState>
          </StaggerItem>
        ) : structured ? (
          <>
            <StaggerItem>
              <Card>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={Salad} color="var(--c-carbs)" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                      {structured.title ?? plan.title ?? "Piano"}
                    </h2>
                    {structured.summary && (
                      <p className="mt-1 text-sm text-muted">
                        {structured.summary}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </StaggerItem>

            {!hasGoals && (structured.meals ?? []).length === 0 && (
              <StaggerItem>
                <p className="text-sm text-faint">Questo piano è ancora vuoto.</p>
              </StaggerItem>
            )}

            {hasGoals && (
              <StaggerItem>
                <section>
                  <SectionLabel>Obiettivi giornalieri</SectionLabel>
                  <Card>
                    {typeof structured.daily_calories === "number" && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-[40px] font-extrabold leading-none tabular-nums text-foreground">
                          <AnimatedNumber value={structured.daily_calories} />
                        </span>
                        <span className="text-[15px] font-semibold text-muted">
                          kcal / giorno
                        </span>
                      </div>
                    )}

                    {macros.length > 0 && (
                      <div
                        className={`flex flex-col gap-4 ${
                          typeof structured.daily_calories === "number"
                            ? "mt-5 border-t border-border pt-5"
                            : ""
                        }`}
                      >
                        {macros.map((m) => {
                          const share =
                            totalGrams > 0 ? m.grams / totalGrams : 0;
                          return (
                            <div key={m.label}>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                                  <Dot color={m.color} />
                                  {m.label}
                                </span>
                                <span className="text-[14px] font-bold tabular-nums text-foreground">
                                  {m.grams} g
                                </span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.round(share * 100)}%`,
                                    background: m.color,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </section>
              </StaggerItem>
            )}

            {(structured.meals ?? []).length > 0 && (
              <StaggerItem>
                <section>
                  <SectionLabel>Pasti</SectionLabel>
                  <div className="flex flex-col gap-3">
                    {(structured.meals ?? []).map((meal, i) => (
                      <Card key={i}>
                        <div className="flex items-center gap-3">
                          <IconTile
                            icon={UtensilsCrossed}
                            color="var(--c-protein)"
                            size="sm"
                          />
                          <h3 className="text-base font-bold text-foreground">
                            {meal.name || "Pasto"}
                          </h3>
                        </div>
                        <ul className="mt-3 flex flex-col gap-2">
                          {meal.items.map((it, j) => (
                            <li
                              key={j}
                              className="flex items-baseline justify-between gap-3 text-sm"
                            >
                              <span className="text-foreground">{it.food}</span>
                              <span className="shrink-0 font-mono text-xs text-muted">
                                {it.quantity}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {meal.notes && (
                          <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                            {meal.notes}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </section>
              </StaggerItem>
            )}
          </>
        ) : (
          <StaggerItem>
            <Card>
              <div className="flex items-center gap-3">
                <IconTile icon={Salad} color="var(--c-carbs)" />
                <h2 className="text-base font-bold text-foreground">
                  {plan.title ?? "Piano"}
                </h2>
              </div>
              {body ? (
                <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-muted">
                  {body}
                </p>
              ) : (
                <p className="mt-3 text-sm text-faint">
                  Il coach non ha ancora aggiunto il contenuto.
                </p>
              )}
            </Card>
          </StaggerItem>
        )}
      </Stagger>
    </Page>
  );
}
