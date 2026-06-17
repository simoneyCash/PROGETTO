import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { addClient } from "../actions";

type ClientRow = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

export default async function CoachClients({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, email, status")
    .order("created_at", { ascending: false });

  const list = (clients ?? []) as ClientRow[];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Dashboard
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">Clienti</h1>
      </header>

      {/* Nuovo cliente */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">Nuovo cliente</h2>
        <form action={addClient} className="mt-3 flex flex-col gap-3">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <input
            name="full_name"
            placeholder="Nome e cognome"
            required
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-emerald-500"
          />
          <input
            name="email"
            type="email"
            placeholder="Email (opzionale)"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500"
          >
            Aggiungi cliente
          </button>
        </form>
      </section>

      {/* Lista clienti */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">
          I tuoi clienti{" "}
          <span className="text-neutral-500">({list.length})</span>
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {list.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
              Nessun cliente ancora. Aggiungine uno qui sopra.
            </li>
          )}
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/coach/clienti/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3 transition-colors hover:border-neutral-700"
              >
                <span>
                  <span className="block font-medium">{c.full_name}</span>
                  {c.email && (
                    <span className="block text-xs text-neutral-500">
                      {c.email}
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-500">{c.status} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
