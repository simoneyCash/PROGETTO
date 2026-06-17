import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, ChevronRight } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { Page, BackLink, PageHeader, EmptyState } from "@/components/ui/kit";

type ClientRow = { id: string; full_name: string };
type MessageRow = { client_id: string; body: string; created_at: string };

// Iniziali per l'avatar (max 2 lettere).
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

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
      <BackLink href="/coach">Dashboard</BackLink>

      <PageHeader title="Messaggi" />

      <p className="-mt-4 text-xs text-neutral-500">
        Conversazioni con i tuoi clienti. (Il cliente potrà rispondere dal suo
        portale, in arrivo.)
      </p>

      <section>
        {clients.length === 0 ? (
          <EmptyState icon={MessageCircle}>
            Aggiungi prima un cliente in{" "}
            <Link href="/coach/clienti" className="text-accent underline">
              Clienti
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {clients.map((c) => {
              const last = lastByClient.get(c.id);
              return (
                <li key={c.id}>
                  <Link
                    href={`/coach/messaggi/${c.id}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/20"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-medium text-neutral-300">
                      {initials(c.full_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {c.full_name}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {last ? last.body : "Nessun messaggio"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-neutral-600" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Page>
  );
}
