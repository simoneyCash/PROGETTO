import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { CHECKIN_STATUS } from "../status";

type Checkin = {
  id: string;
  client_id: string;
  prompt: string | null;
  status: string;
  scheduled_for: string | null;
  response: unknown;
  responded_at: string | null;
  ai_summary: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// La risposta del cliente è jsonb di forma libera. La mostriamo in modo
// leggibile: se è un oggetto, chiave→valore; altrimenti testo grezzo.
function renderResponse(response: unknown) {
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const entries = Object.entries(response as Record<string, unknown>);
    if (entries.length === 0) return null;
    return (
      <dl className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs text-neutral-500">{key}</dt>
            <dd className="text-sm text-neutral-200">{String(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-neutral-200">
      {String(response)}
    </p>
  );
}

export default async function CheckinDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const supabase = await createClient();

  const { data: checkin } = await supabase
    .from("checkins")
    .select(
      "id, client_id, prompt, status, scheduled_for, response, responded_at, ai_summary",
    )
    .eq("id", id)
    .maybeSingle();

  if (!checkin) notFound();
  const c = checkin as Checkin;

  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", c.client_id)
    .maybeSingle();

  const s = CHECKIN_STATUS[c.status] ?? {
    label: c.status,
    className: "bg-neutral-700/40 text-neutral-300",
  };
  const hasResponse =
    c.response !== null &&
    c.response !== undefined &&
    !(typeof c.response === "object" && Object.keys(c.response).length === 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach/checkin"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Tutti i check-in
      </Link>

      <header className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {client?.full_name ?? "Cliente"}
          </h1>
          <p className="text-sm text-neutral-500">
            Programmato per {formatDate(c.scheduled_for)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.className}`}
        >
          {s.label}
        </span>
      </header>

      {/* Domanda */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">Domanda</h2>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-sm text-neutral-200">
          {c.prompt}
        </p>
      </section>

      {/* Risposta del cliente */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">
          Risposta del cliente
        </h2>
        <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          {hasResponse ? (
            <>
              {renderResponse(c.response)}
              {c.responded_at && (
                <p className="mt-3 text-xs text-neutral-500">
                  Risposto il {formatDate(c.responded_at)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              In attesa di risposta dal cliente.
            </p>
          )}
        </div>
      </section>

      {/* Sintesi AI (futura) */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">Sintesi AI</h2>
        <div className="mt-2 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/30 p-3">
          {c.ai_summary ? (
            <p className="whitespace-pre-wrap text-sm text-neutral-200">
              {c.ai_summary}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              La sintesi AI sarà generata come bozza quando il cliente risponde,
              e dovrai approvarla prima che diventi ufficiale.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
