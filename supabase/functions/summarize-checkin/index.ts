// =============================================================================
// Coach AI — Edge Function: summarize-checkin
// Riassume la risposta del cliente a un check-in, come BOZZA che il coach
// revisiona/approva. Lanciata dal coach (human-in-the-loop).
//
// Invarianti (CLAUDE.md):
//  - AI solo lato server (ANTHROPIC_API_KEY = secret della Edge Function).
//  - Modello ECONOMICO per i riassunti (§9), forte per la generazione.
//  - NIENTE consigli medici/diagnosi.
//  - Mai "ufficiale" da solo: la sintesi nasce summary_status='draft'.
//  - Isolamento multi-tenant: chiamante staff + check-in del suo tenant.
//
// Deploy: npx supabase functions deploy summarize-checkin --project-ref tgjpolghmkskilplbhxa
// Secret: ANTHROPIC_API_KEY (già impostato).
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

// Modello economico per i riassunti.
const MODEL = "claude-haiku-4-5-20251001";

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

// --- Riparazione "mojibake" degli accenti (come le altre funzioni) ----------
const MAC_DECODER = new TextDecoder("x-mac-roman");
const UNICODE_TO_MAC = new Map<string, number>();
for (let b = 0; b < 256; b++) {
  UNICODE_TO_MAC.set(MAC_DECODER.decode(new Uint8Array([b])), b);
}
const UTF8_STRICT = new TextDecoder("utf-8", { fatal: true });
function repairText(s: string): string {
  if (typeof s !== "string") return s;
  if (!s.includes("√") && !s.includes("¬")) return s;
  const bytes = new Uint8Array(s.length * 2);
  let n = 0;
  for (const ch of s) {
    const b = UNICODE_TO_MAC.get(ch);
    if (b === undefined) return s;
    bytes[n++] = b;
  }
  try {
    return UTF8_STRICT.decode(bytes.subarray(0, n));
  } catch {
    return s;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY non configurata" }, 500);

    const { checkin_id } = await req.json().catch(() => ({ checkin_id: null }));
    if (!checkin_id) return json({ error: "checkin_id mancante" }, 400);

    // --- AuthN: chi è il chiamante? ---
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non autenticato" }, 401);

    // --- AuthZ: staff + check-in del suo tenant ---
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await admin
      .from("profiles").select("id, tenant_id, role").eq("id", user.id).maybeSingle();
    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      return json({ error: "Non autorizzato" }, 403);
    }

    const { data: checkin } = await admin
      .from("checkins")
      .select("id, tenant_id, prompt, response, status")
      .eq("id", checkin_id).maybeSingle();
    if (!checkin || checkin.tenant_id !== profile.tenant_id) {
      return json({ error: "Check-in non trovato nel tuo tenant" }, 404);
    }
    if (checkin.status !== "answered" || !checkin.response) {
      return json({ error: "Il cliente non ha ancora risposto a questo check-in" }, 400);
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["summary", "concerns"],
      properties: {
        summary: { type: "string" },
        concerns: { type: "array", items: { type: "string" } },
      },
    };

    const system = [
      "Sei un assistente per personal trainer. Riassumi in modo CONCISO la",
      "risposta del cliente a un check-in, per far risparmiare tempo al coach.",
      "Scrivi in italiano.",
      "REGOLE:",
      "- Sintesi breve (2-4 frasi): cosa va, cosa è cambiato, come si sente.",
      "- In 'concerns' metti i segnali da attenzionare (calo aderenza, dolore,",
      "  sonno scarso, peso fuori trend, umore basso). Vuoto se non ce ne sono.",
      "- Puoi suggerire SE serve un aggiustamento, ma NON proporre terapie o",
      "  diagnosi mediche. Decide il coach.",
    ].join("\n");

    const userMsg = [
      "Domanda del check-in:",
      String(checkin.prompt ?? ""),
      "",
      "Risposta del cliente (JSON):",
      JSON.stringify(checkin.response, null, 2),
      "",
      "Produci la sintesi secondo lo schema richiesto.",
    ].join("\n");

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userMsg }],
      output_config: { format: { type: "json_schema", schema } },
    };
    const message = await anthropic.messages.create(params);

    if (message.stop_reason === "max_tokens") {
      return json({ error: "Output troppo lungo, riprova" }, 502);
    }
    // deno-lint-ignore no-explicit-any
    const textBlock = (message.content as any[]).find((b) => b.type === "text");
    if (!textBlock?.text) return json({ error: "Risposta AI vuota" }, 502);

    let parsed: { summary: string; concerns: string[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return json({ error: "JSON AI non valido" }, 502);
    }

    const summary = repairText(parsed.summary ?? "");
    const concerns = Array.isArray(parsed.concerns)
      ? parsed.concerns.map((c) => repairText(String(c))).filter(Boolean)
      : [];
    const aiSummary = concerns.length
      ? `${summary}\n\nDa attenzionare:\n${concerns.map((c) => `• ${c}`).join("\n")}`
      : summary;

    const { error: upErr } = await admin
      .from("checkins")
      .update({ ai_summary: aiSummary, summary_status: "draft" })
      .eq("id", checkin_id);
    if (upErr) return json({ error: "Errore salvataggio sintesi: " + upErr.message }, 500);

    await admin.from("activity_log").insert({
      tenant_id: profile.tenant_id,
      actor_id: profile.id,
      action: "checkin.summary_generated",
      entity_type: "checkin",
      entity_id: checkin_id,
      metadata: { generated_by_ai: true },
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Errore interno: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
