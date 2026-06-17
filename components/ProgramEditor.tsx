"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUp, ArrowDown, X, Plus, TriangleAlert } from "@/components/ui/icons";
import { saveProgramVersion } from "@/app/coach/actions";
import { btn } from "@/components/ui/kit";

type Exercise = {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
};
type Day = { label: string; focus: string; exercises: Exercise[] };
type Content = {
  title: string;
  summary: string;
  coach_notes: string;
  health_flags: string[];
  days: Day[];
};
type LibExercise = { id: string; name: string; muscle_group: string | null };

// Editor della bozza di scheda: il coach modifica liberamente PRIMA di pubblicare.
// Lo stato vive qui; al submit lo serializzo in un campo nascosto e la server
// action `saveProgramVersion` lo ripulisce e lo salva (rivalidando il grounding
// sugli esercizi). Niente viene mostrato al cliente finché non si pubblica.
export function ProgramEditor({
  versionId,
  initialContent,
  exercises,
}: {
  versionId: string;
  initialContent: Content;
  exercises: LibExercise[];
}) {
  const [content, setContent] = useState<Content>(() => normalize(initialContent));

  const setDay = (di: number, patch: Partial<Day>) =>
    setContent((c) => ({
      ...c,
      days: c.days.map((d, i) => (i === di ? { ...d, ...patch } : d)),
    }));

  const setExercise = (di: number, ei: number, patch: Partial<Exercise>) =>
    setContent((c) => ({
      ...c,
      days: c.days.map((d, i) =>
        i !== di
          ? d
          : { ...d, exercises: d.exercises.map((ex, j) => (j === ei ? { ...ex, ...patch } : ex)) },
      ),
    }));

  const moveExercise = (di: number, ei: number, dir: -1 | 1) =>
    setContent((c) => ({
      ...c,
      days: c.days.map((d, i) => {
        if (i !== di) return d;
        const arr = [...d.exercises];
        const tgt = ei + dir;
        if (tgt < 0 || tgt >= arr.length) return d;
        [arr[ei], arr[tgt]] = [arr[tgt], arr[ei]];
        return { ...d, exercises: arr };
      }),
    }));

  const removeExercise = (di: number, ei: number) =>
    setContent((c) => ({
      ...c,
      days: c.days.map((d, i) =>
        i !== di ? d : { ...d, exercises: d.exercises.filter((_, j) => j !== ei) },
      ),
    }));

  const addExercise = (di: number) =>
    setContent((c) => {
      const first = exercises[0];
      if (!first) return c;
      const nuovo: Exercise = {
        exercise_id: first.id,
        exercise_name: first.name,
        sets: 3,
        reps: "8-12",
        rest_seconds: 90,
        notes: "",
      };
      return {
        ...c,
        days: c.days.map((d, i) => (i === di ? { ...d, exercises: [...d.exercises, nuovo] } : d)),
      };
    });

  // Variante compatta del campo del kit (stesso stile, padding ridotto per
  // l'editor fitto): bordo white/10, focus viola (text-base evita lo zoom iOS).
  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-base text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <form action={saveProgramVersion} className="flex flex-col gap-4 pb-6">
      <input type="hidden" name="version_id" value={versionId} />
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

      {content.health_flags.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <TriangleAlert className="size-4" />
            Da verificare (salute)
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-200/90">
            {content.health_flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {content.days.map((day, di) => (
        <div key={di} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={day.label}
              onChange={(e) => setDay(di, { label: e.target.value })}
              placeholder="Giorno (es. A — Spinta)"
              className={`${field} flex-1 font-semibold`}
            />
            <input
              value={day.focus}
              onChange={(e) => setDay(di, { focus: e.target.value })}
              placeholder="Focus (es. petto, spalle)"
              className={`${field} flex-1 text-neutral-400`}
            />
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {day.exercises.map((ex, ei) => (
              <div key={ei} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <select
                    value={ex.exercise_id}
                    onChange={(e) => setExercise(di, ei, { exercise_id: e.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-neutral-100 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    {!exercises.some((l) => l.id === ex.exercise_id) && (
                      <option value={ex.exercise_id}>
                        {ex.exercise_name || "Esercizio"} (fuori libreria)
                      </option>
                    )}
                    {exercises.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => moveExercise(di, ei, -1)}
                      aria-label="Sposta su"
                      className="rounded-lg border border-white/10 p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(di, ei, 1)}
                      aria-label="Sposta giù"
                      className="rounded-lg border border-white/10 p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExercise(di, ei)}
                      aria-label="Rimuovi esercizio"
                      className="rounded-lg border border-red-500/30 p-2 text-red-300 transition-colors hover:bg-red-500/10"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-neutral-500">Serie</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={ex.sets}
                      onChange={(e) => setExercise(di, ei, { sets: Number(e.target.value) })}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-neutral-500">Ripetizioni</span>
                    <input
                      value={ex.reps}
                      onChange={(e) => setExercise(di, ei, { reps: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-neutral-500">Rec. (s)</span>
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      value={ex.rest_seconds}
                      onChange={(e) =>
                        setExercise(di, ei, { rest_seconds: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                  </label>
                </div>

                <input
                  value={ex.notes}
                  onChange={(e) => setExercise(di, ei, { notes: e.target.value })}
                  placeholder="Note (tecnica, tempo, cues…)"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-neutral-300 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => addExercise(di)}
              disabled={exercises.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200 disabled:opacity-40"
            >
              <Plus className="size-4" />
              Aggiungi esercizio
            </button>
          </div>
        </div>
      ))}

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

// Barra azioni fissa in basso (mobile-first). useFormStatus mostra lo stato di
// invio della server action e disabilita i pulsanti per evitare doppi click.
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

// Difesa lato client: garantisce la forma attesa anche se il JSON salvato è
// parziale, così gli input controllati non ricevono mai `undefined`.
function normalize(c: Content): Content {
  return {
    title: c?.title ?? "",
    summary: c?.summary ?? "",
    coach_notes: c?.coach_notes ?? "",
    health_flags: Array.isArray(c?.health_flags) ? c.health_flags : [],
    days: Array.isArray(c?.days)
      ? c.days.map((d) => ({
          label: d?.label ?? "",
          focus: d?.focus ?? "",
          exercises: Array.isArray(d?.exercises)
            ? d.exercises.map((ex) => ({
                exercise_id: ex?.exercise_id ?? "",
                exercise_name: ex?.exercise_name ?? "",
                sets: Number(ex?.sets ?? 0),
                reps: String(ex?.reps ?? ""),
                rest_seconds: Number(ex?.rest_seconds ?? 0),
                notes: String(ex?.notes ?? ""),
              }))
            : [],
        }))
      : [],
  };
}
