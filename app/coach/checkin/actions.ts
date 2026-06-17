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
