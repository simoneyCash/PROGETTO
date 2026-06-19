import { redirect } from "next/navigation";
import { Users, Plus, ChevronRight } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { addClient } from "../actions";
import {
  Page,
  PageHeader,
  BackLink,
  SectionLabel,
  Card,
  Row,
  Avatar,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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
    <Page>
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach">Dashboard</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader eyebrow="Area coach" title="Clienti" />
        </StaggerItem>

        {/* Nuovo cliente */}
        <StaggerItem>
          <section>
            <SectionLabel>Nuovo cliente</SectionLabel>
            <Card>
              <form action={addClient} className="flex flex-col gap-3">
                {error && <Banner tone="error">{error}</Banner>}
                <input
                  name="full_name"
                  placeholder="Nome e cognome"
                  required
                  className={field}
                />
                <input
                  name="email"
                  type="email"
                  placeholder="Email (opzionale)"
                  className={field}
                />
                <SubmitButton className={btn.primary} pendingText="Aggiungo…">
                  <Plus className="size-5" />
                  Aggiungi cliente
                </SubmitButton>
              </form>
            </Card>
          </section>
        </StaggerItem>

        {/* Lista clienti */}
        <StaggerItem>
          <section>
            <SectionLabel
              right={
                <span className="text-xs text-faint">
                  <AnimatedNumber value={list.length} />
                </span>
              }
            >
              I tuoi clienti
            </SectionLabel>
            {list.length === 0 ? (
              <EmptyState icon={Users}>
                Nessun cliente ancora. Aggiungine uno qui sopra.
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((c) => (
                  <li key={c.id}>
                    <Row
                      href={`/coach/clienti/${c.id}`}
                      leading={<Avatar name={c.full_name} />}
                      title={c.full_name}
                      subtitle={c.email ?? undefined}
                      trailing={
                        <>
                          <span className="text-xs text-faint">{c.status}</span>
                          <ChevronRight className="size-4" />
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
