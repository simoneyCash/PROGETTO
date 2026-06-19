"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cbtn } from "@/components/ui/client";
import { logWorkout } from "@/app/cliente/actions";

// =============================================================================
// Coach AI — Sessione di allenamento "da vera app" (Onda 1).
//
// Cosa aggiunge rispetto al semplice form:
//  · CRONOMETRO RECUPERO: tocchi "✓ fatta" su una serie → parte il recupero
//    (durata = rest_seconds dell'esercizio) con beep + vibrazione + notifica.
//  · ANTI-PERDITA + RIPRESA: ogni valore digitato è salvato sul telefono
//    (localStorage). Se chiudi/blocchi l'app a metà, riapri e ritrovi tutto.
//  · INDICATORE SERIE: ogni serie completata resta segnata (pallino verde).
//
// SICUREZZA: il form invia SOLO i valori (reps/peso) con gli stessi nomi di
// prima (reps_i_s / weight_i_s). I nomi esercizi e il numero serie li ricava il
// server dalla versione pubblicata: il browser non può falsarli. DB invariato.
// =============================================================================

type ExerciseView = {
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
};

type SetState = { reps: string; weight: string; done: boolean };
type Saved = { savedAt: number; grid: SetState[][] };

const STALE_MS = 18 * 60 * 60 * 1000; // riprese più vecchie di 18h = nuovo allenamento
const DEFAULT_REST = 90;

