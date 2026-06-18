// =============================================================================
// Coach AI — Edge Function: generate-program
// Dall'intake di un cliente, Claude genera una BOZZA di scheda di allenamento.
//
// Invarianti rispettati (CLAUDE.md):
//  - AI solo lato server (qui, mai nel browser). La ANTHROPIC_API_KEY è un
//    secret della Edge Function.
//  - Output JSON STRUTTURATO e validato (output_config.format).
//  - GROUNDING: lo schema vincola exercise_id a un enum degli ID reali della
//    libreria del tenant -> l'AI non può inventare esercizi.
//  - Mai auto-pubblicato: la versione nasce status='draft'.
//  - Isolamento multi-tenant: si verifica che il chiamante sia staff e che il
//    cliente appartenga al suo tenant.
//
// Deploy:  supabase functions deploy generate-program   (o dal Dashboard)
// Secret:  ANTHROPIC_API_KEY  (Dashboard -> Edge Functions -> Secrets, o CLI)
//          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sono iniettati da Supabase.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

// Modello "forte" per la generazione (CLAUDE.md §9). I riepiloghi useranno un
// modello più economico in futuro.
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

// ---------------------------------------------------------------------------
// Riparazione "mojibake" degli accenti.
// In alcuni runtime la risposta UTF-8 dell'AI viene riletta come Mac Roman:
// "à" (byte C3 A0) diventa "√†", "è" (C3 A8) diventa "√®", ecc. Qui invertiamo
// l'errore: rimappiamo ogni carattere al suo byte Mac Roman e li rileggiamo
// come UTF-8. È SICURO e idempotente:
//  - agiamo solo su stringhe che contengono i marcatori "√" (byte C3) o
//    "¬" (byte C2), gli "header" UTF-8 delle lettere accentate;
//  - se i byte ricostruiti non sono UTF-8 valido, la stringa era già corretta
//    e la lasciamo invariata. Quindi rilanciarlo due volte non rovina nulla.
// ---------------------------------------------------------------------------
const MAC_DECODER = new TextDecoder("x-mac-roman");
const UNICODE_TO_MAC = new Map<string, number>();
for (let b = 0; b < 256; b++) {
  UNICODE_TO_MAC.set(MAC_DECODER.decode(new Uint8Array([b])), b);
}
const UTF8_STRICT = new TextDecoder("utf-8", { fatal: true });

