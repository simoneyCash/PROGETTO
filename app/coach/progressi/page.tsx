import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  Page,
  BackLink,
  PageHeader,
  Card,
  EmptyState,
  Banner,
} from "@/components/ui/kit";

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
    <Page>
      <BackLink href="/coach">Dashboard</BackLink>

      <PageHeader eyebrow="Attività dei clienti nel tempo" title="Progressi" />

      <Banner tone="info">
        I numeri crescono quando il cliente <b>logga gli allenamenti</b> e{" "}
        <b>risponde ai check-in</b> dal suo portale (in arrivo). Più avanti qui
        aggiungeremo grafici e analisi AI.
      </Banner>

      <section>
        {clients.length === 0 ? (
          <EmptyState icon={LineChart}>
            Aggiungi prima un cliente in{" "}
            <Link href="/coach/clienti" className="text-accent underline">
              Clienti
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {clients.map((c) => (
              <li key={c.id}>
                <Card>
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
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
