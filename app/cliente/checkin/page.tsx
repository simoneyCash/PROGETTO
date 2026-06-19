import { redirect } from "next/navigation";
import { ClipboardCheck, CircleCheck } from "@/components/ui/icons";
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
  IconTile,
  Stat,
  EmptyState,
  Banner,
  cbtn,
  cfield,
} from "@/components/ui/client";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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
      <Stagger className="flex flex-col gap-6">
        <StaggerItem>
          <BackLink href="/cliente">Oggi</BackLink>
        </StaggerItem>

        <StaggerItem>
          <PageHeader title="Check-in" />
        </StaggerItem>

        {answered && (
          <StaggerItem>
            <Banner tone="success">Risposta inviata. Grazie! 💪</Banner>
          </StaggerItem>
        )}
        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        {rows.length === 0 ? (
          <StaggerItem>
            <EmptyState icon={ClipboardCheck}>
              Nessun check-in al momento. Il tuo coach te ne invierà quando serve.
            </EmptyState>
          </StaggerItem>
        ) : (
          <StaggerItem>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Da rispondere"
                value={<AnimatedNumber value={pending.length} />}
                tone={pending.length > 0 ? "accent" : "default"}
              />
              <Stat
                label="Già inviati"
                value={<AnimatedNumber value={done.length} />}
              />
            </div>
          </StaggerItem>
        )}

        {/* Da rispondere */}
        {pending.length > 0 && (
          <StaggerItem>
            <section>
              <SectionLabel>Da rispondere</SectionLabel>
              <div className="flex flex-col gap-3">
                {pending.map((c) => (
                  <Card key={c.id} tone="accent">
                    <div className="flex items-start gap-3">
                      <IconTile icon={ClipboardCheck} color="var(--accent)" />
                      <p className="min-w-0 flex-1 whitespace-pre-wrap pt-1.5 text-[15px] font-medium text-foreground">
                        {c.prompt}
                      </p>
                    </div>
                    <form
                      action={answerCheckin}
                      className="mt-4 flex flex-col gap-3"
                    >
                      <input type="hidden" name="checkin_id" value={c.id} />
                      <textarea
                        name="text"
                        rows={5}
                        required
                        placeholder="Scrivi qui la tua risposta…"
                        className={cfield}
                      />
                      <SubmitButton className={cbtn.primary} pendingText="Invio…">
                        Invia risposta
                      </SubmitButton>
                    </form>
                  </Card>
                ))}
              </div>
            </section>
          </StaggerItem>
        )}

        {/* Già risposti */}
        {done.length > 0 && (
          <StaggerItem>
            <section>
              <SectionLabel>Già inviati</SectionLabel>
              <div className="flex flex-col gap-3">
                {done.map((c) => (
                  <Card key={c.id}>
                    <div className="flex items-start gap-3">
                      <IconTile
                        icon={CircleCheck}
                        color="var(--faint)"
                        size="sm"
                      />
                      <p className="min-w-0 flex-1 whitespace-pre-wrap pt-1 text-sm text-muted">
                        {c.prompt}
                      </p>
                    </div>
                    {c.response?.text && (
                      <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-[15px] text-foreground">
                        {c.response.text}
                      </p>
                    )}
                    {c.responded_at && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
                        <CircleCheck className="size-4" />
                        Risposto il {formatDate(c.responded_at)}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          </StaggerItem>
        )}
      </Stagger>
    </Page>
  );
}
