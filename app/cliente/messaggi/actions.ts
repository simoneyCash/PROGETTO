"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

// Il cliente invia un messaggio al coach. Non può leggere la tabella `clients`,
// quindi ottiene il proprio client_id dall'helper my_client_id() (SECURITY
// DEFINER). Il trigger timbra sender_role='client'.
export async function sendClientMessage(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect("/cliente/messaggi");

  const supabase = await createClient();
  const { data: clientId } = await supabase.rpc("my_client_id");
  if (!clientId) {
    redirect(
      "/cliente/messaggi?error=" +
        encodeURIComponent("Account cliente non collegato."),
    );
  }

  const { error } = await supabase.from("messages").insert({
    tenant_id: profile.tenant_id,
    client_id: clientId,
    sender_id: profile.id, // profiles.id == auth.uid()
    body,
  });
  if (error) {
    redirect("/cliente/messaggi?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/cliente/messaggi");
  redirect("/cliente/messaggi");
}
