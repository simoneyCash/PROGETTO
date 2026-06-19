"use client";

import { useState } from "react";
import { Check } from "@/components/ui/icons";
import { btn, field } from "@/components/ui/kit";

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
    title: "Alimentazione e stile di vita",
    fields: [
      { name: "diet", label: "Come mangi di solito? (cosa, quanto, quando)", type: "textarea" },
      { name: "allergies", label: "Allergie / intolleranze", type: "text" },
      { name: "sleep_hours", label: "Ore di sonno a notte", type: "select", options: ["", "meno di 5", "5-6", "7-8", "più di 8"] },
      { name: "notes", label: "Altro che vuoi dire al coach", type: "textarea" },
    ],
  },
];

export function AnamnesisWizard({
  token,
  clientName,
  clientEmail,
}: {
  token: string;
  clientName: string;
  clientEmail?: string;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, v: string) =>
    setValues((s) => ({ ...s, [name]: v }));

  // L'ultimo passo è la creazione dell'accesso (solo se il coach ha messo
  // un'email per questo cliente: senza email non c'è account da creare).
  const wantsAccount = !!clientEmail;
  const totalSteps = STEPS.length + (wantsAccount ? 1 : 0);
  const isAccountStep = wantsAccount && step === STEPS.length;
  const isLast = step === totalSteps - 1;
  const current = STEPS[step];
  const firstName = clientName.split(" ")[0] || clientName;

  async function submit() {
    if (wantsAccount) {
      if (password.length < 8) {
        setError("La password deve avere almeno 8 caratteri.");
        return;
      }
      if (password !== confirm) {
        setError("Le due password non coincidono.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wantsAccount ? { ...values, password } : values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Invio non riuscito, riprova.");
        setSubmitting(false);
        return;
      }
      if (data?.redirect) {
        // Account creato + login: entriamo nell'app (navigazione completa così
        // i cookie di sessione appena impostati hanno effetto).
        window.location.assign(data.redirect);
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
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="size-6 text-emerald-400" />
        </span>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">
          Grazie, {firstName}!
        </h2>
        <p className="mt-1 text-sm text-muted">
          Il tuo coach ha ricevuto le risposte e preparerà il programma su misura
          per te.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? "bg-primary" : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Passo {step + 1} di {totalSteps}
      </p>

      {isAccountStep ? (
        // --- Passo finale: crea l'accesso ---
        <>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Crea il tuo accesso
          </h2>
          <p className="mt-2 text-sm text-muted">
            Scegli una password: ti servirà per entrare nella tua app.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {clientEmail && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">Accederai con</span>
                <input
                  type="email"
                  value={clientEmail}
                  readOnly
                  className={`${field} opacity-70`}
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Almeno 8 caratteri"
                className={field}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Ripeti la password</span>
              <input
                type="password"
                autoComplete="new-password"
                className={field}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          </div>
        </>
      ) : (
        // --- Passi dell'anamnesi ---
        <>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {current.title}
          </h2>
          {current.note && (
            <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              {current.note}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-4">
            {current.fields.map((f) => (
              <label key={f.name} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">{f.label}</span>
                {f.type === "textarea" ? (
                  <textarea
                    rows={2}
                    className={field}
                    value={values[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                ) : f.type === "select" ? (
                  <select
                    className={field}
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
                    className={field}
                    value={values[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep((s) => s - 1);
            }}
            className={`${btn.secondary} flex-1`}
          >
            Indietro
          </button>
        )}
        {!isLast ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className={`${btn.primary} flex-1`}
          >
            Avanti
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={`${btn.primary} flex-1`}
          >
            {submitting
              ? "Invio…"
              : wantsAccount
                ? "Crea accesso ed entra"
                : "Invia"}
          </button>
        )}
      </div>
    </div>
  );
}
