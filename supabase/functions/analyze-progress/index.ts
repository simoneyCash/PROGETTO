// =============================================================================
// Coach AI — Edge Function: analyze-progress
// Analizza gli allenamenti loggati + i check-in di un cliente e produce una
// BOZZA di REPORT PROGRESSI che il coach revisiona e approva.
//
// Invarianti rispettati (CLAUDE.md):
//  - AI solo lato server (ANTHROPIC_API_KEY = secret della Edge Function).
//  - Output JSON STRUTTURATO e validato (output_config.format).
//  - Modello MEDIO (Sonnet): analisi più economica della generazione (Opus).
//  - NIENTE consigli medici/diagnosi: i segnali di salute vanno in `concerns`.
//  - Mai auto-approvato: il report nasce status='draft' (human-in-the-loop).
//  - Isolamento multi-tenant: staff del tenant del cliente (o sistema/service).
//
// Deploy: npx supabase functions deploy analyze-progress --project-ref tgjpolghmkskilplbhxa
// Secret: ANTHROPIC_API_KEY (già impostato per le altre funzioni AI).
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

// Modello medio: buona analisi a costo inferiore alla generazione (Opus).
const MODEL = "claude-sonnet-4-6";
const WINDOW_DAYS = 56; // ~8 settimane di storico

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

    // --- Chi chiama? STAFF (token coach) o SISTEMA (service role / cron). Il
    //     tenant si ricava sempre dal cliente; lo staff dev'essere dello stesso.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
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

    // --- Finestra temporale + raccolta dati (allenamenti, log, check-in) ---
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const startIso = periodStart.toISOString();

    const { count: workoutsCompleted } = await admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("client_id", client_id)
      .eq("status", "completed").gte("completed_at", startIso);

    const { data: logs } = await admin
      .from("workout_logs")
      .select("exercise_name, set_number, reps, weight, logged_at")
      .eq("tenant_id", tenantId).eq("client_id", client_id)
      .gte("logged_at", startIso)
      .order("logged_at", { ascending: true })
      .limit(1000);

    const { data: checkins } = await admin
      .from("checkins")
      .select("prompt, response, responded_at")
      .eq("tenant_id", tenantId).eq("client_id", client_id)
      .eq("status", "answered").gte("responded_at", startIso)
      .order("responded_at", { ascending: false })
      .limit(6);

    const { data: intake } = await admin
      .from("intakes").select("answers")
      .eq("tenant_id", tenantId).eq("client_id", client_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const completed = workoutsCompleted ?? 0;
    const logRows = logs ?? [];
    const answered = checkins ?? [];

    // Serve almeno UN segnale, altrimenti non c'è nulla da analizzare.
    if (completed === 0 && logRows.length === 0 && answered.length === 0) {
      return json({
        error:
          "Non ci sono ancora dati da analizzare: il cliente deve loggare qualche allenamento o rispondere a un check-in.",
      }, 400);
    }

    // Aggregazione compatta per esercizio (progressione carico/ripetizioni).
    // deno-lint-ignore no-explicit-any
    const byEx = new Map<string, any[]>();
    for (const l of logRows) {
      const key = (l.exercise_name as string) || "—";
      if (!byEx.has(key)) byEx.set(key, []);
      byEx.get(key)!.push(l);
    }
    const exercises = [...byEx.entries()].map(([exercise, arr]) => {
      const withW = arr.filter((a) => a.weight != null);
      // deno-lint-ignore no-explicit-any
      const best = withW.reduce((m: any, a: any) => (a.weight > (m?.weight ?? -1) ? a : m), null);
      const first = arr[0];
      const last = arr[arr.length - 1];
      const day = (d: string | null) => (d ? String(d).slice(0, 10) : null);
      return {
        exercise,
        sets_logged: arr.length,
        first: first ? { date: day(first.logged_at), weight: first.weight, reps: first.reps } : null,
        last: last ? { date: day(last.logged_at), weight: last.weight, reps: last.reps } : null,
        best: best ? { weight: best.weight, reps: best.reps } : null,
      };
    });

    const checkinSummary = answered.map((c) => ({
      date: c.responded_at ? String(c.responded_at).slice(0, 10) : null,
      prompt: c.prompt,
      response: c.response,
    }));

    const data = {
      obiettivo: (intake?.answers as Record<string, unknown> | null)?.goal ?? null,
      periodo: { da: startIso.slice(0, 10), a: periodEnd.toISOString().slice(0, 10) },
      allenamenti_completati: completed,
      checkin_risposti: answered.length,
      esercizi: exercises,
      checkin: checkinSummary,
    };

    // --- Schema strutturato del report ---
    const schema = {
      type: "object",
      additionalProperties: false,
      required: [
        "headline", "summary", "highlights", "strength_changes",
        "adherence_note", "suggestions", "concerns",
      ],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        highlights: { type: "array", items: { type: "string" } },
        strength_changes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["exercise", "change"],
            properties: {
              exercise: { type: "string" },
              change: { type: "string" },
            },
          },
        },
        adherence_note: { type: "string" },
        suggestions: { type: "array", items: { type: "string" } },
        concerns: { type: "array", items: { type: "string" } },
      },
    };

    const system = [
      "Sei un assistente analitico per personal trainer. Analizzi i dati di un",
      "cliente (allenamenti loggati, progressione dei carichi, check-in) e produci",
      "una BOZZA di report progressi che il COACH revisiona e approva. In italiano.",
      "REGOLE:",
      "- Basati SOLO sui dati forniti. Se i dati sono pochi, dillo con onestà e",
      "  resta sui fatti (es. costanza/aderenza) senza inventare numeri.",
      "- headline: una frase sola, il messaggio chiave. summary: 2-4 frasi.",
      "- highlights: i progressi positivi concreti (es. +carico, costanza).",
      "- strength_changes: variazioni di forza per esercizio (exercise + change,",
      "  es. 'Panca piana' / '+5 kg sul top set in 6 settimane'). Vuoto se assenti.",
      "- adherence_note: una riga sull'aderenza (allenamenti/check-in).",
      "- suggestions: cosa il coach POTREBBE aggiustare (volume, progressione,",
      "  nutrizione). Sono spunti: decide il coach.",
      "- concerns: segnali da attenzionare (dolore, sonno, calo aderenza, peso",
      "  fuori trend). NESSUN consiglio medico o diagnosi. Vuoto se non ce ne sono.",
    ].join("\n");

    const userMsg = [
      `Cliente: ${client.full_name}`,
      "",
      "Dati del periodo (JSON):",
      JSON.stringify(data, null, 2),
      "",
      "Produci il report secondo lo schema richiesto.",
    ].join("\n");

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userMsg }],
      output_config: { format: { type: "json_schema", schema } },
    };
    const message = await anthropic.messages.create(params);

    if (message.stop_reason === "max_tokens") {
      return json({ error: "Output troppo lungo, riprova" }, 502);
    }
    if (message.stop_reason === "refusal") {
      return json({ error: "L'AI ha rifiutato l'analisi (contenuto sensibile)." }, 422);
    }
    // deno-lint-ignore no-explicit-any
    const textBlock = (message.content as any[]).find((b) => b.type === "text");
    if (!textBlock?.text) return json({ error: "Risposta AI vuota" }, 502);

    let report: Record<string, unknown>;
    try {
      report = JSON.parse(textBlock.text);
    } catch {
      return json({ error: "JSON AI non valido" }, 502);
    }
    report = repairDeep(report);

    // Numeri di aderenza dai DATI (deterministici), non dall'AI.
    const content = {
      ...report,
      workouts_completed: completed,
      checkins_answered: answered.length,
    };

    const { data: row, error: insErr } = await admin
      .from("progress_reports")
      .insert({
        tenant_id: tenantId,
        client_id: client.id,
        status: "draft", // mai auto-approvato (human-in-the-loop)
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        content,
        generated_by_ai: true,
        created_by: actorId,
      })
      .select("id")
      .single();
    if (insErr || !row) return json({ error: "Errore salvataggio report: " + insErr?.message }, 500);

    await admin.from("activity_log").insert({
      tenant_id: tenantId,
      actor_id: actorId,
      action: "progress.report_generated",
      entity_type: "progress_report",
      entity_id: row.id,
      metadata: { client_id: client.id, generated_by_ai: true },
    });

    return json({ ok: true, report_id: row.id });
  } catch (e) {
    return json({ error: "Errore interno: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
