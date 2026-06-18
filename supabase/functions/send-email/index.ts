// =============================================================================
// Coach AI — Edge Function: send-email
// Invia email transazionali via Resend. Centralizza le chiamate al servizio
// terzo lato server (CLAUDE.md §2.3): la RESEND_API_KEY è un secret della Edge
// Function e non tocca mai il browser.
//
// Sicurezza: richiede un chiamante autenticato STAFF (coach/admin). Il
// destinatario reale lo decide sempre il server (la server action lo ricava dal
// DB), non l'utente. [Hardening futuro multi-coach: rate-limit + from per-tenant.]
//
// Deploy:  npx supabase functions deploy send-email --project-ref tgjpolghmkskilplbhxa
// Secret:  RESEND_API_KEY   (Dashboard -> Edge Functions -> Secrets)
//          EMAIL_FROM       (opzionale, es. 'Coach AI <noreply@tuodominio.it>')
//          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY iniettati.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const EMAIL_FROM =
      Deno.env.get("EMAIL_FROM") ?? "Coach AI <onboarding@resend.dev>";

    // Non configurato: lo segnaliamo in modo esplicito così il chiamante può
    // degradare con grazia (mostra il link da copiare invece dell'email).
    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY non configurata", configured: false }, 503);
    }

    // --- AuthN: chi è il chiamante? (token utente) ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non autenticato" }, 401);

    // --- AuthZ: deve essere staff (coach/admin) ---
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      return json({ error: "Non autorizzato" }, 403);
    }

    const { to, subject, html, text } = await req
      .json()
      .catch(() => ({}));
    if (!to || !subject || !html) {
      return json({ error: "Campi mancanti: to, subject, html" }, 400);
    }

    // --- Invio via Resend ---
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json({ error: `Resend ${res.status}: ${detail}` }, 502);
    }

    const data = await res.json().catch(() => ({}));
    return json({ ok: true, id: data?.id ?? null });
  } catch (e) {
    return json(
      { error: "Errore interno: " + (e instanceof Error ? e.message : String(e)) },
      500,
    );
  }
});