const inputClass =
  "w-20 rounded-xl border border-border bg-surface-1 px-2 py-2 text-center text-[16px] font-semibold text-foreground outline-none transition-[border-color,box-shadow] focus:border-accent/40 focus:ring-2 focus:ring-[var(--ring)]";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WorkoutSession({
  dayIndex,
  exercises,
  storageKey,
}: {
  dayIndex: number;
  exercises: ExerciseView[];
  storageKey: string;
}) {
  const [grid, setGrid] = useState<SetState[][]>(() =>
    exercises.map((ex) =>
      Array.from({ length: Math.max(1, ex.sets || 1) }, () => ({
        reps: "",
        weight: "",
        done: false,
      })),
    ),
  );
  const [hydrated, setHydrated] = useState(false);

  // Recupero attivo: durata totale + istante di fine (per non andare fuori sync).
  const [rest, setRest] = useState<{ total: number; endsAt: number } | null>(
    null,
  );
  const [now, setNow] = useState(0);
  const firedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  // — Ripresa: carica i valori salvati (solo lato client, dopo il mount) ——————
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Saved;
        const fresh = saved?.savedAt && Date.now() - saved.savedAt < STALE_MS;
        if (fresh && Array.isArray(saved.grid)) {
          setGrid((cur) =>
            cur.map((row, i) =>
              row.map((cell, s) => saved.grid?.[i]?.[s] ?? cell),
            ),
          );
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      /* localStorage non disponibile: pazienza, niente ripresa */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // — Anti-perdita: salva a ogni modifica —————————————————————————————————————
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ savedAt: Date.now(), grid } satisfies Saved),
      );
    } catch {
      /* quota piena o storage negato: ignoriamo */
    }
  }, [grid, hydrated, storageKey]);

  // — Tick del cronometro —————————————————————————————————————————————————————
  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const pct = rest ? Math.max(0, Math.min(1, remaining / rest.total)) : 0;

  // — Fine recupero: beep + vibrazione + notifica ————————————————————————————
  useEffect(() => {
    if (rest && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      try {
        navigator.vibrate?.([220, 120, 220]);
      } catch {
        /* niente vibrazione su desktop */
      }
      beep();
      try {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("Recupero finito 💪", {
            body: "Pronto per la prossima serie.",
          });
        }
      } catch {
        /* notifiche non concesse */
      }
      setRest(null);
    }
  }, [rest, remaining]);

  function beep() {
    const ctx = audioRef.current;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [0, 0.28, 0.56].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, t0 + t);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.2);
      osc.start(t0 + t);
      osc.stop(t0 + t + 0.22);
    });
  }

  function startRest(seconds: number) {
    const dur = Math.max(5, Math.round(Number(seconds) || DEFAULT_REST));
    // Sblocca audio e chiedi il permesso notifiche: serve un gesto dell'utente.
    try {
      if (!audioRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      audioRef.current?.resume?.();
    } catch {
      /* audio non supportato */
    }
    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      ) {
        Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }
    firedRef.current = false;
    const t = Date.now();
    setNow(t);
    setRest({ total: dur, endsAt: t + dur * 1000 });
  }

  function addRest(seconds: number) {
    setRest((r) =>
      r ? { total: r.total + seconds, endsAt: r.endsAt + seconds * 1000 } : r,
    );
  }

  function setCell(i: number, s: number, patch: Partial<SetState>) {
    setGrid((g) =>
      g.map((row, ri) =>
        ri === i
          ? row.map((c, si) => (si === s ? { ...c, ...patch } : c))
          : row,
      ),
    );
  }

  function toggleDone(i: number, s: number) {
    const willBeDone = !grid[i][s].done;
    setCell(i, s, { done: willBeDone });
    if (willBeDone) startRest(exercises[i].rest_seconds);
  }

  function clearStorage() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <p className="-mt-3 text-xs text-muted">
        Segna ripetizioni e peso, poi tocca <span className="text-foreground">✓</span>{" "}
        per far partire il recupero. Tutto resta salvato sul telefono: se esci e
        rientri, ritrovi i tuoi dati.
      </p>

      <form action={logWorkout} onSubmit={clearStorage} className="flex flex-col gap-4">
        <input type="hidden" name="day" value={dayIndex} />

        {exercises.map((ex, i) => {
          const row = grid[i] ?? [];
          const doneCount = row.filter((c) => c.done).length;
          return (
            <div
              key={i}
              className="rounded-3xl bg-surface-1 p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-bold text-foreground">{ex.exercise_name}</h2>
                <span className="text-xs font-medium text-muted">
                  target {ex.sets}×{ex.reps}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                <span>
                  {doneCount}/{row.length} serie
                </span>
                {ex.rest_seconds > 0 && (
                  <span aria-hidden>· recupero {ex.rest_seconds}s</span>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-faint">
                  <span className="w-8">Serie</span>
                  <span className="w-20 text-center">Ripetiz.</span>
                  <span className="w-20 text-center">Peso kg</span>
                </div>
                {row.map((cell, s) => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="w-8 text-sm text-muted">{s + 1}</span>
                    <input
                      name={`reps_${i}_${s + 1}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      placeholder={ex.reps}
                      value={cell.reps}
                      onChange={(e) => setCell(i, s, { reps: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      name={`weight_${i}_${s + 1}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.5"
                      placeholder="—"
                      value={cell.weight}
                      onChange={(e) =>
                        setCell(i, s, { weight: e.target.value })
                      }
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => toggleDone(i, s)}
                      aria-pressed={cell.done}
                      aria-label={
                        cell.done ? "Serie completata" : "Segna serie e avvia recupero"
                      }
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                        cell.done
                          ? "border-transparent bg-accent text-accent-fg"
                          : "border-border bg-surface-1 text-faint hover:text-foreground"
                      }`}
                    >
                      <Check className="size-5" />
                    </button>
                  </div>
                ))}
              </div>

              {ex.notes && (
                <p className="mt-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-1))] px-3 py-2 text-sm font-medium text-foreground">
                  {ex.notes}
                </p>
              )}
            </div>
          );
        })}

        <SubmitButton
          className={`sticky bottom-4 mt-2 ${cbtn.primary}`}
          pendingText="Salvataggio…"
        >
          Completa allenamento
        </SubmitButton>
      </form>

      {/* Barra recupero: appare solo durante il riposo, in primo piano. */}
      {rest && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface-1/95 shadow-[var(--shadow-soft-lg)] backdrop-blur-xl">
          <div
            className="mx-auto w-full max-w-md px-5 py-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Recupero
                </p>
                <p className="font-mono text-4xl font-bold tabular-nums text-foreground">
                  {fmt(remaining)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addRest(15)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-1 px-3.5 py-2.5 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] active:scale-95"
                >
                  <Plus className="size-4" /> 15s
                </button>
                <button
                  type="button"
                  onClick={() => setRest(null)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-[0_10px_28px_-10px_var(--accent-glow)] active:scale-95"
                >
                  <X className="size-4" /> Salta
                </button>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear"
                style={{ width: `${pct * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
