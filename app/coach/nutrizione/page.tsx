import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { createNutritionPlan } from "./actions";
import { ARTIFACT_STATUS } from "./status";

type ClientRow = { id: string; full_name: string };
type PlanRow = {
  id: string;
  client_id: string;
  title: string | null;
  status: string;
  created_at: string;
};

const inputClass =
  "rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-emerald-500";

export default async function CoachNutrition({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  const clients = (clientsData ?? []) as ClientRow[];
  const clientName = new Map(clients.map((c) => [c.id, c.full_name]));

  const { data: plansData } = await supabase
    .from("nutrition_plans")
    .select("id, client_id, title, status, created_at")
    .order("created_at", { ascending: false });
  const plans = (plansData ?? []) as PlanRow[];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Dashboard
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">Nutrizione</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Crea un piano come bozza, poi pubblicalo: solo allora diventa visibile
          al cliente.
        </p>
      </header>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Nuovo piano */}
      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-300">Nuovo piano</h2>

        {clients.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
            Aggiungi prima un cliente in{" "}
            <Link href="/coach/clienti" className="text-emerald-400 underline">
              Clienti
            </Link>
            .
          </p>
        ) : (
          <form
            action={createNutritionPlan}
            className="mt-3 flex flex-col gap-4"
          >
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
              <span className="text-neutral-300">Titolo</span>
              <input
                name="title"
                placeholder="Es. Piano alimentare — fase di definizione"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">
                Contenuto del piano{" "}
                <span className="text-neutral-500">(opzionale ora)</span>
              </span>
              <textarea
                name="body"
                rows={6}
                placeholder="Colazione…&#10;Pranzo…&#10;Cena…&#10;Note e integrazioni…"
                className={inputClass}
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500"
            >
              Crea bozza
            </button>
          </form>
        )}
      </section>

      {/* Lista piani */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-300">
          Tutti i piani <span className="text-neutral-500">({plans.length})</span>
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {plans.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
              Nessun piano ancora.
            </li>
          )}
          {plans.map((p) => {
            const s = ARTIFACT_STATUS[p.status] ?? {
              label: p.status,
              className: "bg-neutral-700/40 text-neutral-300",
            };
            return (
              <li key={p.id}>
                <Link
                  href={`/coach/nutrizione/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3 transition-colors hover:border-neutral-700"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {p.title ?? "Senza titolo"}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {clientName.get(p.client_id) ?? "Cliente"}
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
