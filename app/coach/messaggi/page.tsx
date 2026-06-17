import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

type ClientRow = { id: string; full_name: string };
type MessageRow = { client_id: string; body: string; created_at: string };

export default async function CoachMessages() {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  const clients = (clientsData ?? []) as ClientRow[];

  // Ultimo messaggio per cliente (per l'anteprima). Prendiamo gli ultimi e
  // teniamo il primo che vediamo per ciascun cliente (ordinati dal più recente).
  const { data: msgsData } = await supabase
    .from("messages")
    .select("client_id, body, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const lastByClient = new Map<string, MessageRow>();
  for (const m of (msgsData ?? []) as MessageRow[]) {
    if (!lastByClient.has(m.client_id)) lastByClient.set(m.client_id, m);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Dashboard
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">Messaggi</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Conversazioni con i tuoi clienti. (Il cliente potrà rispondere dal suo
          portale, in arrivo.)
        </p>
      </header>

      <section className="mt-6">
        <ul className="flex flex-col gap-2">
          {clients.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
              Aggiungi prima un cliente in{" "}
              <Link href="/coach/clienti" className="text-emerald-400 underline">
                Clienti
              </Link>
              .
            </li>
          )}
          {clients.map((c) => {
            const last = lastByClient.get(c.id);
            return (
              <li key={c.id}>
                <Link
                  href={`/coach/messaggi/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3 transition-colors hover:border-neutral-700"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{c.full_name}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {last ? last.body : "Nessun messaggio"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
