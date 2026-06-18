import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Invio email transazionali dal lato server di Next, passando SEMPRE dalla Edge
// Function `send-email` (la RESEND_API_KEY non tocca mai questo processo né il
// browser). Da usare solo dentro Server Action / Route Handler (usa i cookie di
// sessione per autenticarsi alla Edge Function come lo staff chiamante).
//
// Degrada con grazia: se Resend non è configurato o la funzione non è ancora
// deployata, ritorna { ok: false, ... } e il chiamante prosegue (es. mostra il
// link da copiare). Non lancia mai: l'email è un "di più", non deve rompere il
// flusso principale.
// =============================================================================
export async function sendTransactionalEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Sessione assente" };

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: msg,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: String(data.error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
