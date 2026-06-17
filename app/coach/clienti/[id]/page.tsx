import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { saveIntake, generateProgramDraft } from "../../actions";
import { GenerateButton } from "@/components/GenerateButton";

type ProgramVersion = {
  id: string;
  version: number;
  status: string;
  created_at: string;
};

const VERSION_STATUS_LABEL: Record<string, string> = {
  draft: "Bozza",
  pending_review: "In revisione",
  approved: "Approvata",
  published: "Pubblicata",
  archived: "Archiviata",
};

type IntakeAnswers = {
  goal?: string;
  experience?: string;
  days_per_week?: string;
  equipment?: string;
  injuries?: string;
  notes?: string;
};

const inputClass =
  "rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-emerald-500";

export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { saved, error } = await searchParams;

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, email, status")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: intake } = await supabase
    .from("intakes")
    .select("answers, submitted_at")
    .eq("client_id", id)
    .limit(1)
    .maybeSingle();

  const a = (intake?.answers ?? {}) as IntakeAnswers;

  const { data: versionsData } = await supabase
    .from("program_versions")
    .select("id, version, status, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  const versions = (versionsData ?? []) as ProgramVersion[];
  const hasIntake = !!intake?.submitted_at;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link href="/coach/clienti" className="text-sm text-neutral-400 hover:text-neutral-200">
        ‹ Torna ai clienti
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">{client.full_name}</h1>
        {client.email && (
          <p className="text-sm text-neutral-500">{client.email}</p>
        )}
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">
          Questionario di intake
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Queste risposte serviranno all&apos;AI per generare la bozza di scheda.
        </p>

        {saved && (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Intake salvato.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <form action={saveIntake} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="client_id" value={client.id} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-300">Obiettivo</span>
            <select name="goal" defaultValue={a.goal ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="dimagrimento">Dimagrimento</option>
              <option value="ipertrofia">Ipertrofia</option>
              <option value="forza">Forza</option>
              <option value="ricomposizione">Ricomposizione</option>
              <option value="salute">Salute generale</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-300">Esperienza</span>
            <select
              name="experience"
              defaultValue={a.experience ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzato">Avanzato</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-300">Giorni a settimana</span>
            <select
              name="days_per_week"
              defaultValue={a.days_per_week ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-300">Attrezzatura disponibile</span>
            <input
              name="equipment"
              defaultValue={a.equipment ?? ""}
              placeholder="Es. palestra completa, casa con manubri…"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-300">Infortuni / limitazioni</span>
            <textarea
              name="injuries"
              defaultValue={a.injuries ?? ""}
              rows={2}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-300">Note</span>
            <textarea
              name="notes"
              defaultValue={a.notes ?? ""}
              rows={2}
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500"
          >
            Salva intake
          </button>
        </form>
      </section>

      {/* Scheda AI */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-300">Scheda di allenamento</h2>

        <form action={generateProgramDraft} className="mt-3">
          <input type="hidden" name="client_id" value={client.id} />
          <GenerateButton disabled={!hasIntake} />
          {!hasIntake && (
            <p className="mt-2 text-xs text-neutral-500">
              Salva prima l&apos;intake per poter generare la scheda.
            </p>
          )}
        </form>

        {versions.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/coach/programmi/${v.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3 hover:border-neutral-700"
                >
                  <span className="text-sm">Versione {v.version}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      v.status === "published"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {VERSION_STATUS_LABEL[v.status] ?? v.status} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
