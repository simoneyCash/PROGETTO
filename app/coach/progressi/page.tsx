import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Stat,
  Row,
  Avatar,
  EmptyState,
  Banner,
} from "@/components/ui/kit";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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

  const totalWorkouts = clients.reduce(
    (sum, c) => sum + (workoutsByClient.get(c.id) ?? 0),
    0,
  );
  const totalAnswered = clients.reduce(
    (sum, c) => sum + (answeredByClient.get(c.id) ?? 0),
    0,
  );

  return (
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach">Dashboard</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader
            eyebrow="Attività dei clienti nel tempo"
            title="Progressi"
          />
        </StaggerItem>

        <StaggerItem>
          <Banner tone="info">
            I numeri crescono quando il cliente <b>logga gli allenamenti</b> e{" "}
            <b>risponde ai check-in</b> dal suo portale (in arrivo). Più avanti
            qui aggiungeremo grafici e analisi AI.
          </Banner>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Clienti" value={<AnimatedNumber value={clients.length} />} />
            <Stat
              label="Allenamenti"
              value={<AnimatedNumber value={totalWorkouts} />}
            />
            <Stat
              label="Check-in"
              value={<AnimatedNumber value={totalAnswered} />}
            />
          </div>
        </StaggerItem>

        <StaggerItem>
          <section>
            <SectionLabel>Per cliente</SectionLabel>
            {clients.length === 0 ? (
              <EmptyState icon={LineChart}>
                Aggiungi prima un cliente in{" "}
                <Link
                  href="/coach/clienti"
                  className="text-foreground underline"
                >
                  Clienti
                </Link>
                .
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {clients.map((c) => (
                  <li key={c.id}>
                    <Row
                      leading={<Avatar name={c.full_name} />}
                      title={c.full_name}
                      subtitle={
                        <>
                          <b className="text-foreground">
                            {workoutsByClient.get(c.id) ?? 0}
                          </b>{" "}
                          allenamenti
                          <span className="px-1.5 text-faint">·</span>
                          <b className="text-foreground">
                            {answeredByClient.get(c.id) ?? 0}
                          </b>{" "}
                          check-in risposti
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
