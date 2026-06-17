// =============================================================================
// Coach AI — Edge Function: generate-nutrition
// Dall'intake di un cliente, Claude genera una BOZZA di piano alimentare.
// Gemella di generate-program: stessi invarianti (CLAUDE.md).
//
//  - AI solo lato server (ANTHROPIC_API_KEY = secret della Edge Function).
//  - Output JSON STRUTTURATO e validato (output_config.format).
//  - NIENTE consigli medici/diagnosi; gli elementi sensibili (allergie,
//    patologie, farmaci) finiscono in health_flags per l'attenzione del coach.
//  - Mai auto-pubblicato: il piano nasce status='draft'.
//  - Isolamento multi-tenant: il chiamante dev'essere staff e il cliente del
//    suo tenant.
// NB: la nutrizione non ha una "libreria cibi" come grounding (la scheda usa la
//     libreria esercizi): i cibi sono testo, ma il coach revisiona e approva.
//
// Deploy: npx supabase functions deploy generate-nutrition --project-ref tgjpolghmkskilplbhxa
// Secret: ANTHROPIC_API_KEY (già impostato per generate-program).
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

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

// --- Riparazione "mojibake" degli accenti (identica a generate-program) ------
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

// deno-lint-ignore no-explicit-any
function repairDeep(v: any): any {
  if (typeof v === "string") return repairText(v);
  if (Array.isArray(v)) return v.map(repairDeep);
  if (v && typeof v === "object") {
    // deno-lint-ignore no-explicit-any
    const out: Record<string, any> = {};
    for (const k of Object.keys(v)) out[k] = repairDeep(v[k]);
    return out;
  }
  return v;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY non configurata" }, 500);

    const { client_id } = await req.json().catch(() => ({ client_id: null }));
    if (!client_id) return json({ error: "client_id mancante" }, 400);

    // --- AuthN: chi è il chiamante? (token utente) ---
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non autenticato" }, 401);

    // --- AuthZ: deve essere staff; il cliente deve essere del suo tenant ---
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin
      .from("profiles").select("id, tenant_id, role").eq("id", user.id).maybeSingle();
    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      return json({ error: "Non autorizzato" }, 403);
    }

    const { data: client } = await admin
      .from("clients").select("id, tenant_id, full_name").eq("id", client_id).maybeSingle();
    if (!client || client.tenant_id !== profile.tenant_id) {
      return json({ error: "Cliente non trovato nel tuo tenant" }, 404);
    }

    // --- Dati: intake (obiettivo, anagrafica, abitudini, allergie) ---
    const { data: intake } = await admin
      .from("intakes").select("answers")
      .eq("tenant_id", profile.tenant_id).eq("client_id", client_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!intake) return json({ error: "Nessun intake: compila prima il questionario" }, 400);

    // --- Schema strutturato del piano ---
    const mealSchema = {
      type: "object",
      additionalProperties: false,
      required: ["name", "items", "notes"],
      properties: {
        name: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["food", "quantity"],
            properties: {
              food: { type: "string" },
              quantity: { type: "string" },
            },
          },
        },
        notes: { type: "string" },
      },
    };
    const planSchema = {
      type: "object",
      additionalProperties: false,
      required: [
        "title", "summary", "daily_calories", "protein_g", "carbs_g", "fat_g",
        "meals", "coach_notes", "health_flags",
      ],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        daily_calories: { type: "integer" },
        protein_g: { type: "integer" },
        carbs_g: { type: "integer" },
        fat_g: { type: "integer" },
        meals: { type: "array", items: mealSchema },
        coach_notes: { type: "string" },
        health_flags: { type: "array", items: { type: "string" } },
      },
    };

    const system = [
      "Sei un assistente per personal trainer e nutrizionisti. Generi una BOZZA",
      "di piano alimentare che il COACH revisionerà e approverà prima di mostrarla",
      "al cliente. Scrivi in italiano.",
      "REGOLE:",
      "- NON dare consigli medici né diagnosi: è un piano alimentare sportivo, non",
      "  una terapia.",
      "- RISPETTA TASSATIVAMENTE allergie e intolleranze indicate nell'intake: non",
      "  includere mai quegli alimenti.",
      "- Metti in health_flags ogni elemento sensibile (allergie, patologie,",
      "  farmaci, condizioni) che richiede l'attenzione del coach.",
      "- Stima calorie e macro (proteine/carboidrati/grassi in grammi) coerenti con",
      "  obiettivo, peso, altezza, sesso, età e abitudini dell'intake. Se mancano",
      "  dati, fai una stima ragionevole e segnalalo in coach_notes.",
      "- Usa cibi comuni italiani con quantità chiare (grammi o porzioni).",
      "- Organizza in pasti (es. Colazione, Spuntino, Pranzo, Cena).",
    ].join("\n");

    const userMsg = [
      `Cliente: ${client.full_name}`,
      "",
      "Questionario di intake (JSON):",
      JSON.stringify(intake.answers, null, 2),
      "",
      "Genera la bozza di piano alimentare secondo lo schema richiesto.",
    ].join("\n");

    // --- Chiamata a Claude (JSON strutturato + adaptive thinking) ---
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: userMsg }],
      output_config: { format: { type: "json_schema", schema: planSchema } },
    };
    const message = await anthropic.messages.create(params);

    if (message.stop_reason === "max_tokens") {
      return json({ error: "Output troppo lungo, riprova" }, 502);
    }
    if (message.stop_reason === "refusal") {
      return json({
        error:
          "L'AI ha rifiutato la generazione (contenuto sensibile). Rivedi l'intake o crea il piano manualmente.",
      }, 422);
    }
    // deno-lint-ignore no-explicit-any
    const textBlock = (message.content as any[]).find((b) => b.type === "text");
    if (!textBlock?.text) return json({ error: "Risposta AI vuota" }, 502);

    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(textBlock.text);
    } catch {
      return json({ error: "JSON AI non valido" }, 502);
    }

    // Ripara eventuali accenti corrotti (mojibake "√†") prima di salvare.
    plan = repairDeep(plan);

    const { data: plan_row, error: insErr } = await admin
      .from("nutrition_plans")
      .insert({
        tenant_id: profile.tenant_id,
        client_id: client.id,
        title: typeof plan.title === "string" ? plan.title : "Piano alimentare",
        status: "draft", // mai auto-pubblicato (human-in-the-loop)
        content: plan,
        generated_by_ai: true,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (insErr || !plan_row) {
      return json({ error: "Errore salvataggio piano: " + insErr?.message }, 500);
    }

    await admin.from("activity_log").insert({
      tenant_id: profile.tenant_id,
      actor_id: profile.id,
      action: "nutrition.draft_generated",
      entity_type: "nutrition_plan",
      entity_id: plan_row.id,
      metadata: { client_id: client.id, generated_by_ai: true },
    });

    return json({
      ok: true,
      plan_id: plan_row.id,
      health_flags: Array.isArray(plan.health_flags) ? plan.health_flags : [],
    });
  } catch (e) {
    return json({ error: "Errore interno: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
