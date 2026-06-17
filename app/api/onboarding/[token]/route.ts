import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Salvataggio dell'anamnesi compilata da un lead via /onboarding/[token].
// SICUREZZA: gira solo lato server con la chiave di servizio. Il tenant_id viene
// SEMPRE preso dal record `clients` risolto dal token, MAI da input del browser.

const s = (v: unknown, max = 2000) => String(v ?? "").slice(0, max);

function buildAnswers(body: Record<string, unknown>) {
  return {
    schema_version: 2,
    anagrafica: {
      birth_date: s(body.birth_date, 20),
      sex: s(body.sex, 20),
      height_cm: s(body.height_cm, 10),
      weight_kg: s(body.weight_kg, 10),
    },
    obiettivi: { goal: s(body.goal, 60), motivation: s(body.motivation) },
    allenamento: {
      experience: s(body.experience, 40),
      days_per_week: s(body.days_per_week, 10),
      equipment: s(body.equipment),
    },
    salute: {
      injuries: s(body.injuries),
      conditions: s(body.conditions),
      medications: s(body.medications, 500),
    },
    nutrizione: { diet: s(body.diet), allergies: s(body.allergies, 500) },
    stile_vita: { sleep_hours: s(body.sleep_hours, 20) },
    // Campi piatti per retro-compatibilità: la pagina del coach e l'AI leggono questi.
    goal: s(body.goal, 60),
    experience: s(body.experience, 40),
    days_per_week: s(body.days_per_week, 10),
    equipment: s(body.equipment),
    injuries: [s(body.injuries), s(body.conditions), s(body.medications, 500)]
      .filter(Boolean)
      .join("; "),
    notes: s(body.notes),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, tenant_id, intake_token_expires_at")
    .eq("intake_token", token)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Link non valido." }, { status: 404 });
  }
  if (
    client.intake_token_expires_at &&
    new Date(client.intake_token_expires_at) < new Date()
  ) {
    return NextResponse.json(
      { error: "Link scaduto. Chiedine uno nuovo al coach." },
      { status: 410 },
    );
  }

  const answers = buildAnswers(body);
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("intakes")
    .select("id, submitted_at")
    .eq("client_id", client.id)
    .limit(1)
    .maybeSingle();

  // Difesa anti-abuso: una volta inviato, il questionario non si può
  // sovrascrivere via API (un link trapelato non può manomettere l'anamnesi
  // già compilata). Per correggere, il coach rigenera un nuovo link.
  if (existing?.submitted_at) {
    return NextResponse.json(
      {
        error:
          "Questionario già inviato. Per modifiche, chiedi un nuovo link al coach.",
      },
      { status: 409 },
    );
  }

  const result = existing
    ? await admin
        .from("intakes")
        .update({ answers, submitted_at: now })
        .eq("id", existing.id)
    : await admin.from("intakes").insert({
        tenant_id: client.tenant_id,
        client_id: client.id,
        answers,
        submitted_at: now,
      });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
