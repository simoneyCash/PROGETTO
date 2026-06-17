"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

// Crea un nuovo cliente nel tenant del coach.
export async function addClient(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!full_name) {
    redirect("/coach?error=" + encodeURIComponent("Il nome è obbligatorio"));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("clients").insert({
    tenant_id: profile.tenant_id, // RLS: deve combaciare con il tenant del coach
    coach_id: profile.id,
    full_name,
    email: email || null,
    status: "active",
  });

  if (error) {
    redirect("/coach?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/coach");
  redirect("/coach");
}

// Salva (crea o aggiorna) il questionario di intake di un cliente.
export async function saveIntake(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) redirect("/coach");

  const answers = {
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
    .select("id")
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();

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
      `/coach/clienti/${clientId}?error=` + encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/coach/clienti/${clientId}`);
  redirect(`/coach/clienti/${clientId}?saved=1`);
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
      `/coach/clienti/${clientId}?error=` +
        encodeURIComponent("Generazione AI non riuscita: " + error.message),
    );
  }
  if (data?.error) {
    redirect(
      `/coach/clienti/${clientId}?error=` + encodeURIComponent(data.error),
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
