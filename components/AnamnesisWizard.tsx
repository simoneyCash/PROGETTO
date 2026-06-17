"use client";

import { useState } from "react";
import { Check } from "lucide-react";

type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  options?: string[];
  placeholder?: string;
};
type Step = { title: string; note?: string; fields: Field[] };

const STEPS: Step[] = [
  {
    title: "Chi sei",
    fields: [
      { name: "birth_date", label: "Data di nascita", type: "date" },
      { name: "sex", label: "Sesso", type: "select", options: ["", "Uomo", "Donna", "Altro"] },
      { name: "height_cm", label: "Altezza (cm)", type: "number" },
      { name: "weight_kg", label: "Peso attuale (kg)", type: "number" },
    ],
  },
  {
    title: "I tuoi obiettivi",
    fields: [
      {
        name: "goal",
        label: "Obiettivo principale",
        type: "select",
        options: ["", "Dimagrimento", "Ipertrofia", "Forza", "Ricomposizione", "Salute generale"],
      },
      { name: "motivation", label: "Cosa ti spinge? (facoltativo)", type: "textarea" },
    ],
  },
  {
    title: "Allenamento",
    fields: [
      { name: "experience", label: "Esperienza", type: "select", options: ["", "Principiante", "Intermedio", "Avanzato"] },
      { name: "days_per_week", label: "Giorni a settimana", type: "select", options: ["", "1", "2", "3", "4", "5", "6"] },
      { name: "equipment", label: "Attrezzatura disponibile", type: "text", placeholder: "Es. palestra completa, casa con manubri…" },
    ],
  },
  {
    title: "Salute",
    note: "Servono al coach per allenarti in sicurezza. Non sono un consulto medico.",
    fields: [
      { name: "injuries", label: "Infortuni o dolori", type: "textarea" },
      { name: "conditions", label: "Patologie / condizioni", type: "textarea" },
      { name: "medications", label: "Farmaci (facoltativo)", type: "text" },
    ],
  },
  {
    title: "Stile di vita",
    fields: [
      { name: "diet", label: "Come mangi di solito?", type: "textarea" },
      { name: "allergies", label: "Allergie / intolleranze", type: "text" },
      { name: "sleep_hours", label: "Ore di sonno a notte", type: "select", options: ["", "meno di 5", "5-6", "7-8", "più di 8"] },
      { name: "notes", label: "Altro che vuoi dire al coach", type: "textarea" },
    ],
  },
];

const fieldClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-emerald-500";

export function AnamnesisWizard({
  token,
  clientName,
}: {
  token: string;
  clientName: string;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, v: string) =>
    setValues((s) => ({ ...s, [name]: v }));
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const firstName = clientName.split(" ")[0] || clientName;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Invio non riuscito, riprova.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Connessione assente. Riprova quando torni online.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="size-6 text-emerald-400" />
        </span>
        <h2 className="mt-3 text-lg font-semibold">Grazie, {firstName}!</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Il tuo coach ha ricevuto le risposte e preparerà il programma su misura
          per te.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? "bg-emerald-500" : "bg-neutral-800"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Passo {step + 1} di {STEPS.length}
      </p>
      <h2 className="mt-1 text-xl font-semibold">{current.title}</h2>
      {current.note && (
        <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          {current.note}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {current.fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-300">{f.label}</span>
            {f.type === "textarea" ? (
              <textarea
                rows={2}
                className={fieldClass}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            ) : f.type === "select" ? (
              <select
                className={fieldClass}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              >
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o === "" ? "—" : o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type}
                placeholder={f.placeholder}
                className={fieldClass}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 rounded-lg border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
          >
            Indietro
          </button>
        )}
        {!isLast ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Avanti
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? "Invio…" : "Invia"}
          </button>
        )}
      </div>
    </div>
  );
}