function repairText(s: string): string {
  if (typeof s !== "string") return s;
  if (!s.includes("√") && !s.includes("¬")) return s; // "√" (byte C3) o "¬" (byte C2)
  const bytes = new Uint8Array(s.length * 2);
  let n = 0;
  for (const ch of s) {
    const b = UNICODE_TO_MAC.get(ch);
    if (b === undefined) return s; // carattere fuori da Mac Roman -> non è questo errore
    bytes[n++] = b;
  }
  try {
    return UTF8_STRICT.decode(bytes.subarray(0, n));
  } catch {
    return s; // i byte non formano UTF-8 valido -> stringa già corretta
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

    // --- Chi chiama? STAFF (token del coach) o SISTEMA (service role, es.
    //     onboarding automatico che genera le bozze appena il cliente invia).
    //     Il tenant si ricava sempre dal cliente; lo staff in più dev'essere
    //     dello stesso tenant. Resta human-in-the-loop: la versione nasce 'draft'.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    // SISTEMA = chiamata server-to-server (onboarding automatico). Accettiamo sia
    // la service key iniettata, sia SYSTEM_SECRET (= la service key di .env.local
    // usata dalla route): su alcuni progetti le due service key non coincidono.
    const SYSTEM_SECRET = Deno.env.get("SYSTEM_SECRET");
    const isSystem =
      !!bearer && (bearer === SERVICE_KEY || (!!SYSTEM_SECRET && bearer === SYSTEM_SECRET));

    let tenantId: string;
    let actorId: string | null = null;
    let client: { id: string; tenant_id: string; full_name: string };

    if (isSystem) {
      const { data: c } = await admin
        .from("clients").select("id, tenant_id, full_name").eq("id", client_id).maybeSingle();
      if (!c) return json({ error: "Cliente non trovato" }, 404);
      client = c;
      tenantId = c.tenant_id;
    } else {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Non autenticato" }, 401);

      const { data: profile } = await admin
        .from("profiles").select("id, tenant_id, role").eq("id", user.id).maybeSingle();
      if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
        return json({ error: "Non autorizzato" }, 403);
      }

      const { data: c } = await admin
        .from("clients").select("id, tenant_id, full_name").eq("id", client_id).maybeSingle();
      if (!c || c.tenant_id !== profile.tenant_id) {
        return json({ error: "Cliente non trovato nel tuo tenant" }, 404);
      }
      client = c;
      tenantId = c.tenant_id;
      actorId = profile.id;
    }

    // --- Dati di grounding: intake + libreria esercizi ---
    const { data: intake } = await admin
      .from("intakes").select("answers")
      .eq("tenant_id", tenantId).eq("client_id", client_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!intake) return json({ error: "Nessun intake: compila prima il questionario" }, 400);

    const { data: exercises } = await admin
      .from("exercises").select("id, name, muscle_group, equipment")
      .eq("tenant_id", tenantId).eq("is_active", true);
    if (!exercises || exercises.length === 0) {
      return json({ error: "Libreria esercizi vuota: aggiungi esercizi prima di generare" }, 400);
    }

    const exerciseById = new Map(exercises.map((e) => [e.id, e]));

    // --- Schema strutturato: exercise_id vincolato agli ID reali (grounding) ---
    const exerciseSchema = {
      type: "object",
      additionalProperties: false,
      required: ["exercise_id", "exercise_name", "sets", "reps", "rest_seconds", "notes"],
      properties: {
        exercise_id: { type: "string", enum: exercises.map((e) => e.id) },
        exercise_name: { type: "string" },
        sets: { type: "integer" },
        reps: { type: "string" },
        rest_seconds: { type: "integer" },
        notes: { type: "string" },
      },
    };
    const programSchema = {
      type: "object",
      additionalProperties: false,
      required: ["title", "summary", "days", "coach_notes", "health_flags"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        days: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "focus", "exercises"],
            properties: {
              label: { type: "string" },
              focus: { type: "string" },
              exercises: { type: "array", items: exerciseSchema },
            },
          },
        },
        coach_notes: { type: "string" },
        health_flags: { type: "array", items: { type: "string" } },
      },
    };

    const system = [
      "Sei un assistente per personal trainer. Generi una BOZZA di scheda di",
      "allenamento che il COACH revisionerà e approverà prima di mostrarla al",
      "cliente. Scrivi in italiano.",
      "REGOLE:",
      "- Usa SOLO gli esercizi forniti, riferendoti al loro exercise_id.",
      "- NON dare consigli medici né diagnosi.",
      "- Metti in health_flags ogni elemento sensibile dal punto di vista della",
      "  salute (infortuni, patologie, dolore) che richiede l'attenzione del coach.",
      "- Adatta volume/intensità a obiettivo, esperienza e giorni a settimana.",
    ].join("\n");

    const userMsg = [
      `Cliente: ${client.full_name}`,
      "",
      "Questionario di intake (JSON):",
      JSON.stringify(intake.answers, null, 2),
      "",
      "Libreria esercizi disponibili (usa SOLO questi exercise_id):",
      JSON.stringify(exercises, null, 2),
      "",
      "Genera la bozza di scheda secondo lo schema richiesto.",
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
      output_config: { format: { type: "json_schema", schema: programSchema } },
    };
    const message = await anthropic.messages.create(params);

    if (message.stop_reason === "max_tokens") {
      return json({ error: "Output troppo lungo, riprova" }, 502);
    }
    if (message.stop_reason === "refusal") {
      return json({
        error:
          "L'AI ha rifiutato la generazione (contenuto sensibile). Rivedi l'intake o crea la scheda manualmente.",
      }, 422);
    }
    // deno-lint-ignore no-explicit-any
    const textBlock = (message.content as any[]).find((b) => b.type === "text");
    if (!textBlock?.text) return json({ error: "Risposta AI vuota" }, 502);

    let program: {
      title: string; summary: string; coach_notes: string;
      health_flags: string[];
      days: { label: string; focus: string; exercises: {
        exercise_id: string; exercise_name: string; sets: number;
        reps: string; rest_seconds: number; notes: string;
      }[] }[];
    };
    try {
      program = JSON.parse(textBlock.text);
    } catch {
      return json({ error: "JSON AI non valido" }, 502);
    }

    // Difesa in profondità: i nomi esercizio vengono dalla libreria, non dall'AI.
    for (const day of program.days) {
      for (const ex of day.exercises) {
        const lib = exerciseById.get(ex.exercise_id);
        if (lib) ex.exercise_name = lib.name;
      }
    }

    // Ripara eventuali accenti corrotti (mojibake "√†") prima di salvare, così
    // la bozza nasce pulita anche se il runtime ha mal-decodificato la risposta.
    program = repairDeep(program);

    // --- Persistenza: riusa il programma del cliente (uno solo), aggiungi una
    //     nuova VERSIONE draft (version = max+1). Niente duplicati.
    let program_id: string;
    const { data: existingProgram } = await admin
      .from("programs").select("id")
      .eq("tenant_id", tenantId).eq("client_id", client.id)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();

    if (existingProgram) {
      program_id = existingProgram.id;
      await admin.from("programs")
        .update({ title: program.title, description: program.summary })
        .eq("id", program_id);
    } else {
      const { data: program_row, error: pErr } = await admin
        .from("programs")
        .insert({
          tenant_id: tenantId,
          client_id: client.id,
          title: program.title,
          description: program.summary,
        })
        .select("id")
        .single();
      if (pErr || !program_row) return json({ error: "Errore salvataggio programma: " + pErr?.message }, 500);
      program_id = program_row.id;
    }

    const { data: lastVersion } = await admin
      .from("program_versions").select("version")
      .eq("program_id", program_id)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const { data: version_row, error: vErr } = await admin
      .from("program_versions")
      .insert({
        tenant_id: tenantId,
        program_id,
        client_id: client.id,
        version: nextVersion,
        status: "draft", // mai auto-pubblicato (human-in-the-loop)
        content: program,
        generated_by_ai: true,
        created_by: actorId,
      })
      .select("id")
      .single();
    if (vErr || !version_row) return json({ error: "Errore salvataggio versione: " + vErr?.message }, 500);

    await admin.from("activity_log").insert({
      tenant_id: tenantId,
      actor_id: actorId,
      action: "program.draft_generated",
      entity_type: "program_version",
      entity_id: version_row.id,
      metadata: { client_id: client.id, generated_by_ai: true },
    });

    return json({
      ok: true,
      program_id,
      version_id: version_row.id,
      health_flags: program.health_flags ?? [],
    });
  } catch (e) {
    return json({ error: "Errore interno: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
