"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { sendTransactionalEmail } from "@/lib/email";
import { accessInviteEmail, onboardingInviteEmail } from "@/lib/email-templates";

// Origine assoluta (https://dominio) dalla richiesta corrente. Su localhost usa
// http; altrove https. Serve per costruire link cliccabili nelle email.
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (!host) return "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

// Crea un nuovo cliente nel tenant del coach.
export async function addClient(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!full_name) {
    redirect(
      "/coach/clienti?error=" + encodeURIComponent("Il nome è obbligatorio"),
    );
  }

  const supabase = await createServerSupabase();
  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: profile.tenant_id, // RLS: deve combaciare con il tenant del coach
      coach_id: profile.id,
      full_name,
      email: email || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      "/coach/clienti?error=" +
        encodeURIComponent(error?.message ?? "Errore nella creazione"),
    );
  }

  // Se c'è l'email, genera subito il link di onboarding e prova a inviarlo:
  // il cliente apre il link, crea l'accesso e compila l'anamnesi (un unico
  // flusso). Senza email configurata si degrada: il coach copia il link dalla
  // linguetta Anamnesi.
  if (email) {
    const token = crypto.randomUUID();
    const expires = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 14,
    ).toISOString(); // 14 giorni
    await supabase
      .from("clients")
      .update({ intake_token: token, intake_token_expires_at: expires })
      .eq("id", created.id)
      .eq("tenant_id", profile.tenant_id);

    let sent = false;
    const origin = await currentOrigin();
    if (origin) {
      const { subject, html, text } = onboardingInviteEmail({
        clientName: full_name,
        url: `${origin}/onboarding/${token}`,
      });
      const res = await sendTransactionalEmail({ to: email, subject, html, text });
      sent = res.ok;
    }

    revalidatePath(`/coach/clienti/${created.id}`);
    redirect(
      `/coach/clienti/${created.id}?tab=anamnesi&invited=${sent ? "sent" : "link"}`,
    );
  }

  revalidatePath("/coach/clienti");
  redirect(`/coach/clienti/${created.id}`);
}

// Salva (crea o aggiorna) il questionario di intake di un cliente.
export async function saveIntake(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) redirect("/coach");

  const flat = {
    goal: String(formData.get("goal") ?? ""),
    experience: String(formData.get("experience") ?? ""),
    days_per_week: String(formData.get("days_per_week") ?? ""),
    equipment: String(formData.get("equipment") ?? ""),
    injuries: String(formData.get("injuries") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const supabase = await createServerSupabase();

  // Un intake per cliente: aggiorna quello esistente, altrimenti crealo.
  const { data: existing } = await supabase
    .from("intakes")
    .select("id, answers")
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();

  // Unisci ai dati esistenti: NON perdere le sezioni ricche dell'anamnesi
  // (anagrafica, obiettivi, salute…) compilate dal cliente via link.
  const answers = {
    ...((existing?.answers as Record<string, unknown>) ?? {}),
    ...flat,
  };

  const now = new Date().toISOString();
  const { error } = existing
    ? await supabase
        .from("intakes")
        .update({ answers, submitted_at: now })
        .eq("id", existing.id)
    : await supabase.from("intakes").insert({
        tenant_id: profile.tenant_id,
        client_id: clientId,
        answers,
        submitted_at: now,
      });

  if (error) {
    redirect(
      `/coach/clienti/${clientId}?tab=anamnesi&error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/coach/clienti/${clientId}`);
  redirect(`/coach/clienti/${clientId}?tab=anamnesi&saved=1`);
}

// Chiama la Edge Function che genera la BOZZA di scheda con l'AI.
export async function generateProgramDraft(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) redirect("/coach");

  const supabase = await createServerSupabase();
  // Inoltra esplicitamente il token utente alla Edge Function (la funzione
  // verifica con getUser che sei staff del tenant del cliente).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("generate-program", {
    body: { client_id: clientId },
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });

  if (error) {
    redirect(
      `/coach/clienti/${clientId}?tab=scheda&error=` +
        encodeURIComponent("Generazione AI non riuscita: " + error.message),
    );
  }
  if (data?.error) {
    redirect(
      `/coach/clienti/${clientId}?tab=scheda&error=` +
        encodeURIComponent(data.error),
    );
  }

  revalidatePath(`/coach/clienti/${clientId}`);
  if (data?.version_id) redirect(`/coach/programmi/${data.version_id}`);
  redirect(`/coach/clienti/${clientId}`);
}

