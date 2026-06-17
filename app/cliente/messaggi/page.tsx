import { redirect } from "next/navigation";
import { MessageCircle } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { sendClientMessage } from "./actions";
import { Page, BackLink, PageHeader, EmptyState, Banner, btn, field } from "@/components/ui/kit";
import { SubmitButton } from "@/components/ui/SubmitButton";

type Message = {
  id: string;
  sender_role: string | null;
  body: string;
  created_at: string;
};

function formatTime(value: string): string {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ClientMessages({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const { error } = await searchParams;

  const supabase = await createClient();
  // La RLS limita già i messaggi a quelli del cliente corrente.
  const { data: messagesData } = await supabase
    .from("messages")
    .select("id, sender_role, body, created_at")
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as Message[];

  return (
    <Page>
      <BackLink href="/cliente">La tua scheda</BackLink>

      <PageHeader title="Messaggi" eyebrow="Con il tuo coach" />

      {error && <Banner tone="error">{error}</Banner>}

      {/* Thread */}
      <section className="flex flex-1 flex-col gap-3">
        {messages.length === 0 && (
          <EmptyState icon={MessageCircle}>
            Nessun messaggio. Scrivi il primo qui sotto.
          </EmptyState>
        )}
        {messages.map((m) => {
          const mine = m.sender_role === "client";
          return (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                mine
                  ? "self-end bg-accent text-accent-ink"
                  : "self-start bg-white/5 text-neutral-200"
              }`}
            >
              {!mine && (
                <p className="mb-0.5 text-[10px] font-medium text-neutral-400">
                  Coach
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              <p
                className={`mt-1 text-[10px] ${
                  mine ? "text-accent-ink/65" : "text-neutral-500"
                }`}
              >
                {formatTime(m.created_at)}
              </p>
            </div>
          );
        })}
      </section>

      {/* Composer */}
      <form action={sendClientMessage} className="flex gap-2">
        <input
          name="body"
          required
          autoComplete="off"
          placeholder="Scrivi al coach…"
          className={`flex-1 ${field}`}
        />
        <SubmitButton className={btn.primary} pendingText="Invio…">
          Invia
        </SubmitButton>
      </form>
    </Page>
  );
}
