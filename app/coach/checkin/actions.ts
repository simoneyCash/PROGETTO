"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

// Il coach programma un check-in per un cliente: una domanda + (opzionale) una
// data. Nasce con status 'scheduled'. Il cliente risponderà dal portale cliente
// (modulo futuro); la sintesi AI resta una bozza che il coach approverà.
export async function createCheckin(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  const scheduledRaw = String(formData.get("scheduled_for") ?? "").trim();

  if (!clientId) {
    redirect("/coach/checkin?error=" + encodeURIComponent("Scegli un cliente"));
  }
  if (!prompt) {
    redirect(
      "/coach/checkin?error=" +
        encodeURIComponent("Scrivi una domanda per il check-in"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("checkins").insert({
    tenant_id: profile.tenant_id, // RLS: deve combaciare con il tenant del coach
    client_id: clientId,
    prompt,
    scheduled_for: scheduledRaw || null,
    status: "scheduled",
  });

  if (error) {
    redirect("/coach/checkin?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/coach/checkin");
  redirect("/coach/checkin?created=1");
}

// Lancia la Edge Function che riassume la risposta del cliente come BOZZA.
export async function generateCheckinSummary(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const id = String(formData.get("checkin_id") ?? "");
  if (!id) redirect("/coach/checkin");

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("summarize-checkin", {
    body: { checkin_id: id },
    headers: session
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
  });

  if (error) {
    redirect(
      `/coach/checkin/${id}?error=` +
        encodeURIComponent("Sintesi AI non riuscita: " + error.message),
    );
  }
  if (data?.error) {
    redirect(`/coach/checkin/${id}?error=` + encodeURIComponent(data.error));
  }

  revalidatePath(`/coach/checkin/${id}`);
  redirect(`/coach/checkin/${id}?summarized=1`);
}

// Il coach approva la sintesi AI (la marca come rivista). Resta interna al coach.
export async function approveCheckinSummary(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const id = String(formData.get("checkin_id") ?? "");
  if (!id) redirect("/coach/checkin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("checkins")
    .update({ summary_status: "approved" })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id); // difesa in profondità oltre alla RLS

  if (error) {
    redirect(`/coach/checkin/${id}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/coach/checkin/${id}`);
  redirect(`/coach/checkin/${id}?approved=1`);
}
