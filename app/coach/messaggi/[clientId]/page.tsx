import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { Page, BackLink, PageHeader, EmptyState, Avatar, btn, field } from "@/components/ui/kit";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { MessageCircle } from "@/components/ui/icons";
import { sendMessage } from "../actions";

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

export default async function CoachThread({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const { data: messagesData } = await supabase
    .from("messages")
    .select("id, sender_role, body, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as Message[];

  return (
    <Page>
      <Stagger className="flex flex-1 flex-col gap-6">
        <StaggerItem>
          <BackLink href="/coach/messaggi">Conversazioni</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader
            title={client.full_name}
            action={<Avatar name={client.full_name} />}
          />
        </StaggerItem>

        {/* Thread */}
        <StaggerItem className="flex flex-1 flex-col">
          <section className="flex flex-1 flex-col gap-3">
            {messages.length === 0 && (
              <EmptyState icon={MessageCircle}>
                Nessun messaggio. Scrivi il primo qui sotto.
              </EmptyState>
            )}
            {messages.map((m) => {
              const fromStaff =
                m.sender_role === "coach" || m.sender_role === "admin";
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                    fromStaff
                      ? "self-end bg-primary text-primary-fg"
                      : "self-start border border-border bg-surface-1 text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  <p
                    className={`mt-1 text-xs ${
                      fromStaff ? "text-primary-fg/65" : "text-faint"
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
          <form action={sendMessage} className="flex items-center gap-2">
            <input type="hidden" name="client_id" value={client.id} />
            <input
              name="body"
              required
              autoComplete="off"
              placeholder="Scrivi un messaggio…"
              className={`flex-1 ${field}`}
            />
            <SubmitButton className={btn.primary} pendingText="Invio…">
              Invia
            </SubmitButton>
          </form>
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
