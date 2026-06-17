"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUp, ArrowDown, X, Plus, TriangleAlert } from "@/components/ui/icons";
import { saveNutritionPlan } from "@/app/coach/nutrizione/actions";
import { btn } from "@/components/ui/kit";

type Item = { food: string; quantity: string };
type Meal = { name: string; items: Item[]; notes: string };
export type NutritionContent = {
  title: string;
  summary: string;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: Meal[];
  coach_notes: string;
  health_flags: string[];
};

// Editor della bozza di piano alimentare: il coach modifica liberamente PRIMA di
// pubblicare. Lo stato vive qui; al submit lo serializzo in un campo nascosto e
// la server action `saveNutritionPlan` lo ripulisce e lo salva. Niente è visibile
// al cliente finché non si pubblica. Specchio di components/ProgramEditor.tsx.
export function NutritionEditor({
  planId,
  initialContent,
}: {
  planId: string;
  initialContent: NutritionContent;
}) {
  const [content, setContent] = useState<NutritionContent>(() =>
    normalize(initialContent),
  );

  const setMeal = (mi: number, patch: Partial<Meal>) =>
    setContent((c) => ({
      ...c,
      meals: c.meals.map((m, i) => (i === mi ? { ...m, ...patch } : m)),
    }));

  const setItem = (mi: number, ii: number, patch: Partial<Item>) =>
    setContent((c) => ({
      ...c,
      meals: c.meals.map((m, i) =>
        i !== mi
          ? m
          : { ...m, items: m.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) },
      ),
    }));

  const moveItem = (mi: number, ii: number, dir: -1 | 1) =>
    setContent((c) => ({
      ...c,
      meals: c.meals.map((m, i) => {
        if (i !== mi) return m;
        const arr = [...m.items];
        const tgt = ii + dir;
        if (tgt < 0 || tgt >= arr.length) return m;
        [arr[ii], arr[tgt]] = [arr[tgt], arr[ii]];
        return { ...m, items: arr };
      }),
    }));

  const removeItem = (mi: number, ii: number) =>
    setContent((c) => ({
      ...c,
      meals: c.meals.map((m, i) =>
        i !== mi ? m : { ...m, items: m.items.filter((_, j) => j !== ii) },
      ),
    }));

  const addItem = (mi: number) =>
    setContent((c) => ({
      ...c,
      meals: c.meals.map((m, i) =>
        i === mi ? { ...m, items: [...m.items, { food: "", quantity: "" }] } : m,
      ),
    }));

  const addMeal = () =>
    setContent((c) => ({
      ...c,
      meals: [...c.meals, { name: "", items: [{ food: "", quantity: "" }], notes: "" }],
    }));

  const removeMeal = (mi: number) =>
    setContent((c) => ({ ...c, meals: c.meals.filter((_, i) => i !== mi) }));

  // Variante compatta del campo del kit (text-base evita lo zoom iOS).
  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-base text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent focus:ring-1 focus:ring-accent";
  const num =
    "w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <form action={saveNutritionPlan} className="flex flex-col gap-4 pb-6">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Titolo
        </label>
        <input
          value={content.title}
          onChange={(e) => setContent((c) => ({ ...c, title: e.target.value }))}
          className={`${field} font-semibold`}
        />
        <label className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Sintesi
        </label>
        <textarea
          value={content.summary}
          onChange={(e) => setContent((c) => ({ ...c, summary: e.target.value }))}
          rows={2}
          className={`${field} text-neutral-300`}
        />
      </div>

      {/* Obiettivi nutrizionali */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-neutral-500">Kcal / giorno</span>
          <input
            type="number"
            min={0}
            max={10000}
            value={content.daily_calories}
            onChange={(e) =>
              setContent((c) => ({ ...c, daily_calories: Number(e.target.value) }))
            }
            className={num}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-neutral-500">Proteine (g)</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={content.protein_g}
            onChange={(e) =>
              setContent((c) => ({ ...c, protein_g: Number(e.target.value) }))
            }
            className={num}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-neutral-500">Carboidrati (g)</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={content.carbs_g}
            onChange={(e) =>
              setContent((c) => ({ ...c, carbs_g: Number(e.target.value) }))
            }
            className={num}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase text-neutral-500">Grassi (g)</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={content.fat_g}
            onChange={(e) =>
              setContent((c) => ({ ...c, fat_g: Number(e.target.value) }))
            }
            className={num}
          />
        </label>
      </div>

      {content.health_flags.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <TriangleAlert className="size-4" />
            Da verificare (salute / allergie)
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-200/90">
            {content.health_flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {content.meals.map((meal, mi) => (
        <div key={mi} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <input
              value={meal.name}
              onChange={(e) => setMeal(mi, { name: e.target.value })}
              placeholder="Pasto (es. Colazione)"
              className={`${field} flex-1 font-semibold`}
            />
            <button
              type="button"
              onClick={() => removeMeal(mi)}
              aria-label="Rimuovi pasto"
              className="shrink-0 rounded-lg border border-red-500/30 p-2 text-red-300 transition-colors hover:bg-red-500/10"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {meal.items.map((it, ii) => (
              <div
                key={ii}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2"
              >
                <input
                  value={it.food}
                  onChange={(e) => setItem(mi, ii, { food: e.target.value })}
                  placeholder="Alimento"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <input
                  value={it.quantity}
                  onChange={(e) => setItem(mi, ii, { quantity: e.target.value })}
                  placeholder="Q.tà"
                  className="w-20 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(mi, ii, -1)}
                    aria-label="Sposta su"
                    className="rounded-lg border border-white/10 p-1.5 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(mi, ii, 1)}
                    aria-label="Sposta giù"
                    className="rounded-lg border border-white/10 p-1.5 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(mi, ii)}
                    aria-label="Rimuovi alimento"
                    className="rounded-lg border border-red-500/30 p-1.5 text-red-300 transition-colors hover:bg-red-500/10"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addItem(mi)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
            >
              <Plus className="size-4" />
              Aggiungi alimento
            </button>

            <input
              value={meal.notes}
              onChange={(e) => setMeal(mi, { notes: e.target.value })}
              placeholder="Note del pasto (facoltative)"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-neutral-300 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addMeal}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
      >
        <Plus className="size-4" />
        Aggiungi pasto
      </button>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Note per il coach (private)
        </label>
        <textarea
          value={content.coach_notes}
          onChange={(e) => setContent((c) => ({ ...c, coach_notes: e.target.value }))}
          rows={3}
          className={`${field} text-neutral-300`}
        />
      </div>

      <EditorActions />
    </form>
  );
}

function EditorActions() {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-2 border-t border-white/10 bg-neutral-950/95 px-6 py-3 backdrop-blur">
      <div className="flex w-full gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className={`${btn.secondary} flex-1`}
        >
          {pending ? "Salvataggio…" : "Salva modifiche"}
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className={`${btn.primary} flex-1`}
        >
          {pending ? "Attendi…" : "Approva e pubblica"}
        </button>
      </div>
    </div>
  );
}

// Difesa lato client: garantisce la forma attesa anche con JSON parziale.
function normalize(c: NutritionContent): NutritionContent {
  return {
    title: c?.title ?? "",
    summary: c?.summary ?? "",
    daily_calories: Number(c?.daily_calories ?? 0),
    protein_g: Number(c?.protein_g ?? 0),
    carbs_g: Number(c?.carbs_g ?? 0),
    fat_g: Number(c?.fat_g ?? 0),
    coach_notes: c?.coach_notes ?? "",
    health_flags: Array.isArray(c?.health_flags) ? c.health_flags : [],
    meals: Array.isArray(c?.meals)
      ? c.meals.map((m) => ({
          name: m?.name ?? "",
          notes: m?.notes ?? "",
          items: Array.isArray(m?.items)
            ? m.items.map((it) => ({
                food: String(it?.food ?? ""),
                quantity: String(it?.quantity ?? ""),
              }))
            : [],
        }))
      : [],
  };
}
