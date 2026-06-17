import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

type ClientRow = { id: string; full_name: string };

export default async function CoachProgress() {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .order("full_name", { ascending: true });
  const clients = (clientsData ?? []) as ClientRow[];

  // Conteggi semplici per cliente (per ora quasi tutti a zero: i dati arrivano
  // quando il cliente logga gli allenamenti e risponde ai check-in).
  const { data: logsData } = await supabase
    .from("workout_logs")
    .select("client_id")
    .limit(2000);
  const workoutsByClient = new Map<string, number>();
  for (const r of (logsData ?? []) as { client_id: string }[]) {
    workoutsByClient.set(
      r.client_id,
      (workoutsByClient.get(r.client_id) ?? 0) + 1,
    );
  }

  const { data: checkinsData } = await supabase
    .from("checkins")
    .select("client_id, status")
    .limit(2000);
  const answeredByClient = new Map<string, number>();
  for (const r of (checkinsData ?? []) as {
    client_id: string;
    status: string;
  }[]) {
    if (r.status === "answered") {
      answeredByClient.set(
        r.client_id,
        (answeredByClient.get(r.client_id) ?? 0) + 1,
      );
    }
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
        <h1 className="text-xl font-semibold">Progressi</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Attività dei clienti nel tempo.
        </p>
      </header>

      <div className="mt-5 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-xs text-sky-300/90">
        I numeri crescono quando il cliente <b>logga gli allenamenti</b> e{" "}
        <b>risponde ai check-in</b> dal suo portale (in arrivo). Più avanti qui
        aggiungeremo grafici e analisi AI.
      </div>

      <section className="mt-8">
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
          {clients.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-3"
            >
              <span className="block font-medium">{c.full_name}</span>
              <div className="mt-2 flex gap-4 text-xs text-neutral-400">
                <span>
                  <b className="text-neutral-200">
                    {workoutsByClient.get(c.id) ?? 0}
                  </b>{" "}
                  allenamenti
                </span>
                <span>
                  <b className="text-neutral-200">
                    {answeredByClient.get(c.id) ?? 0}
                  </b>{" "}
                  check-in risposti
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
