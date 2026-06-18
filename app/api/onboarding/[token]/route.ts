import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Onboarding unificato (Fetta 2): un lead, da /onboarding/[token], compila
// l'anamnesi E crea il proprio accesso (password) in un unico flusso.
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

// L'admin API non ha "getByEmail": cerchiamo nella lista (scala per il pilota).
async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const target = email.toLowerCase();
  return data?.users?.find((u) => u.email?.toLowerCase() === target)?.id ?? null;
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

  const password = String(body.password ?? "");

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, tenant_id, full_name, email, profile_id, intake_token_expires_at")
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

  // Se è previsto l'accesso (c'è l'email del cliente), la password è obbligatoria.
  if (client.email && password.length < 8) {
    return NextResponse.json(
      { error: "Scegli una password di almeno 8 caratteri." },
      { status: 400 },
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
  // sovrascrivere via API (un link trapelato non può manomettere l'anamnesi).
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

  // Crea/collega l'account e fai il login (best-effort). Se qualcosa va storto,
  // l'anamnesi è comunque salvata: il cliente potrà accedere dal /login più tardi.
  let redirect: string | null = null;
  if (client.email && password.length >= 8) {
    redirect = "/login?activated=1"; // fallback se l'auto-login non riesce
    try {
      let userId: string | null = client.profile_id ?? null;
      if (userId) {
        await admin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        });
      } else {
        const { data: created } = await admin.auth.admin.createUser({
          email: client.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: client.full_name },
        });
        if (created?.user) {
          userId = created.user.id;
        } else {
          userId = await findAuthUserIdByEmail(admin, client.email);
          if (userId) {
            await admin.auth.admin.updateUserById(userId, {
              password,
              email_confirm: true,
            });
          }
        }
      }

      if (userId) {
        await admin.from("profiles").upsert(
          {
            id: userId,
            tenant_id: client.tenant_id,
            role: "client",
            full_name: client.full_name,
            email: client.email,
          },
          { onConflict: "id" },
        );
        await admin
          .from("clients")
          .update({ profile_id: userId })
          .eq("id", client.id);

        // Login immediato: scrive i cookie di sessione sulla risposta.
        const supabase = await createServerSupabase();
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: client.email,
          password,
        });
        if (!signErr) redirect = "/";
      }
    } catch {
      // redirect resta il fallback /login?activated=1
    }
  }

  // Fetta 3: appena il cliente ha inviato l'anamnesi, l'AI prepara DA SOLA le
  // bozze di scheda e nutrizione (chiamata "di sistema" con service role). Gira
  // DOPO la risposta (after) così il cliente non aspetta i ~30s della generazione;
  // le bozze compaiono nella coda "Da fare" del coach. Best-effort: se qualcosa
  // non va (es. libreria esercizi vuota), il coach può comunque generare a mano.
  after(async () => {
    await Promise.allSettled([
      admin.functions.invoke("generate-program", {
        body: { client_id: client.id },
      }),
      admin.functions.invoke("generate-nutrition", {
        body: { client_id: client.id },
      }),
    ]);
  });

  return NextResponse.json({ ok: true, redirect });
}
