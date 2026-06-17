"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

// Il cliente risponde a un PROPRIO check-in. Passa per la RPC SECURITY DEFINER
// client_answer_checkin: il client_id è risolto lato DB (my_client_id), mai dal
// browser, e si può rispondere solo ai check-in ancora aperti.
export async function answerCheckin(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const id = String(formData.get("checkin_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!id) redirect("/cliente/checkin");
  if (!text) {
    redirect(
      "/cliente/checkin?error=" + encodeURIComponent("Scrivi una risposta"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("client_answer_checkin", {
    p_checkin_id: id,
    p_response: { text },
  });

  if (error) {
    redirect("/cliente/checkin?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/cliente/checkin");
  revalidatePath("/cliente");
  redirect("/cliente/checkin?answered=1");
}
