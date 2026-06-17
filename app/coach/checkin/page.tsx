import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { createCheckin } from "./actions";
import { CHECKIN_STATUS } from "./status";

type ClientRow = { id: string; full_name: string };
type CheckinRow = {
  id: string;
  client_id: string;
  prompt: string | null;
  status: string;
  scheduled_for: string | null;
  created_at: string;
};

const DEFAULT_PROMPT = `Com'è andata questa settimana?
- Peso (kg):
- Aderenza ad allenamenti e dieta (1-10):
- Energia e sonno:
- Note o difficoltà:`;

const inputClass =
  "rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-emerald-500";

function formatDate(value: string | null): string {
  if (!value) return "Senza data";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CoachCheckins({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { error, created } = await searchParams;

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  const clients = (clientsData ?? []) as ClientRow[];
  const clientName = new Map(clients.map((c) => [c.id, c.full_name]));

  const { data: checkinsData } = await supabase
    .from("checkins")
    .select("id, client_id, prompt, status, scheduled_for, created_at")
    .order("created_at", { ascending: false });
  const checkins = (checkinsData ?? []) as CheckinRow[];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Dashboard
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">Check-in</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Programma una domanda periodica. Il cliente risponderà dal suo portale
          (in arrivo); poi l&apos;AI riassumerà e tu approverai.
        </p>
      </header>

      {created && (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Check-in programmato.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Nuovo check-in */}
      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-300">Nuovo check-in</h2>

        {clients.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
            Aggiungi prima un cliente in{" "}
            <Link href="/coach/clienti" className="text-emerald-400 underline">
              Clienti
            </Link>
            .
          </p>
        ) : (
          <form action={createCheckin} className="mt-3 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Cliente</span>
              <select name="client_id" defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Scegli un cliente…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Domanda del check-in</span>
              <textarea
                name="prompt"
                defaultValue={DEFAULT_PROMPT}
                rows={6}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">
                Data programmata{" "}
                <span className="text-neutral-500">(opzionale)</span>
              </span>
              <input type="date" name="scheduled_for" className={inputClass} />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500"
            >
              Programma check-in
            </button>
          </form>
        )}
      </section>

      {/* Lista check-in */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-300">
          Tutti i check-in{" "}
          <span className="text-neutral-500">({checkins.length})</span>
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {checkins.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
              Nessun check-in ancora.
            </li>
          )}
          {checkins.map((c) => {
            const s = CHECKIN_STATUS[c.status] ?? {
              label: c.status,
              className: "bg-neutral-700/40 text-neutral-300",
            };
            return (
              <li key={c.id}>
                <Link
                  href={`/coach/checkin/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3 transition-colors hover:border-neutral-700"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {clientName.get(c.client_id) ?? "Cliente"}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {formatDate(c.scheduled_for)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.className}`}
                  >
                    {s.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
