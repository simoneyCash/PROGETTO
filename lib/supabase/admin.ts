import { createClient } from "@supabase/supabase-js";

// =============================================================================
// Client Supabase con SERVICE ROLE — BYPASSA la RLS.
//
// ⚠️ SOLO LATO SERVER (Route Handler / Server Action / Server Component).
// MAI importare questo file in un componente client: la SUPABASE_SERVICE_ROLE_KEY
// non ha prefisso NEXT_PUBLIC_, quindi non viene mai inviata al browser.
//
// Uso previsto: flussi SENZA account (es. anamnesi a link). Il chiamante
// risolve un token e scrive timbrando SEMPRE tenant_id/ruolo dal record reale
// del database, mai da input del browser.
// =============================================================================
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Service role non configurato: imposta NEXT_PUBLIC_SUPABASE_URL e " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local (solo lato server).",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