// Il coach approva e pubblica una bozza: diventa visibile al cliente.
export async function approveProgramVersion(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const versionId = String(formData.get("version_id") ?? "");
  if (!versionId) redirect("/coach");

  const supabase = await createServerSupabase();
  // Pubblicazione atomica (vedi RPC publish_program_version): aggiorna la
  // versione, archivia le altre pubblicate e punta il programma, in una
  // transazione. La RLS garantisce lo scope sul tenant del coach.
  const { error } = await supabase.rpc("publish_program_version", {
    p_version_id: versionId,
  });
  if (error) {
    redirect(
      `/coach/programmi/${versionId}?error=` + encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/coach/programmi/${versionId}`);
  redirect(`/coach/programmi/${versionId}?published=1`);
}

// --- Editor della bozza: il coach modifica la scheda prima di pubblicare ------

type EditorExercise = {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
};
type EditorDay = { label: string; focus: string; exercises: EditorExercise[] };
type EditorContent = {
  title: string;
  summary: string;
  coach_notes: string;
  health_flags: string[];
  days: EditorDay[];
};

const clampStr = (s: unknown, max: number) => String(s ?? "").slice(0, max);
const toInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

// Genera (o rigenera) il link d'invito all'anamnesi per un cliente: imposta un
// token univoco + scadenza a 14 giorni. Scrive solo dentro il proprio tenant.
export async function createIntakeLink(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) redirect("/coach");

  const token = crypto.randomUUID();
  const expires = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 14,
  ).toISOString(); // 14 giorni

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("clients")
    .update({ intake_token: token, intake_token_expires_at: expires })
    .eq("id", clientId)
    .eq("tenant_id", profile.tenant_id); // difesa in profondità oltre alla RLS
  if (error) {
    redirect(
      `/coach/clienti/${clientId}?tab=anamnesi&error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/coach/clienti/${clientId}`);
  redirect(`/coach/clienti/${clientId}?tab=anamnesi&invite=1`);
}

// Genera (o rigenera) il link di ATTIVAZIONE account per un cliente: token
// univoco + scadenza a 7 giorni. Il cliente apre `/attiva/[token]`, sceglie la
// password e l'account viene creato/collegato lato server. Richiede l'email del
// cliente (serve a creare l'account). Scrive solo dentro il proprio tenant.
export async function createClientAccess(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) redirect("/coach");

  const supabase = await createServerSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) redirect("/coach/clienti");
  if (!client.email) {
    redirect(
      `/coach/clienti/${clientId}?tab=quadro&error=` +
        encodeURIComponent(
          "Aggiungi prima l'email del cliente per creare l'accesso.",
        ),
    );
  }

  const token = crypto.randomUUID();
  const expires = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 7,
  ).toISOString(); // 7 giorni

  const { error } = await supabase
    .from("clients")
    .update({ access_token: token, access_token_expires_at: expires })
    .eq("id", clientId)
    .eq("tenant_id", profile.tenant_id); // difesa in profondità oltre alla RLS
  if (error) {
    redirect(
      `/coach/clienti/${clientId}?tab=quadro&error=` +
        encodeURIComponent(error.message),
    );
  }

  // Prova a inviare il link via email (Resend). Se non è configurato o fallisce,
  // si degrada: il coach copia il link a mano (?access=1). L'email è un "di più".
  let emailed = false;
  const origin = await currentOrigin();
  if (origin && client.email) {
    const { subject, html, text } = accessInviteEmail({
      clientName: client.full_name,
      url: `${origin}/attiva/${token}`,
    });
    const res = await sendTransactionalEmail({ to: client.email, subject, html, text });
    emailed = res.ok;
  }

  revalidatePath(`/coach/clienti/${clientId}`);
  redirect(
    `/coach/clienti/${clientId}?tab=quadro&access=${emailed ? "sent" : "1"}`,
  );
}

// Salva le modifiche del coach a una bozza di scheda. Con intent="publish"
// salva E pubblica (atomico lato DB via RPC). Mantiene gli invarianti:
//  - GROUNDING: ogni esercizio deve esistere nella libreria del tenant; il nome
//    viene riscritto dalla libreria (fonte autorevole), mai dal client.
//  - HUMAN-IN-THE-LOOP: una versione pubblicata/archiviata non è più editabile.
//  - MULTI-TENANT: oltre alla RLS, vincolo esplicito .eq("tenant_id").
export async function saveProgramVersion(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const versionId = String(formData.get("version_id") ?? "");
  const intent = String(formData.get("intent") ?? "save"); // "save" | "publish"
  if (!versionId) redirect("/coach");

  const fail = (msg: string): never =>
    redirect(`/coach/programmi/${versionId}?error=` + encodeURIComponent(msg));

  let incoming: Partial<EditorContent>;
  try {
    incoming = JSON.parse(String(formData.get("content") ?? "{}"));
  } catch {
    fail("Contenuto non valido, riprova.");
  }

  const supabase = await createServerSupabase();

  // La versione deve esistere, essere del mio tenant (RLS) e NON ancora pubblicata.
  const { data: version } = await supabase
    .from("program_versions")
    .select("id, status, content")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) {
    redirect(
      `/coach/programmi/${versionId}?error=` +
        encodeURIComponent("Scheda non trovata."),
    );
  }
  if (version.status === "published" || version.status === "archived") {
    fail("Questa scheda non è più una bozza: non è modificabile.");
  }

  // GROUNDING: mappa id->nome degli esercizi reali della libreria del tenant.
  const { data: lib } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("tenant_id", profile.tenant_id);
  const nameById = new Map<string, string>(
    (lib ?? []).map((e) => [e.id as string, e.name as string]),
  );

  // Normalizzazione lato server: niente dato arbitrario finisce nel DB.
  const prev = (version.content ?? {}) as Partial<EditorContent>;
  const daysIn = Array.isArray(incoming!.days) ? incoming!.days.slice(0, 14) : [];
  const days: EditorDay[] = daysIn.map((d) => ({
    label: clampStr(d?.label, 120),
    focus: clampStr(d?.focus, 120),
    exercises: (Array.isArray(d?.exercises) ? d.exercises.slice(0, 40) : [])
      .filter((ex) => nameById.has(String(ex?.exercise_id)))
      .map((ex) => {
        const exId = String(ex.exercise_id);
        return {
          exercise_id: exId,
          exercise_name: nameById.get(exId) as string, // fonte autorevole
          sets: toInt(ex?.sets, 0, 99),
          reps: clampStr(ex?.reps, 40),
          rest_seconds: toInt(ex?.rest_seconds, 0, 3600),
          notes: clampStr(ex?.notes, 1000),
        };
      }),
  }));

  const content: EditorContent = {
    title: clampStr(incoming!.title, 200) || clampStr(prev.title, 200) || "Scheda",
    summary: clampStr(incoming!.summary, 1000),
    coach_notes: clampStr(incoming!.coach_notes, 2000),
    // health_flags: non editabili qui -> preservo quelli segnalati dall'AI.
    health_flags: Array.isArray(prev.health_flags)
      ? prev.health_flags.map((f) => clampStr(f, 300)).slice(0, 30)
      : [],
    days,
  };

  const { error: upErr } = await supabase
    .from("program_versions")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", versionId)
    .eq("tenant_id", profile.tenant_id); // difesa in profondità oltre alla RLS
  if (upErr) fail(upErr.message);

  if (intent === "publish") {
    const { error: pubErr } = await supabase.rpc("publish_program_version", {
      p_version_id: versionId,
    });
    if (pubErr) fail(pubErr.message);
    revalidatePath(`/coach/programmi/${versionId}`);
    redirect(`/coach/programmi/${versionId}?published=1`);
  }

  revalidatePath(`/coach/programmi/${versionId}`);
  redirect(`/coach/programmi/${versionId}?saved=1`);
}

// --- Analisi progressi AI -----------------------------------------------------

// Chiama la Edge Function che analizza allenamenti + check-in e produce una
// BOZZA di report progressi. Poi porta il coach alla pagina del report.
export async function generateProgressReport(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) redirect("/coach/progressi");

  const supabase = await createServerSupabase();
  // Inoltra il token utente alla Edge Function (verifica staff + tenant).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("analyze-progress", {
    body: { client_id: clientId },
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });

  if (error) {
    redirect(
      "/coach/progressi?error=" +
        encodeURIComponent("Analisi AI non riuscita: " + error.message),
    );
  }
  if (data?.error) {
    redirect("/coach/progressi?error=" + encodeURIComponent(data.error));
  }

  revalidatePath("/coach/progressi");
  if (data?.report_id) redirect(`/coach/progressi/${data.report_id}`);
  redirect("/coach/progressi");
}

// Il coach approva la bozza di report (finalizzata lato coach). Solo una bozza
// si approva; lo scope sul tenant è garantito da RLS + vincolo esplicito.
export async function approveProgressReport(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId) redirect("/coach/progressi");

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("progress_reports")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      reviewed_by: profile.id,
    })
    .eq("id", reportId)
    .eq("tenant_id", profile.tenant_id) // difesa in profondità oltre alla RLS
    .eq("status", "draft");
  if (error) {
    redirect(
      `/coach/progressi/${reportId}?error=` + encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/coach/progressi/${reportId}`);
  redirect(`/coach/progressi/${reportId}?approved=1`);
}
