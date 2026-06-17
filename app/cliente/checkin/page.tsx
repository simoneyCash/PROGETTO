import { redirect } from "next/navigation";
import { ClipboardCheck } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { answerCheckin } from "./actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  Page,
  BackLink,
  PageHeader,
  SectionLabel,
  Card,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";

type CheckinRow = {
  id: string;
  prompt: string | null;
  status: string;
  scheduled_for: string | null;
  responded_at: string | null;
  response: { text?: string } | null;
  created_at: string;
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function ClientCheckins({
  searchParams,
}: {
  searchParams: Promise<{ answered?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const { answered, error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.rpc("client_list_checkins");
  const rows = (data ?? []) as CheckinRow[];

  const pending = rows.filter(
    (c) => c.status === "scheduled" || c.status === "sent",
  );
  const done = rows.filter((c) => c.status === "answered");

  return (
    <Page>
      <BackLink href="/cliente">Oggi</BackLink>

      <PageHeader title="Check-in" />

      {answered && (
        <Banner tone="success">Risposta inviata. Grazie! 💪</Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}

      {rows.length === 0 && (
        <EmptyState icon={ClipboardCheck}>
          Nessun check-in al momento. Il tuo coach te ne invierà quando serve.
        </EmptyState>
      )}

      {/* Da rispondere */}
      {pending.length > 0 && (
        <section>
          <SectionLabel>Da rispondere</SectionLabel>
          <div className="flex flex-col gap-3">
            {pending.map((c) => (
              <Card key={c.id} tone="accent">
                <p className="whitespace-pre-wrap text-sm text-neutral-200">
                  {c.prompt}
                </p>
                <form action={answerCheckin} className="mt-4 flex flex-col gap-3">
                  <input type="hidden" name="checkin_id" value={c.id} />
                  <textarea
                    name="text"
                    rows={5}
                    required
                    placeholder="Scrivi qui la tua risposta…"
                    className={field}
                  />
                  <SubmitButton className={btn.primary} pendingText="Invio…">
                    Invia risposta
                  </SubmitButton>
                </form>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Già risposti */}
      {done.length > 0 && (
        <section>
          <SectionLabel>Già inviati</SectionLabel>
          <div className="flex flex-col gap-3">
            {done.map((c) => (
              <Card key={c.id}>
                <p className="whitespace-pre-wrap text-sm text-neutral-300">
                  {c.prompt}
                </p>
                {c.response?.text && (
                  <p className="mt-3 whitespace-pre-wrap border-t border-white/10 pt-3 text-sm text-neutral-200">
                    {c.response.text}
                  </p>
                )}
                {c.responded_at && (
                  <p className="mt-2 text-xs text-neutral-500">
                    Risposto il {formatDate(c.responded_at)}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
