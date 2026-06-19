import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, ChevronRight } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  Page,
  BackLink,
  PageHeader,
  EmptyState,
  SectionLabel,
  Row,
  Avatar,
} from "@/components/ui/kit";
import { Stagger, StaggerItem } from "@/components/ui/motion";

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
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach">Dashboard</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader title="Messaggi" eyebrow="Conversazioni" />
        </StaggerItem>

        <StaggerItem>
          <p className="-mt-4 text-sm text-muted">
            Conversazioni con i tuoi clienti. (Il cliente potrà rispondere dal suo
            portale, in arrivo.)
          </p>
        </StaggerItem>

        <StaggerItem>
          <section>
            <SectionLabel>Clienti</SectionLabel>
            {clients.length === 0 ? (
              <EmptyState icon={MessageCircle}>
                Aggiungi prima un cliente in{" "}
                <Link href="/coach/clienti" className="text-foreground underline">
                  Clienti
                </Link>
                .
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {clients.map((c) => {
                  const last = lastByClient.get(c.id);
                  return (
                    <li key={c.id}>
                      <Row
                        href={`/coach/messaggi/${c.id}`}
                        leading={<Avatar name={c.full_name} />}
                        title={c.full_name}
                        subtitle={last ? last.body : "Nessun messaggio"}
                        trailing={<ChevronRight className="size-4" />}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
