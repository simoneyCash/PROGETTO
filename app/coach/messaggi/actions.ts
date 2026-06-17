"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

// Il coach invia un messaggio a un cliente. `sender_role` viene timbrato da un
// trigger dal profilo reale del mittente, quindi qui passiamo solo sender_id.
export async function sendMessage(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!clientId) redirect("/coach/messaggi");
  if (!body) redirect(`/coach/messaggi/${clientId}`);

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    tenant_id: profile.tenant_id, // RLS: tenant del coach
    client_id: clientId,
    sender_id: profile.id, // profiles.id == auth.uid()
    body,
  });

  if (error) {
    redirect(
      `/coach/messaggi/${clientId}?error=` + encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/coach/messaggi/${clientId}`);
  redirect(`/coach/messaggi/${clientId}`);
}
