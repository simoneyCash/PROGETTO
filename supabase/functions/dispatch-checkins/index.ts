// =============================================================================
// Coach AI — Edge Function: dispatch-checkins
// Il "motore" dei check-in automatici (Onda 3C). Pensata per essere chiamata da
// pg_cron (una volta al giorno), ma testabile a mano con un POST.
//
// Cosa fa, per OGNI cliente attivo con account collegato:
//   1) DISPATCH: i check-in 'scheduled' la cui data è arrivata -> 'sent'.
//   2) AUTO-SETTIMANALE: se il cliente non ha nessun check-in aperto e l'ultimo
//      è di >= ~1 settimana fa (o non ne ha mai avuti), ne crea uno nuovo 'sent'
//      con il prompt settimanale di default. Così il coach non deve ricordarsene.
//   3) NOTIFICA: ai clienti con un check-in appena reso 'sent' manda un'email
//      (best-effort, via Resend) con il link alla pagina check-in.
//
// SICUREZZA: non c'è un utente. Si protegge con un segreto condiviso
// (header `x-cron-secret` == secret CRON_SECRET). Va deployata SENZA verifica
// JWT:  npx supabase functions deploy dispatch-checkins --no-verify-jwt --project-ref tgjpolghmkskilplbhxa
//
// Secret necessari (Dashboard -> Edge Functions -> Secrets):
//   CRON_SECRET     (obbligatorio) — lo stesso valore lo mette pg_cron nell'header
//   RESEND_API_KEY  (opzionale) — per le email; se assente, niente email
//   EMAIL_FROM      (opzionale) — default 'Coach AI <onboarding@resend.dev>'
//   SITE_URL        (opzionale) — es. 'https://app.tuodominio.it'; serve a creare
//                    il link cliccabile nell'email. Se assente, l'email invita
//                    solo ad aprire l'app.
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY iniettati da Supabase.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const DAY_MS = 24 * 60 * 60 * 1000;
// Soglia di ricorrenza: ~settimanale. 6 giorni così, con un giro al giorno, il
// nuovo check-in scatta in modo affidabile al 7° giorno anche se l'orario varia.
const RECUR_DAYS = 6;

const WEEKLY_PROMPT =
  "Come è andata la settimana? Dimmi: il peso di oggi, il livello di energia " +
  "(1-10), la qualità del sonno, quanto sei riuscito/a a seguire scheda e " +
  "alimentazione, e qualsiasi difficoltà o risultato che vuoi segnalare al coach.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return false;
  const EMAIL_FROM =
    Deno.env.get("EMAIL_FROM") ?? "Coach AI <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function checkinEmail(firstName: string): { html: string; text: string } {
  const SITE_URL = Deno.env.get("SITE_URL");
  const link = SITE_URL ? `${SITE_URL}/cliente/checkin` : "";
  const cta = link
    ? `<p style="margin:0 0 8px;"><a href="${link}" style="display:inline-block;background:#e7bf70;color:#18130c;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;">Rispondi al check-in</a></p>`
    : `<p style="margin:0 0 8px;font-size:15px;">Apri l'app Coach AI per rispondere.</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%"><tr><td align="center">
      <table role="presentation" width="480" style="max-width:480px;background:#fff;border-radius:16px;border:1px solid #e4e4e7;">
        <tr><td style="padding:28px 32px;">
          <span style="font-size:15px;font-weight:600;">Coach AI</span>
          <h1 style="margin:14px 0 8px;font-size:21px;font-weight:600;">Ciao ${firstName} 👋</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#3f3f46;">È il momento del tuo check-in settimanale: bastano due minuti e aiuti il coach a tarare il programma su di te.</p>
          ${cta}
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
  const text = `Ciao ${firstName}, è il momento del tuo check-in settimanale.${link ? " Rispondi qui: " + link : " Apri l'app Coach AI per rispondere."}`;
  return { html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    if (!CRON_SECRET) return json({ error: "CRON_SECRET non configurato" }, 500);
    if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return json({ error: "Non autorizzato" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // Clienti attivi con account collegato (gli unici che possono rispondere).
    const { data: clients, error: cErr } = await admin
      .from("clients")
      .select("id, tenant_id, full_name, email")
      .eq("status", "active")
      .not("profile_id", "is", null);
    if (cErr) return json({ error: "Errore lettura clienti: " + cErr.message }, 500);

    let dispatched = 0;
    let created = 0;
    let emailed = 0;

    for (const client of clients ?? []) {
      let newlySent = false;

      // 1) DISPATCH: i programmati la cui data è arrivata -> 'sent'.
      const { data: due } = await admin
        .from("checkins")
        .update({ status: "sent" })
        .eq("client_id", client.id)
        .eq("status", "scheduled")
        .lte("scheduled_for", nowIso)
        .select("id");
      if (due && due.length > 0) {
        dispatched += due.length;
        newlySent = true;
      }

      // 2) AUTO-SETTIMANALE: solo se non c'è nulla di aperto.
      const { count: pending } = await admin
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .in("status", ["scheduled", "sent"]);

      if ((pending ?? 0) === 0) {
        const { data: last } = await admin
          .from("checkins")
          .select("created_at")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const ageOk =
          !last?.created_at ||
          nowMs - new Date(last.created_at).getTime() >= RECUR_DAYS * DAY_MS;
        if (ageOk) {
          const { error: insErr } = await admin.from("checkins").insert({
            tenant_id: client.tenant_id,
            client_id: client.id,
            prompt: WEEKLY_PROMPT,
            status: "sent",
            scheduled_for: nowIso,
          });
          if (!insErr) {
            created += 1;
            newlySent = true;
          }
        }
      }

      // 3) NOTIFICA email (best-effort) se qualcosa è appena diventato 'sent'.
      if (newlySent && client.email) {
        const firstName = client.full_name?.split(" ")[0] || client.full_name || "";
        const { html, text } = checkinEmail(firstName);
        const ok = await sendEmail(
          client.email,
          "Il tuo check-in settimanale · Coach AI",
          html,
          text,
        );
        if (ok) emailed += 1;
      }
    }

    return json({
      ok: true,
      processed: clients?.length ?? 0,
      dispatched,
      created,
      emailed,
      at: nowIso,
    });
  } catch (e) {
    return json(
      { error: "Errore interno: " + (e instanceof Error ? e.message : String(e)) },
      500,
    );
  }
});
