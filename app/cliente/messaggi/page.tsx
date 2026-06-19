import { redirect } from "next/navigation";
import { MessageCircle, Play } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { sendClientMessage } from "./actions";
import {
  Page,
  BackLink,
  PageHeader,
  EmptyState,
  Banner,
  cbtn,
  cfield,
} from "@/components/ui/client";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Stagger, StaggerItem } from "@/components/ui/motion";

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
      <Stagger className="flex flex-1 flex-col gap-6">
        <StaggerItem>
          <BackLink href="/cliente">La tua scheda</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader title="Messaggi" eyebrow="Con il tuo coach" />
        </StaggerItem>

        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {/* Thread */}
        <StaggerItem className="flex flex-1 flex-col">
          <section className="flex flex-1 flex-col gap-2.5">
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
                  className={`max-w-[85%] rounded-3xl px-4 py-3 ${
                    mine
                      ? "self-end rounded-br-lg bg-accent text-accent-fg shadow-[0_8px_20px_-10px_var(--accent-glow)]"
                      : "self-start rounded-bl-lg bg-surface-1 text-foreground shadow-[var(--shadow-soft)]"
                  }`}
                >
                  {!mine && (
                    <p className="mb-1 text-xs font-bold text-accent">Coach</p>
                  )}
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                    {m.body}
                  </p>
                  <p
                    className={`mt-1.5 text-[11px] tabular-nums ${
                      mine ? "text-accent-fg/70" : "text-faint"
                    }`}
                  >
                    {formatTime(m.created_at)}
                  </p>
                </div>
              );
            })}
          </section>
        </StaggerItem>

        {/* Composer */}
        <StaggerItem>
          <form action={sendClientMessage} className="flex items-center gap-2">
            <input
              name="body"
              required
              autoComplete="off"
              placeholder="Scrivi al coach…"
              className={`flex-1 ${cfield}`}
            />
            <SubmitButton
              className={`${cbtn.primary} shrink-0 px-4`}
              pendingText="…"
            >
              <Play className="size-5 shrink-0 fill-current" />
            </SubmitButton>
          </form>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
