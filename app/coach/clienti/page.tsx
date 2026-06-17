import { redirect } from "next/navigation";
import { Users } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { addClient } from "../actions";
import {
  Page,
  PageHeader,
  BackLink,
  SectionLabel,
  Card,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";
import { SubmitButton } from "@/components/ui/SubmitButton";

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
      <BackLink href="/coach">Dashboard</BackLink>

      <PageHeader eyebrow="Area coach" title="Clienti" />

      {/* Nuovo cliente */}
      <section>
        <SectionLabel>Nuovo cliente</SectionLabel>
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
            Aggiungi cliente
          </SubmitButton>
        </form>
      </section>

      {/* Lista clienti */}
      <section>
        <SectionLabel>
          I tuoi clienti{" "}
          <span className="text-neutral-500">({list.length})</span>
        </SectionLabel>
        {list.length === 0 ? (
          <EmptyState icon={Users}>
            Nessun cliente ancora. Aggiungine uno qui sopra.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.map((c) => (
              <li key={c.id}>
                <Card
                  href={`/coach/clienti/${c.id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {c.full_name}
                    </span>
                    {c.email && (
                      <span className="block truncate text-xs text-neutral-500">
                        {c.email}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {c.status} ›
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
